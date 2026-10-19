import {hashPassword,checkPassword} from './passwords.js';
import {z} from 'zod';
import {userCreateSchema,userUpdateSchema} from '../security/schemas.js';
import {hashSchema,csrfSchema} from '../security/schemas.js';
const sessionSchema=z.object({username:z.string().min(1).max(64),csrf:csrfSchema,expiresAt:z.number().int().positive(),role:z.enum(['admin','operator']).optional(),revision:z.number().int().optional(),root:z.boolean().optional()}).strict();
export class AdminSessions{
 constructor(ctx){this.ctx=ctx}
 // This object has no public route: only the bound Worker can reach its internal fetch interface.
 async fetch(request){const url=new URL(request.url);if(request.method!=='POST')return new Response(null,{status:405});if(url.pathname.startsWith('/users/')){const input=await request.json();return this.ctx.blockConcurrencyWhile(()=>this.users(url.pathname,input))}const schema=url.pathname==='/create'?z.object({key:hashSchema,session:sessionSchema}).strict():z.object({key:hashSchema}).strict();const parsed=schema.safeParse(await request.json());if(!parsed.success)return new Response(null,{status:400});const {key,session}=parsed.data;const storageKey='session:'+key;
  if(url.pathname==='/create'){await this.ctx.storage.put(storageKey,session);const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm>session.expiresAt)await this.ctx.storage.setAlarm(session.expiresAt);return Response.json({ok:true})}
  if(url.pathname==='/read'){const data=await this.ctx.storage.get(storageKey);if(!data||data.expiresAt<=Date.now()){if(data)await this.ctx.storage.delete(storageKey);return new Response(null,{status:404})}if(!data.root&&data.revision!==undefined){const user=await this.ctx.storage.get('user:'+data.username.toLowerCase());if(!user?.active||user.revision!==data.revision)return new Response(null,{status:404})}return Response.json(data)}
  if(url.pathname==='/delete'){await this.ctx.storage.delete(storageKey);return Response.json({ok:true})}
  return new Response(null,{status:404});
 }
 // Serialize account writes with blockConcurrencyWhile, including password derivation.
 async users(path,input){
  const storage=this.ctx.storage,key='user:'+String(input.username||'').toLowerCase();
  if(path==='/users/authenticate'){
   const user=await storage.get(key);
   // Run the same memory-hard KDF for unknown usernames, inside the Durable Object CPU budget.
   const valid=await checkPassword(input.password,user?.credentials||{salt:'0'.repeat(32),hash:'0'.repeat(64)});
   if(!user?.active||!valid)return new Response(null,{status:401});
   return Response.json({username:user.username,role:user.role,revision:user.revision});
  }
  if(path==='/users/list'){const users=await storage.list({prefix:'user:'});return Response.json([...users.values()].map(({username,name,role,active,createdAt})=>({username,name,role,active,createdAt})))}
  if(path==='/users/create'){
   const parsed=userCreateSchema.safeParse(input.user);if(!parsed.success)return new Response(null,{status:400});
   if(await storage.get(key))return new Response(null,{status:409});
   if((await storage.list({prefix:'user:'})).size>=50)return new Response(null,{status:409});
   const {password,...fields}=parsed.data,credentials=await hashPassword(password);await storage.put(key,{...fields,active:true,revision:1,createdAt:Date.now(),credentials});return Response.json({ok:true});
  }
  if(path==='/users/update'){
   const parsed=userUpdateSchema.safeParse(input.patch);if(!parsed.success)return new Response(null,{status:400});
   const user=await storage.get(key);if(!user)return new Response(null,{status:404});
   const {username,password,...patch}=parsed.data,credentials=password?await hashPassword(password):null;await storage.put(key,{...user,...patch,...(credentials?{credentials}:{}),revision:user.revision+1});return Response.json({ok:true});
  }
  return new Response(null,{status:404});
 }
 // Expired sessions are denied on every read and also cleaned from persistent storage.
 async alarm(){const all=await this.ctx.storage.list({prefix:'session:'});let next=Infinity;for(const [key,value] of all){if(value.expiresAt<=Date.now())await this.ctx.storage.delete(key);else next=Math.min(next,value.expiresAt)}if(Number.isFinite(next))await this.ctx.storage.setAlarm(next)}
}
