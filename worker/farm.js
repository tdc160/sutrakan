import {LEGACY_PROPERTY_ID,legacyProperty,defaultBirds} from '../property-model.js';
import {propertyIdSchema,propertyInputSchema,propertySchema} from '../security/property-schemas.js';
import {inventory} from '../feed-inventory.js';
import {feedActionSchema,feedStateSchema} from '../security/feed-schemas.js';
import {applyFeedAction,settleFeed} from './feed-operations.js';
import {localDay} from '../security/schemas.js';
import {backupSchema,centralRecordSchema,farmImportSchema} from '../security/schemas.js';
import {HttpError} from './security.js';
const initial={birds:[200,70,0,0,0],records:[]};
export function appendRecord(state,record,username){
 const existing=state.records.find(r=>r.id===record.id);
 if(existing){const {createdBy,createdAt,propertyId,...payload}=existing;if(JSON.stringify(payload)!==JSON.stringify(record))throw new HttpError(409);return state}
 const birds=[...state.birds];const removes=['Mortalidade','Transferência'].includes(record.type)||record.type==='Venda'&&record.category!=='Ovos';
 // The server's current flock is authoritative; concurrent clients cannot oversell birds.
 if(removes){if(record.qty>birds[record.from])throw new HttpError(409);birds[record.from]-=record.qty}
 if(['Nascimento','Transferência'].includes(record.type))birds[record.to]+=record.qty;
 if(birds.some(n=>n>1000000))throw new HttpError(409);
 return {...state,birds,records:[...state.records,{...record,...(state.propertyId?{propertyId:state.propertyId}:{}),createdBy:username,createdAt:Date.now()}]};
}
export class FarmStore{
 constructor(ctx){this.ctx=ctx}
 async bindScope(input){const id=propertyIdSchema.parse(input.propertyId||LEGACY_PROPERTY_ID),bound=await this.ctx.storage.get('property-id');if(bound&&bound!==id)throw new HttpError(403);if(!bound)await this.ctx.storage.put('property-id',id);
  if(!await this.ctx.storage.get('profile')){const profile=propertySchema.parse(input.initialProperty||legacyProperty);if(profile.id!==id)throw new HttpError(403);await this.ctx.storage.put('profile',profile)}
  if((await this.ctx.storage.get('profile')).id!==id)throw new HttpError(403);
  if(id!==LEGACY_PROPERTY_ID&&!await this.ctx.storage.get('meta')){const profile=await this.ctx.storage.get('profile');const birds=input.initialBirds||defaultBirds(id);await this.write(backupSchema.parse({propertyId:id,property:profile,birds,records:[]}),1)}
 }
 async read(storage=this.ctx.storage){const id=await storage.get('property-id')||LEGACY_PROPERTY_ID,property=await storage.get('profile')||legacyProperty,meta=await storage.get('meta');if(!meta)return {initialized:false,revision:0,propertyId:id,property,...structuredClone(initial)};let raw='';for(let i=0;i<meta.chunks;i++)raw+=await storage.get('chunk:'+i);const data=JSON.parse(raw);if(data.propertyId&&data.propertyId!==id||data.feed?.propertyId&&data.feed.propertyId!==id||data.records.some(r=>r.propertyId&&r.propertyId!==id))throw new HttpError(403);return {initialized:true,revision:meta.revision,...data,...(data.feed?{feed:{...data.feed,propertyId:id}}:{}),propertyId:id,property,records:data.records.map(r=>({...r,propertyId:id}))}}
 async scheduleAlarm(state){if(!this.ctx.storage.getAlarm)return;if(state.feed?.plans.some(p=>p.active)){const now=Date.now(),date=new Date(now);date.setUTCHours(3,10,0,0);if(date.getTime()<=now)date.setUTCDate(date.getUTCDate()+1);const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm<=now||alarm>date.getTime())await this.ctx.storage.setAlarm(date.getTime())}else if(this.ctx.storage.deleteAlarm)await this.ctx.storage.deleteAlarm()}
 async alarm(){return this.ctx.blockConcurrencyWhile(async()=>{const state=await this.read(),next=settleFeed(state,localDay());if(JSON.stringify(next)!==JSON.stringify(state)){const {initialized,revision,...data}=next;await this.write(data,state.revision+1)}await this.scheduleAlarm(next)})}
 async write(data,revision){const bound=await this.ctx.storage.get('property-id');if(bound&&data.propertyId&&bound!==data.propertyId||data.property&&data.propertyId&&data.property.id!==data.propertyId)throw new HttpError(403);if(data.feed){if(data.feed.propertyId&&data.feed.propertyId!==data.propertyId)throw new HttpError(403);feedStateSchema.parse(data.feed);if(data.feed.purchaseStart>data.records.length)throw new HttpError(400);const balances=inventory(data);if([...balances.raw.values(),...balances.rations.values()].some(value=>!Number.isSafeInteger(value)||value<0||value>1000000*1000000))throw new HttpError(409);}const raw=JSON.stringify(data);if(new TextEncoder().encode(raw).length>10*1024*1024||data.records.length>20000)throw new HttpError(413);
 // Chunked values stay below the DO KV value limit even with multibyte characters.
 // One durable transaction publishes metadata and all chunks together, never a partial snapshot.
 await this.ctx.storage.transaction(async storage=>{const previous=await storage.get('meta');let chunks=0;for(let i=0;i<raw.length;){let end=Math.min(i+28000,raw.length);if(end<raw.length&&/[\uD800-\uDBFF]/.test(raw[end-1]))end--;await storage.put('chunk:'+chunks++,raw.slice(i,end));i=end;}for(let i=chunks;i<(previous?.chunks||0);i++)await storage.delete('chunk:'+i);await storage.put('meta',{chunks,revision});if(data.property)await storage.put('profile',data.property)});await this.scheduleAlarm(data);
 }
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{try{
  const path=new URL(request.url).pathname,input=await request.json();await this.bindScope(input);if(path==='/profile')return Response.json(await this.ctx.storage.get('profile'));const state=await this.read();await this.scheduleAlarm(state);
  if(path==='/property-update'){const profile=propertyInputSchema.parse(input.profile),next=settleFeed(state,localDay()),{initialized,revision,...data}=next;data.property={...profile,id:state.propertyId};if(!state.initialized){await this.ctx.storage.put('profile',data.property);return Response.json({...data,initialized:false,revision:0})}await this.write(data,state.revision+1);return Response.json({...data,initialized:state.initialized,revision:state.revision+1})}
  if(path==='/read')return Response.json(state);
  if(path==='/feed'||path==='/feed-settle'){
   if(!state.initialized)throw new HttpError(409);
   const next=path==='/feed'?applyFeedAction(state,feedActionSchema.parse(input.command),input.username,localDay()):settleFeed(state,localDay());
   const {initialized,revision,...data}=next,changed=JSON.stringify(next)!==JSON.stringify(state);if(changed)await this.write(data,state.revision+1);
   return Response.json({...data,initialized:true,revision:state.revision+(changed?1:0)});
  }
  if(path==='/record'){
   if(!state.initialized)throw new HttpError(409);const record=centralRecordSchema.parse(input.record),settled=settleFeed(state,localDay()),next=appendRecord(settled,record,input.username);
   const {initialized,revision,...data}=next,changed=JSON.stringify(next)!==JSON.stringify(state);if(changed)await this.write(data,state.revision+1);return Response.json({...data,initialized:true,revision:state.revision+(changed?1:0)});
  }
  if(path==='/import'){
   // Initial migration only: a second device can never overwrite the central farm.
   if(state.initialized)throw new HttpError(409);const {propertyId,initialProperty,initialBirds,...importInput}=input;const {data,revision}=farmImportSchema.parse(importInput);if(revision!==state.revision)throw new HttpError(409);
   if(data.propertyId&&data.propertyId!==state.propertyId||!data.propertyId&&state.propertyId!==LEGACY_PROPERTY_ID||data.property&&data.property.id!==state.propertyId||data.feed?.propertyId&&data.feed.propertyId!==state.propertyId||data.records.some(r=>r.propertyId&&r.propertyId!==state.propertyId))throw new HttpError(409);
   const ids=new Set();const records=data.records.map(r=>{const id=r.id||crypto.randomUUID();if(ids.has(id))throw new HttpError(409);ids.add(id);return {...r,id,propertyId:state.propertyId}});
   const next=backupSchema.parse({...data,records,propertyId:state.propertyId,property:state.property});await this.write(next,1);return Response.json({...next,initialized:true,revision:1});
  }
  throw new HttpError(404);
 }catch(error){if(error instanceof HttpError)return new Response(null,{status:error.status});if(error?.name==='ZodError')return new Response(null,{status:400});throw error}})}
}
