import {legacyProperty,LEGACY_PROPERTY_ID} from '../property-model.js';
import {propertyProvisionSchema,propertyDeleteSchema} from '../security/property-schemas.js';
import {hashPassword} from './passwords.js';
// A local administrator role, or a root flag on its own, never grants global access.
const generalAdministrator=input=>input.root===true&&typeof input.username==='string'&&typeof input.rootUsername==='string'&&input.username===input.rootUsername;
const memberKey=(username,id)=>'member:'+username.toLowerCase()+':'+id;
export async function putMembership(storage,username,id,value){await storage.put(memberKey(username,id),value);await storage.put('property-member:'+id+':'+username.toLowerCase(),{username,...value})}
export async function ensureLegacy(ctx,input){const storage=ctx.storage;if(!await storage.get('property:'+LEGACY_PROPERTY_ID))await storage.put('property:'+LEGACY_PROPERTY_ID,{property:{...legacyProperty,owner:input.rootUsername||legacyProperty.owner},ownerUsername:input.rootUsername||legacyProperty.owner,initialBirds:[200,70,0,0,0]});
 if(!await storage.get('legacy-users-migrated')){const users=await storage.list({prefix:'user:'});for(const [key,user] of users){if(!user.tenantReady){await putMembership(storage,user.username,LEGACY_PROPERTY_ID,{role:user.role||'operator',active:user.active});await storage.put(key,{...user,tenantReady:true})}}await storage.put('legacy-users-migrated',true)}
 const key='user:'+input.username.toLowerCase(),user=await storage.get(key);
 if(generalAdministrator(input)){const marker='root-tenant-ready:'+input.username.toLowerCase();if(!await storage.get(marker)){await putMembership(storage,input.username,LEGACY_PROPERTY_ID,{role:'admin',active:true});await storage.put(marker,true)}}
 else if(user&&!user.tenantReady){await putMembership(storage,user.username,LEGACY_PROPERTY_ID,{role:user.role||'operator',active:user.active});await storage.put(key,{...user,tenantReady:true})}
}
export async function propertyAccessInternal(ctx,input){await ensureLegacy(ctx,input);const id=input.propertyId||LEGACY_PROPERTY_ID,entry=await ctx.storage.get('property:'+id),member=await ctx.storage.get(memberKey(input.username,id));return entry&&!entry.deletedAt&&(generalAdministrator(input)||member?.active)?{...entry,role:generalAdministrator(input)?'admin':member.role}:null}
export async function propertyRegistry(ctx,path,input){const storage=ctx.storage;
 if(path==='/properties/register')return new Response(null,{status:403});
 await ensureLegacy(ctx,input);
 if(path==='/properties/access'){const access=await propertyAccessInternal(ctx,input);return access?Response.json(access):new Response(null,{status:403})}
 if(path==='/properties/list'&&generalAdministrator(input)){const entries=await storage.list({prefix:'property:'});return Response.json([...entries.values()].filter(entry=>!entry.purgedAt).map(entry=>({...entry,role:'admin'})))}
 if(path==='/properties/list'){const members=await storage.list({prefix:'member:'+input.username.toLowerCase()+':'}),result=[];for(const [key,member] of members){if(!member.active)continue;const entry=await storage.get('property:'+key.split(':').at(-1));if(entry&&!entry.deletedAt)result.push({...entry,role:member.role})}return Response.json(result)}
 if(path==='/properties/delete-complete'){
  if(!generalAdministrator(input))return new Response(null,{status:403});const parsed=propertyDeleteSchema.safeParse(input.data);if(!parsed.success)return new Response(null,{status:400});const key='property:'+parsed.data.propertyId,entry=await storage.get(key);if(!entry?.deletedAt)return new Response(null,{status:409});await storage.put(key,{property:{id:parsed.data.propertyId},deletedAt:entry.deletedAt,deletedBy:entry.deletedBy,purgedAt:Date.now()});return Response.json({ok:true});
 }
 if(path==='/properties/delete'){
  if(!generalAdministrator(input))return new Response(null,{status:403});
  const parsed=propertyDeleteSchema.safeParse(input.data);if(!parsed.success)return new Response(null,{status:400});
  const id=parsed.data.propertyId,entry=await storage.get('property:'+id);if(!entry)return new Response(null,{status:404});
  if(entry.deletedAt)return Response.json(entry);
  // Revoke directory access first. A failed domain purge is safely retried against the tombstone.
  await storage.transaction(async tx=>{const members=await tx.list({prefix:'property-member:'+id+':'});for(const [key,member] of members){await tx.delete(key);await tx.delete(memberKey(member.username,id));const remaining=await tx.list({prefix:'member:'+member.username.toLowerCase()+':'}),user=await tx.get('user:'+member.username.toLowerCase());if(user&&![...remaining.values()].some(value=>value.active))await tx.put('user:'+member.username.toLowerCase(),{...user,active:false,revision:user.revision+1})}await tx.put('property:'+id,{property:entry.property,deletedAt:Date.now(),deletedBy:input.username})});
  return Response.json({property:{id},deletedAt:Date.now()});
 }
 if(path==='/properties/create'){
  // Only the trusted bootstrap identity may provision a tenant. Local roles never grant this privilege.
  if(!generalAdministrator(input))return new Response(null,{status:403});
  const parsed=propertyProvisionSchema.safeParse(input.data);if(!parsed.success)return new Response(null,{status:400});const data=parsed.data,{administrator,...property}=data;
  const existing=await storage.get('property:'+data.id);
  if(existing?.deletedAt)return new Response(null,{status:409});
  if(existing)return existing.provisionedBy===input.username&&existing.creation===JSON.stringify(property)&&existing.ownerUsername.toLowerCase()===administrator.username.toLowerCase()?Response.json({ok:true}):new Response(null,{status:409});
  const key='user:'+administrator.username.toLowerCase();
  if(administrator.username.toLowerCase()===String(input.rootUsername).toLowerCase()||await storage.get(key))return new Response(null,{status:409});
  const credentials=await hashPassword(administrator.password);
  // Account, property and membership become visible together; credentials are never included in property metadata.
  await storage.transaction(async tx=>{await tx.put(key,{username:administrator.username,name:administrator.name,role:'admin',active:true,revision:1,tenantReady:true,createdAt:Date.now(),credentials});await tx.put('property:'+data.id,{property:{...data.profile,id:data.id},initialBirds:data.initialBirds,ownerUsername:administrator.username,provisionedBy:input.username,creation:JSON.stringify(property)});await putMembership(tx,administrator.username,data.id,{role:'admin',active:true})});return Response.json({ok:true});
 }
 return new Response(null,{status:404});
}
