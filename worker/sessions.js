import {z} from 'zod';
import {hashSchema,csrfSchema} from '../security/schemas.js';
const sessionSchema=z.object({username:z.string().min(1).max(64),csrf:csrfSchema,expiresAt:z.number().int().positive()}).strict();
export class AdminSessions{
 constructor(ctx){this.ctx=ctx}
 // This object has no public route: only the bound Worker can reach its internal fetch interface.
 async fetch(request){const url=new URL(request.url);if(request.method!=='POST')return new Response(null,{status:405});const schema=url.pathname==='/create'?z.object({key:hashSchema,session:sessionSchema}).strict():z.object({key:hashSchema}).strict();const parsed=schema.safeParse(await request.json());if(!parsed.success)return new Response(null,{status:400});const {key,session}=parsed.data;const storageKey='session:'+key;
  if(url.pathname==='/create'){await this.ctx.storage.put(storageKey,session);const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm>session.expiresAt)await this.ctx.storage.setAlarm(session.expiresAt);return Response.json({ok:true})}
  if(url.pathname==='/read'){const data=await this.ctx.storage.get(storageKey);if(!data||data.expiresAt<=Date.now()){if(data)await this.ctx.storage.delete(storageKey);return new Response(null,{status:404})}return Response.json(data)}
  if(url.pathname==='/delete'){await this.ctx.storage.delete(storageKey);return Response.json({ok:true})}
  return new Response(null,{status:404});
 }
 // Expired sessions are denied on every read and also cleaned from persistent storage.
 async alarm(){const all=await this.ctx.storage.list({prefix:'session:'});let next=Infinity;for(const [key,value] of all){if(value.expiresAt<=Date.now())await this.ctx.storage.delete(key);else next=Math.min(next,value.expiresAt)}if(Number.isFinite(next))await this.ctx.storage.setAlarm(next)}
}
