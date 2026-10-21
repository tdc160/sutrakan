import {legacyProperty,LEGACY_PROPERTY_ID} from '../property-model.js';
import {propertyCreateSchema,registrationSchema} from '../security/property-schemas.js';
import {hashPassword} from './passwords.js';
const memberKey=(username,id)=>'member:'+username.toLowerCase()+':'+id;
export async function putMembership(storage,username,id,value){await storage.put(memberKey(username,id),value);await storage.put('property-member:'+id+':'+username.toLowerCase(),{username,...value})}
export async function ensureLegacy(ctx,input){const storage=ctx.storage;if(!await storage.get('property:'+LEGACY_PROPERTY_ID))await storage.put('property:'+LEGACY_PROPERTY_ID,{property:{...legacyProperty,owner:input.rootUsername||legacyProperty.owner},ownerUsername:input.rootUsername||legacyProperty.owner,initialBirds:[200,70,0,0,0]});
 if(!await storage.get('legacy-users-migrated')){const users=await storage.list({prefix:'user:'});for(const [key,user] of users){if(!user.tenantReady){await putMembership(storage,user.username,LEGACY_PROPERTY_ID,{role:user.role||'operator',active:user.active});await storage.put(key,{...user,tenantReady:true})}}await storage.put('legacy-users-migrated',true)}
 const key='user:'+input.username.toLowerCase(),user=await storage.get(key);
 if(input.root){const marker='root-tenant-ready:'+input.username.toLowerCase();if(!await storage.get(marker)){await putMembership(storage,input.username,LEGACY_PROPERTY_ID,{role:'admin',active:true});await storage.put(marker,true)}}
 else if(user&&!user.tenantReady){await putMembership(storage,user.username,LEGACY_PROPERTY_ID,{role:user.role||'operator',active:user.active});await storage.put(key,{...user,tenantReady:true})}
}
export async function propertyAccessInternal(ctx,input){await ensureLegacy(ctx,input);const id=input.propertyId||LEGACY_PROPERTY_ID,entry=await ctx.storage.get('property:'+id),member=await ctx.storage.get(memberKey(input.username,id));return entry&&member?.active?{...entry,role:member.role}:null}
export async function propertyRegistry(ctx,path,input){const storage=ctx.storage;
 if(path==='/properties/register'){
  const parsed=registrationSchema.safeParse(input.registration);if(!parsed.success)return new Response(null,{status:400});const data=parsed.data;
  if(data.username.toLowerCase()===String(input.rootUsername).toLowerCase()||await storage.get('user:'+data.username.toLowerCase())||await storage.get('property:'+data.property.id))return new Response(null,{status:409});
  const credentials=await hashPassword(data.password);
  await storage.transaction(async tx=>{await tx.put('user:'+data.username.toLowerCase(),{username:data.username,name:data.name,role:'admin',active:true,revision:1,tenantReady:true,createdAt:Date.now(),credentials});await tx.put('property:'+data.property.id,{property:{...data.property.profile,id:data.property.id},initialBirds:data.property.initialBirds,ownerUsername:data.username,creation:JSON.stringify(data.property)});await putMembership(tx,data.username,data.property.id,{role:'admin',active:true})});return Response.json({ok:true});
 }
 await ensureLegacy(ctx,input);
 if(path==='/properties/access'){const access=await propertyAccessInternal(ctx,input);return access?Response.json(access):new Response(null,{status:403})}
 if(path==='/properties/list'){const members=await storage.list({prefix:'member:'+input.username.toLowerCase()+':'}),result=[];for(const [key,member] of members){if(!member.active)continue;const entry=await storage.get('property:'+key.split(':').at(-1));if(entry)result.push({...entry,role:member.role})}return Response.json(result)}
 if(path==='/properties/create'){
  const parsed=propertyCreateSchema.safeParse(input.data);if(!parsed.success)return new Response(null,{status:400});const data=parsed.data,existing=await storage.get('property:'+data.id);
  if(existing)return existing.ownerUsername===input.username&&existing.creation===JSON.stringify(data)?Response.json({ok:true}):new Response(null,{status:409});
  if((await storage.list({prefix:'member:'+input.username.toLowerCase()+':'})).size>=20)return new Response(null,{status:409});
  await storage.transaction(async tx=>{await tx.put('property:'+data.id,{property:{...data.profile,id:data.id},initialBirds:data.initialBirds,ownerUsername:input.username,creation:JSON.stringify(data)});await putMembership(tx,input.username,data.id,{role:'admin',active:true})});return Response.json({ok:true});
 }
 return new Response(null,{status:404});
}
