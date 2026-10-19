import {backupSchema,centralRecordSchema,farmImportSchema} from '../security/schemas.js';
import {HttpError} from './security.js';
const initial={birds:[200,70,0,0,0],records:[]};
export function appendRecord(state,record,username){
 const existing=state.records.find(r=>r.id===record.id);
 if(existing){const {createdBy,createdAt,...payload}=existing;if(JSON.stringify(payload)!==JSON.stringify(record))throw new HttpError(409);return state}
 const birds=[...state.birds];const removes=['Mortalidade','Transferência'].includes(record.type)||record.type==='Venda'&&record.category!=='Ovos';
 // The server's current flock is authoritative; concurrent clients cannot oversell birds.
 if(removes){if(record.qty>birds[record.from])throw new HttpError(409);birds[record.from]-=record.qty}
 if(['Nascimento','Transferência'].includes(record.type))birds[record.to]+=record.qty;
 if(birds.some(n=>n>1000000))throw new HttpError(409);
 return {birds,records:[...state.records,{...record,createdBy:username,createdAt:Date.now()}]};
}
export class FarmStore{
 constructor(ctx){this.ctx=ctx}
 async read(storage=this.ctx.storage){const meta=await storage.get('meta');if(!meta)return {initialized:false,revision:0,...structuredClone(initial)};let raw='';for(let i=0;i<meta.chunks;i++)raw+=await storage.get('chunk:'+i);return {initialized:true,revision:meta.revision,...JSON.parse(raw)}}
 async write(data,revision){const raw=JSON.stringify(data);if(new TextEncoder().encode(raw).length>10*1024*1024||data.records.length>20000)throw new HttpError(413);
 // Chunked values stay below the DO KV value limit even with multibyte characters.
 // One durable transaction publishes metadata and all chunks together, never a partial snapshot.
 await this.ctx.storage.transaction(async storage=>{const previous=await storage.get('meta');let chunks=0;for(let i=0;i<raw.length;){let end=Math.min(i+28000,raw.length);if(end<raw.length&&/[\uD800-\uDBFF]/.test(raw[end-1]))end--;await storage.put('chunk:'+chunks++,raw.slice(i,end));i=end;}for(let i=chunks;i<(previous?.chunks||0);i++)await storage.delete('chunk:'+i);await storage.put('meta',{chunks,revision})});
 }
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{try{
  const path=new URL(request.url).pathname,input=await request.json(),state=await this.read();
  if(path==='/read')return Response.json(state);
  if(path==='/record'){
   if(!state.initialized)throw new HttpError(409);const record=centralRecordSchema.parse(input.record),next=appendRecord({birds:state.birds,records:state.records},record,input.username);
   const changed=next.records.length!==state.records.length;if(changed)await this.write(next,state.revision+1);return Response.json({...next,initialized:true,revision:state.revision+(changed?1:0)});
  }
  if(path==='/import'){
   // Initial migration only: a second device can never overwrite the central farm.
   if(state.initialized)throw new HttpError(409);const {data,revision}=farmImportSchema.parse(input);if(revision!==state.revision)throw new HttpError(409);
   const ids=new Set();const records=data.records.map(r=>{const id=r.id||crypto.randomUUID();if(ids.has(id))throw new HttpError(409);ids.add(id);return {...r,id}});
   const next=backupSchema.parse({birds:data.birds,records});await this.write(next,1);return Response.json({...next,initialized:true,revision:1});
  }
  throw new HttpError(404);
 }catch(error){if(error instanceof HttpError)return new Response(null,{status:error.status});if(error?.name==='ZodError')return new Response(null,{status:400});throw error}})}
}
