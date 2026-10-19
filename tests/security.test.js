import {farmFixture} from './helpers/farm-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {AdminSessions} from '../worker/sessions.js';
import {cookieName} from '../worker/security.js';
import {recordSchema,backupSchema} from '../security/schemas.js';
function fixture(){const farm=farmFixture();const data=new Map();let alarm=null;const object=new AdminSessions({blockConcurrencyWhile:fn=>fn(),storage:{async get(k){return data.get(k)},async put(k,v){data.set(k,v)},async delete(k){return data.delete(k)},async list(){return new Map(data)},async getAlarm(){return alarm},async setAlarm(t){alarm=t}}});const limiter=limit=>{const counts=new Map();return {async limit({key}){const count=(counts.get(key)||0)+1;counts.set(key,count);return {success:count<=limit}}}};return {data,env:{ADMIN_USERNAME:'Talitom',ADMIN_PASSWORD:crypto.randomUUID(),API_LIMITER:limiter(60),LOGIN_LIMITER:limiter(5),LOGIN_ACCOUNT_LIMITER:limiter(10),FARM_STORE:{idFromName:n=>n,get:()=>({fetch:r=>farm.object.fetch(r)})},ADMIN_SESSIONS:{idFromName:n=>n,get:()=>({fetch:r=>object.fetch(r)})},ASSETS:{fetch:async()=>new Response('<html>app</html>',{headers:{'Content-Type':'text/html'}})}}}}
const req=(path,body,{method='POST',headers={},cookie,csrf}={})=>new Request('https://santo.test'+path,{method,headers:{Origin:'https://santo.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.5',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers},...(method!=='GET'?{body:typeof body==='string'?body:JSON.stringify(body??{})}:{})});
async function login(env){const response=await worker.fetch(req('/api/auth/login',{username:'Talitom',password:env.ADMIN_PASSWORD}),env);assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie').split(';')[0];const data=await response.json();return {cookie,csrf:data.csrf,response,data}}
const record=()=>({type:'Coleta de ovos',category:'Coleta de ovos',qty:12,value:0,date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),note:''});
test('login creates an opaque HttpOnly Secure SameSite session; logout invalidates replay',async()=>{
 const {env}=fixture();const session=await login(env);const setCookie=session.response.headers.get('Set-Cookie');assert.match(setCookie,new RegExp('^'+cookieName+'='));assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);assert.equal(session.data.expiresAt>Date.now(),true);assert.equal('password' in session.data,false);
 const read=await worker.fetch(req('/api/auth/session',null,{method:'GET',cookie:session.cookie}),env);assert.equal(read.status,200);assert.equal((await read.json()).user,'Talitom');
 assert.equal((await worker.fetch(req('/api/auth/logout',{},session),env)).status,200);
 assert.equal((await worker.fetch(req('/api/auth/session',null,{method:'GET',cookie:session.cookie}),env)).status,401);
});
test('authentication is required and cannot be bypassed through client-side flags',async()=>{
 const {env}=fixture();assert.equal((await worker.fetch(req('/api/records/validate',record()),env)).status,401);
 assert.equal((await worker.fetch(req('/api/auth/session',null,{method:'GET',cookie:cookieName+'=not-a-session'}),env)).status,401);
 const wrong={username:'Talitom',password:crypto.randomUUID()};const response=await worker.fetch(req('/api/auth/login',wrong),env);assert.equal(response.status,401);assert.equal((await response.json()).error,'Credenciais inválidas ou acesso não autorizado.');
 assert.equal((await worker.fetch(req('/api/auth/login',{username:'another-user',password:env.ADMIN_PASSWORD}),env)).status,401);
});
test('sessions expire on the server, regardless of browser state',async()=>{
 const {env,data}=fixture();const session=await login(env);for(const value of data.values())value.expiresAt=Date.now()-1;
 assert.equal((await worker.fetch(req('/api/auth/session',null,{method:'GET',cookie:session.cookie}),env)).status,401);assert.equal(data.size,0);
});
test('origin and CSRF checks reject state-changing requests before accepting data',async()=>{
 const {env}=fixture();assert.equal((await worker.fetch(req('/api/auth/login',{username:'Talitom',password:env.ADMIN_PASSWORD},{headers:{Origin:'https://attacker.test'}}),env)).status,403);
 const session=await login(env);assert.equal((await worker.fetch(req('/api/records/validate',record(),{cookie:session.cookie}),env)).status,403);
 assert.equal((await worker.fetch(req('/api/records/validate',record(),{...session,csrf:'x'.repeat(43)}),env)).status,403);
 assert.equal((await worker.fetch(req('/api/records/validate',record(),session),env)).status,200);
});
test('schemas reject coercion, excessive lengths, unknown fields and inappropriate concentrations',async()=>{
 const {env}=fixture();const session=await login(env);
 for(const invalid of [{...record(),qty:'12'},{...record(),note:'x'.repeat(501)},{...record(),value:-1},{...record(),role:'admin'},{...record(),date:'2026-02-30'}])assert.equal((await worker.fetch(req('/api/records/validate',invalid,session),env)).status,400);
 assert.equal(recordSchema.safeParse({...record(),type:'Despesa',category:'Ração',ingredient:'Núcleo de início',qty:1,value:20,concentration:6}).success,false);
 assert.equal(backupSchema.safeParse(JSON.parse('{"birds":[0,0,0,0,0],"records":[],"__proto__":{"admin":true}}')).success,false);
 assert.equal((await worker.fetch(req('/api/auth/login',{username:{admin:true},password:env.ADMIN_PASSWORD}),fixture().env)).status,400);
});
test('query/header/JSON validation and streaming byte limits bound hostile inputs',async()=>{
 const {env}=fixture();const session=await login(env);
 assert.equal((await worker.fetch(req('/api/records/validate?sort=UNTRUSTED',record(),session),env)).status,400);
 assert.equal((await worker.fetch(req('/api/records/validate',record(),{...session,headers:{'X-Oversized':'x'.repeat(4100)}}),env)).status,400);
 assert.equal((await worker.fetch(req('/api/records/validate',record(),{...session,headers:{'Content-Type':'text/plain'}}),env)).status,415);
 assert.equal((await worker.fetch(req('/api/records/validate','broken json',session),env)).status,400);
 assert.equal((await worker.fetch(req('/api/records/validate',{...record(),note:'x'.repeat(17000)},{...session,headers:{'Content-Length':'2'}}),env)).status,413);
});
test('text is preserved as data and safely encoded for JSON/HTML output contexts',async()=>{
 const {env}=fixture();const session=await login(env);const note='<img src=x onerror=alert(1)> " OR 1=1 --';const response=await worker.fetch(req('/api/records/validate',{...record(),note},session),env);assert.equal(response.status,200);const body=await response.text();assert.equal(body.includes('<img'),false);assert.equal(JSON.parse(body).record.note,note);assert.match(response.headers.get('Content-Security-Policy'),/default-src 'none'/);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('Cache-Control'),/no-store/);
});
test('edge limits reject excessive login attempts; missing protections fail closed',async()=>{
 const {env}=fixture();for(let i=0;i<5;i++)assert.equal((await worker.fetch(req('/api/auth/login',{username:'Talitom',password:crypto.randomUUID()}),env)).status,401);
 const limited=await worker.fetch(req('/api/auth/login',{username:'Talitom',password:crypto.randomUUID()}),env);assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'60');
 const missing=fixture().env;delete missing.API_LIMITER;const original=console.error;console.error=()=>{};try{assert.equal((await worker.fetch(req('/api/auth/login',{username:'Talitom',password:crypto.randomUUID()}),missing)).status,503)}finally{console.error=original}
});
test('internal exceptions are logged privately and never exposed in client errors',async()=>{
 const {env}=fixture();env.API_LIMITER={limit(){throw Error('INTERNAL_DATABASE_DETAILS')}};const logs=[];const original=console.error;console.error=s=>logs.push(s);let response;try{response=await worker.fetch(req('/api/auth/session',null,{method:'GET'}),env)}finally{console.error=original}assert.equal(response.status,500);const body=await response.text();assert.equal(body.includes('INTERNAL_DATABASE_DETAILS'),false);assert.equal(body.includes('stack'),false);assert.ok(logs.some(s=>s.includes('INTERNAL_DATABASE_DETAILS')));assert.equal(logs.join('').includes(env.ADMIN_PASSWORD),false);
});
test('administrators manage persistent accounts; operators cannot list or change accounts',async()=>{
 const {env,data}=fixture(),admin=await login(env),password=crypto.randomUUID();
 assert.equal((await worker.fetch(req('/api/users',{username:'Campo',name:'Equipe <campo>',role:'operator',password},admin),env)).status,201);
 const stored=data.get('user:campo');assert.equal('password' in stored,false);assert.equal(stored.credentials.algorithm,'scrypt-16384-8-5');assert.equal(JSON.stringify(stored).includes(password),false);
 const listing=await worker.fetch(req('/api/users',null,{...admin,method:'GET'}),env);assert.equal(listing.status,200);const listed=await listing.text();assert.equal(listed.includes(stored.credentials.hash),false);assert.equal(listed.includes('<campo>'),false);
 const signed=await worker.fetch(req('/api/auth/login',{username:'campo',password}),env);assert.equal(signed.status,200);const account=await signed.json(),operator={cookie:signed.headers.get('Set-Cookie').split(';')[0],csrf:account.csrf};assert.equal(account.role,'operator');
 assert.equal((await worker.fetch(req('/api/users',null,{...operator,method:'GET'}),env)).status,403);
 assert.equal((await worker.fetch(req('/api/users',{username:'Intruder',name:'x',role:'admin',password},operator),env)).status,403);
 assert.equal((await worker.fetch(req('/api/records/validate',record(),operator),env)).status,200);
 assert.equal((await worker.fetch(req('/api/users/update',{username:'Campo',active:false},admin),env)).status,200);
 assert.equal((await worker.fetch(req('/api/auth/session',null,{...operator,method:'GET'}),env)).status,401);
 assert.equal((await worker.fetch(req('/api/auth/login',{username:'Campo',password}),env)).status,401);
});
test('root protection, CSRF, unique names, password resets and role changes are enforced',async()=>{
 const {env}=fixture(),admin=await login(env),password=crypto.randomUUID(),newPassword=crypto.randomUUID();
 const create={username:'Helper',name:'Ajudante',role:'admin',password};
 assert.equal((await worker.fetch(req('/api/users',create,{cookie:admin.cookie}),env)).status,403);
 assert.equal((await worker.fetch(req('/api/users',{...create,password:'short'},admin),env)).status,400);
 assert.equal((await worker.fetch(req('/api/users',{...create,username:'talitom'},admin),env)).status,409);
 assert.equal((await worker.fetch(req('/api/users',create,admin),env)).status,201);
 assert.equal((await worker.fetch(req('/api/users',{...create,username:'HELPER'},admin),env)).status,409);
 const response=await worker.fetch(req('/api/auth/login',{username:'Helper',password}),env);assert.equal(response.status,200);const session={cookie:response.headers.get('Set-Cookie').split(';')[0],csrf:(await response.json()).csrf};
 assert.equal((await worker.fetch(req('/api/users/update',{username:'Talitom',active:false},session),env)).status,409);
 assert.equal((await worker.fetch(req('/api/users/update',{username:'Helper',role:'operator'},session),env)).status,409);
 assert.equal((await worker.fetch(req('/api/users/update',{username:'Helper',password:newPassword,role:'operator'},admin),env)).status,200);
 assert.equal((await worker.fetch(req('/api/users',null,{...session,method:'GET'}),env)).status,401);
 assert.equal((await worker.fetch(req('/api/auth/login',{username:'Helper',password}),env)).status,401);
 const fresh=await worker.fetch(req('/api/auth/login',{username:'Helper',password:newPassword}),env);assert.equal(fresh.status,200);assert.equal((await fresh.json()).role,'operator');
});

test('central farm endpoints require session and CSRF, and only administrators initialize',async()=>{
 const {env}=fixture(),admin=await login(env),password=crypto.randomUUID();
 assert.equal((await worker.fetch(req('/api/farm',null,{method:'GET'}),env)).status,401);
 const initial={data:{birds:[200,70,0,0,0],records:[]},revision:0};
 assert.equal((await worker.fetch(req('/api/farm/import',initial,{cookie:admin.cookie}),env)).status,403);
 await worker.fetch(req('/api/users',{username:'Worker',name:'Equipe',role:'operator',password},admin),env);
 const signed=await worker.fetch(req('/api/auth/login',{username:'Worker',password}),env),details=await signed.json(),operator={cookie:signed.headers.get('Set-Cookie').split(';')[0],csrf:details.csrf};
 assert.equal((await worker.fetch(req('/api/farm/import',initial,operator),env)).status,403);
 assert.equal((await worker.fetch(req('/api/farm/import',initial,admin),env)).status,200);
 const r={...record(),id:crypto.randomUUID()};assert.equal((await worker.fetch(req('/api/farm/records',r,operator),env)).status,200);
 const shared=await worker.fetch(req('/api/farm',null,{...admin,method:'GET'}),env);assert.equal((await shared.json()).records[0].createdBy,'Worker');assert.match(shared.headers.get('Cache-Control'),/no-store/);
 assert.equal((await worker.fetch(req('/api/farm/records',{...r,createdBy:'Talitom'},operator),env)).status,400);
});
test('administrative migration accepts a bounded legacy backup larger than an ordinary record body',async()=>{
 const {env}=fixture(),admin=await login(env);const records=Array.from({length:100},()=>({...record(),id:crypto.randomUUID(),note:'histórico '.repeat(30)}));
 const body={data:{birds:[12,7,0,0,0],records},revision:0};assert.ok(JSON.stringify(body).length>16384);
 assert.equal((await worker.fetch(req('/api/farm/import',body,admin),env)).status,200);
 assert.equal((await worker.fetch(req('/api/farm/import',body,admin),env)).status,409);
 const saved=await (await worker.fetch(req('/api/farm',null,{...admin,method:'GET'}),env)).json();assert.equal(saved.records.length,100);assert.deepEqual(saved.birds,[12,7,0,0,0]);
});
