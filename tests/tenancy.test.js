import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {platformFixture} from './helpers/platform-fixture.js';
import {LEGACY_PROPERTY_ID,DEFAULT_FEEDING_RATES,legacyProperty} from '../property-model.js';
import {dailyForecast,addDays} from '../feed-inventory.js';
import {settleFeed} from '../worker/feed-operations.js';
import {FarmStore} from '../worker/farm.js';
const req=(path,body,auth={},id)=>new Request('https://farm.test'+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://farm.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.40',...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{}),...(id?{'X-Property-Id':id}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
const call=(env,path,body,auth,id)=>worker.fetch(req(path,body,auth,id),env);
async function login(env,username='Talitom',password=env.ADMIN_PASSWORD){const response=await call(env,'/api/auth/login',{username,password});assert.equal(response.status,200);const data=await response.json();return {cookie:response.headers.get('Set-Cookie').split(';')[0],csrf:data.csrf,data}}
const profile=name=>({name,owner:'Responsável '+name,region:'Interior / SP',hectares:2.5,productionType:'Ovos caipiras',feedingRates:{...DEFAULT_FEEDING_RATES}});
const creation=(name,birds=[0,0,0,0,0])=>({id:crypto.randomUUID(),profile:profile(name),initialBirds:birds});
const record=()=>({id:crypto.randomUUID(),type:'Coleta de ovos',category:'Coleta de ovos',qty:12,value:0,date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),note:'Apenas desta propriedade'});
async function register(env,username,name){const password=crypto.randomUUID(),property=creation(name,[10,5,0,0,0]),root=await login(env);assert.equal((await call(env,'/api/properties',{...property,administrator:{username,name,password}},root)).status,201);return {auth:await login(env,username,password),property,password}}

test('new owners are isolated: guessed property IDs, missing context and foreign backups cannot access legacy or other farms',async()=>{
 const {env}=platformFixture(),a=await register(env,'OwnerA','Fazenda A'),b=await register(env,'OwnerB','Fazenda B');assert.equal(a.auth.data.properties.length,1);assert.equal(a.auth.data.properties[0].property.id,a.property.id);
 assert.equal((await call(env,'/api/farm',undefined,a.auth)).status,403);assert.equal((await call(env,'/api/farm',undefined,a.auth,b.property.id)).status,403);assert.equal((await call(env,'/api/farm/records',record(),a.auth,b.property.id)).status,403);assert.equal((await call(env,'/api/users',undefined,a.auth,b.property.id)).status,403);assert.equal((await call(env,'/api/assistant/context',undefined,a.auth,b.property.id)).status,403);
 assert.equal((await call(env,'/api/farm/records',record(),a.auth,a.property.id)).status,200);const stateA=await (await call(env,'/api/farm',undefined,a.auth,a.property.id)).json(),stateB=await (await call(env,'/api/farm',undefined,b.auth,b.property.id)).json();assert.equal(stateA.records.length,1);assert.equal(stateA.records[0].propertyId,a.property.id);assert.equal(stateB.records.length,0);assert.deepEqual(stateB.birds,[10,5,0,0,0]);
 assert.equal((await call(env,'/api/farm/import',{revision:0,data:{birds:stateA.birds,records:stateA.records,propertyId:a.property.id,property:stateA.property}},b.auth,b.property.id)).status,409);
 assert.equal((await call(env,'/api/properties/update',{...profile('Ataque'),id:b.property.id},a.auth,a.property.id)).status,400);
});
test('legacy object and users migrate in place without losing records or allowing new registrants into Santo Expedito',async()=>{
 const {env,data,farms}=platformFixture(),r=record();const farm=env.FARM_STORE.get(env.FARM_STORE.idFromName(LEGACY_PROPERTY_ID));await farm.fetch(new Request('https://internal/import',{method:'POST',body:JSON.stringify({data:{birds:[123,45,0,0,0],records:[r]},revision:0})}));
 data.set('user:legacy',{username:'Legacy',name:'Equipe antiga',role:'operator',active:true,revision:1,credentials:{}});const root=await login(env);const state=await (await call(env,'/api/farm',undefined,root)).json();assert.deepEqual(state.birds,[123,45,0,0,0]);assert.equal(state.records[0].id,r.id);assert.equal(state.records[0].propertyId,LEGACY_PROPERTY_ID);assert.equal(data.get('member:legacy:'+LEGACY_PROPERTY_ID).role,'operator');assert.equal(farms.has('property:'+LEGACY_PROPERTY_ID),false);
 const newcomer=await register(env,'NewOwner','Sítio Novo');assert.equal(newcomer.auth.data.properties.some(p=>p.property.id===LEGACY_PROPERTY_ID),false);assert.equal((await call(env,'/api/farm',undefined,newcomer.auth,LEGACY_PROPERTY_ID)).status,403);
});
test('general administrator manages properties while local metadata, balances, users and assistant context remain scoped',async()=>{
 const {env}=platformFixture(),owner=await register(env,'Multi','Primeira');owner.auth=await login(env);const second={...creation('Segunda',[7,2,0,0,0]),administrator:{username:'SecondOwner',name:'Segundo responsável',password:crypto.randomUUID()}};assert.equal((await call(env,'/api/properties',second,owner.auth)).status,201);assert.equal((await call(env,'/api/properties',second,owner.auth)).status,201);
 const modified={...profile('Segunda personalizada'),feedingRates:{inicio:45,crescimento:80,postura:115,engorda:130}};assert.equal((await call(env,'/api/properties/update',modified,owner.auth,second.id)).status,200);
 const context=await (await call(env,'/api/assistant/context',undefined,owner.auth,second.id)).json();assert.equal(context.propertyId,second.id);assert.equal(context.property.name,modified.name);assert.equal(context.feedingRates.postura,115);assert.equal(context.flock.total,9);
 const first=await (await call(env,'/api/farm',undefined,owner.auth,owner.property.id)).json();assert.equal(first.property.name,'Primeira');assert.equal(first.property.feedingRates.postura,110);
 const user={username:'OnlySecond',name:'Equipe segunda',role:'operator',password:crypto.randomUUID()};assert.equal((await call(env,'/api/users',user,owner.auth,second.id)).status,201);const firstUsers=await (await call(env,'/api/users',undefined,owner.auth,owner.property.id)).json();assert.equal(firstUsers.users.some(u=>u.username===user.username),false);const operator=await login(env,user.username,user.password);assert.equal((await call(env,'/api/farm',undefined,operator,owner.property.id)).status,403);assert.equal((await call(env,'/api/properties/update',modified,operator,second.id)).status,403);
});
test('each property owns an independent daily-consumption alarm and configured rates preserve prior history',async()=>{
 const {env,farms}=platformFixture(),owner=await register(env,'FeedOwner','Ração A'),other=creation('Ração B',[10,5,0,0,0]);await call(env,'/api/properties',{...other,administrator:{username:'FeedOther',name:'Outro responsável',password:crypto.randomUUID()}},await login(env));
 const initialize={id:crypto.randomUUID(),action:'initialize',revision:1,ingredients:[],rations:[{recipe:'inicio',kg:20}]};assert.equal((await call(env,'/api/farm/feed',initialize,owner.auth,owner.property.id)).status,200);const plan={id:crypto.randomUUID(),action:'plan',plan:{id:crypto.randomUUID(),name:'Pintinhos',shed:1,recipe:'inicio',mode:'shed'}};assert.equal((await call(env,'/api/farm/feed',plan,owner.auth,owner.property.id)).status,200);
 const fixture=farms.get('property:'+owner.property.id);assert.ok(await fixture.ctx.storage.getAlarm());let a=await fixture.object.read();const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});a.feed.plans[0].startDay=addDays(today,-1);a.feed.plans[0].lastClosedDay=addDays(today,-2);const {initialized,revision,...data}=a;await fixture.object.write(data,revision);
 const updated={...owner.property.profile,feedingRates:{...DEFAULT_FEEDING_RATES,inicio:50}};assert.equal((await call(env,'/api/properties/update',updated,owner.auth,owner.property.id)).status,200);a=await fixture.object.read();assert.equal(a.feed.daily[0].grams,40);assert.equal(dailyForecast(a)[0].grams,50);const after=settleFeed(a,addDays(today,1));assert.equal(after.feed.daily.find(e=>e.day===today).grams,50);
 const b=await (await call(env,'/api/farm',undefined,owner.auth,other.id)).json();assert.equal(b.feed,undefined);assert.equal(await farms.get('property:'+other.id).ctx.storage.getAlarm(),null);
 const restored=new FarmStore(fixture.ctx);await restored.alarm();assert.equal((await restored.read()).propertyId,owner.property.id);
});
test('only the general administrator provisions properties; public and local escalation are denied',async()=>{
 const {env}=platformFixture(),owner=await register(env,'LocalAdmin','Privada'),root=await login(env),attempt={...creation('Não autorizada'),administrator:{username:'Escalation',name:'Teste',password:crypto.randomUUID()}};
 assert.equal(root.data.generalAdministrator,true);assert.equal(owner.auth.data.generalAdministrator,false);
 assert.equal((await call(env,'/api/auth/register',{username:'Public',name:'Teste',password:crypto.randomUUID(),property:creation('Pública')})).status,403);
 assert.equal((await call(env,'/api/properties',attempt,owner.auth)).status,403);
 assert.equal((await call(env,'/api/properties',attempt)).status,401);
 const list=await (await call(env,'/api/properties',undefined,owner.auth)).json();assert.equal(list.properties.length,1);assert.equal(list.properties[0].property.id,owner.property.id);
 assert.equal((await call(env,'/api/farm',undefined,root,owner.property.id)).status,200);
 assert.equal((await call(env,'/api/users',{username:'EquipeLocal',name:'Equipe',role:'operator',password:crypto.randomUUID()},owner.auth,owner.property.id)).status,201);
 assert.equal((await call(env,'/api/properties/update',profile('Perfil editado'),owner.auth,owner.property.id)).status,200);
});
test('a root flag alone cannot elevate another username inside the property directory',async()=>{
 const {env}=platformFixture(),owner=await register(env,'TenantAdmin','Propriedade exclusiva');
 const stub=env.ADMIN_SESSIONS.get(env.ADMIN_SESSIONS.idFromName('admin-sessions'));
 const internal=(path,body)=>stub.fetch(new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)}));
 const actor={username:'TenantAdmin',root:true,rootUsername:'Talitom'};
 const response=await internal('/properties/create',{...actor,data:{...creation('Bloqueada'),administrator:{username:'NoAccess',name:'Teste',password:crypto.randomUUID()}}});assert.equal(response.status,403);
 const listed=await (await internal('/properties/list',actor)).json();assert.equal(listed.length,1);assert.equal(listed[0].property.id,owner.property.id);
 assert.equal((await internal('/properties/access',{...actor,propertyId:LEGACY_PROPERTY_ID})).status,403);
});
test('only general administrator deletes a property; revocation, purge and retry preserve other farms',async()=>{
 const {env,data,farms}=platformFixture(),root=await login(env),owner=await register(env,'DeleteOwner','Excluir'),other=await register(env,'KeepOwner','Manter'),id=owner.property.id;
 await call(env,'/api/farm/records',record(),owner.auth,id);
 const deletion={propertyId:id,confirmation:id};
 assert.equal((await call(env,'/api/properties/delete',deletion,owner.auth)).status,403);
 assert.equal((await call(env,'/api/properties/delete',deletion,{cookie:root.cookie})).status,403);
 assert.equal((await call(env,'/api/properties/delete',{...deletion,confirmation:other.property.id},root)).status,400);
 assert.equal((await call(env,'/api/properties/delete',deletion,root)).status,200);
 assert.equal(data.get('member:deleteowner:'+id),undefined);assert.equal(data.get('user:deleteowner').active,false);
 const fixture=farms.get('property:'+id);assert.equal(await fixture.ctx.storage.get('meta'),undefined);assert.equal(await fixture.ctx.storage.get('profile'),undefined);assert.equal(await fixture.ctx.storage.get('chunk:0'),undefined);assert.equal(await fixture.ctx.storage.getAlarm(),null);
 await fixture.object.alarm();assert.equal(await fixture.ctx.storage.get('meta'),undefined);
 assert.equal((await fixture.object.fetch(new Request('https://internal/read',{method:'POST',body:JSON.stringify({propertyId:id,initialProperty:{...owner.property.profile,id}})}))).status,410);
 assert.equal((await call(env,'/api/farm',undefined,owner.auth,id)).status,401);
 assert.equal((await call(env,'/api/farm',undefined,root,id)).status,403);
 const listed=await (await call(env,'/api/properties',undefined,root)).json();assert.equal(listed.properties.some(p=>p.property.id===id),false);
 assert.equal((await call(env,'/api/farm',undefined,other.auth,other.property.id)).status,200);
 assert.equal((await call(env,'/api/properties/delete',deletion,root)).status,200);
});
test('eight-character credentials are accepted, seven rejected for property and user creation',async()=>{
 const {env}=platformFixture(),root=await login(env),property=creation('Senha curta');
 const administrator={username:'EightChars',name:'Administrador',password:'Abcd123!'};
 assert.equal((await call(env,'/api/properties',{...property,administrator:{...administrator,password:'Abcd12!'}},root)).status,400);
 assert.equal((await call(env,'/api/properties',{...property,administrator},root)).status,201);
 const local=await login(env,administrator.username,administrator.password);
 assert.equal((await call(env,'/api/users',{username:'Worker8',name:'Operador',role:'operator',password:'Abcd123!'},local,property.id)).status,201);
 assert.equal((await call(env,'/api/users',{username:'Worker7',name:'Operador',role:'operator',password:'Abcd12!'},local,property.id)).status,400);
});
test('interrupted purge stays visible to general administrator and retry completes safely',async()=>{
 const {env,farms}=platformFixture(),root=await login(env),owner=await register(env,'PurgeRetry','Retentativa'),id=owner.property.id,fixture=farms.get('property:'+id),deletion={propertyId:id,confirmation:id};
 fixture.setFail(true);assert.equal((await call(env,'/api/properties/delete',deletion,root)).status,500);
 const pending=await (await call(env,'/api/properties',undefined,root)).json();assert.equal(pending.properties.find(p=>p.property.id===id).deletionPending,true);
 fixture.setFail(false);assert.equal((await call(env,'/api/properties/delete',deletion,root)).status,200);
 const completed=await (await call(env,'/api/properties',undefined,root)).json();assert.equal(completed.properties.some(p=>p.property.id===id),false);
});
test('deleting the legacy farm does not recreate it or prevent general administrator login',async()=>{
 const {env}=platformFixture(),root=await login(env),deletion={propertyId:LEGACY_PROPERTY_ID,confirmation:LEGACY_PROPERTY_ID};
 assert.equal((await call(env,'/api/properties/delete',deletion,root)).status,200);
 const session=await login(env);assert.equal(session.data.generalAdministrator,true);assert.deepEqual(session.data.properties,[]);
 const pending=[];await worker.scheduled({},env,{waitUntil(promise){pending.push(promise)}});await Promise.all(pending);
 assert.equal((await call(env,'/api/farm',undefined,session)).status,403);
});
test('shed lifecycle preserves stable history and transfers birds atomically with owner password confirmation',async()=>{
 const {env}=platformFixture();env.LOGIN_LIMITER={limit:async()=>({success:true})};const owner=await register(env,'ShedOwner','Galpões'),auth=owner.auth,pid=owner.property.id;
 const farm=async()=> (await call(env,'/api/farm',undefined,auth,pid)).json();
 let state=await farm();let command={id:crypto.randomUUID(),action:'create',revision:state.revision,name:'Postura nova'};
 let response=await call(env,'/api/farm/sheds',command,auth,pid);assert.equal(response.status,200);state=await response.json();assert.equal(state.birds.length,6);assert.equal(state.sheds[5].name,'Postura nova');
 assert.equal((await call(env,'/api/farm/sheds',command,auth,pid)).status,200);
 response=await call(env,'/api/farm/records',{id:crypto.randomUUID(),type:'Transferência',category:'Transferência',qty:5,value:0,date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),note:'Para o novo galpão',from:1,to:5},auth,pid);assert.equal(response.status,200);state=await response.json();
 command={id:crypto.randomUUID(),action:'edit',revision:state.revision,shed:5,name:'Postura editada'};response=await call(env,'/api/farm/sheds',command,auth,pid);assert.equal(response.status,200);state=await response.json();
 const deletion={id:crypto.randomUUID(),action:'delete',revision:state.revision,shed:5,password:owner.password};
 assert.equal((await call(env,'/api/farm/sheds',{...deletion,password:'WrongPassword'},auth,pid)).status,403);
 assert.equal((await call(env,'/api/farm/sheds',deletion,auth,pid)).status,409);
 assert.equal((await call(env,'/api/farm/sheds',{...deletion,destination:5},auth,pid)).status,409);
 response=await call(env,'/api/farm/sheds',{...deletion,destination:2},auth,pid);assert.equal(response.status,200);state=await response.json();assert.equal(state.birds[5],0);assert.equal(state.birds[2],5);assert.equal(state.sheds[5].active,false);assert.equal(state.records.at(-1).from,5);assert.equal(state.records.at(-1).to,2);
 assert.equal((await call(env,'/api/farm/sheds',{...deletion,destination:2},auth,pid)).status,200);
 assert.equal((await call(env,'/api/farm/records',{id:crypto.randomUUID(),type:'Nascimento',category:'Nascimento',qty:1,value:0,date:state.records.at(-1).date,note:'Inválido',to:5},auth,pid)).status,409);
 assert.equal(JSON.stringify(state).includes(owner.password),false);
 response=await call(env,'/api/farm/sheds',{id:crypto.randomUUID(),action:'create',revision:state.revision,name:'Outro'},auth,pid);state=await response.json();assert.equal(state.sheds.at(-1).id,6);assert.equal(state.sheds[5].name,'Postura editada');
});
test('operators and other tenants cannot manage sheds; stale state and zero slot deletion are rejected',async()=>{
 const {env}=platformFixture(),owner=await register(env,'ShedAdmin','Local'),other=await register(env,'OtherShed','Outro'),pid=owner.property.id;
 const user={username:'ShedOperator',name:'Equipe',role:'operator',password:crypto.randomUUID()};await call(env,'/api/users',user,owner.auth,pid);const operator=await login(env,user.username,user.password);
 const command={id:crypto.randomUUID(),action:'create',revision:1,name:'Novo galpão'};
 assert.equal((await call(env,'/api/farm/sheds',command,operator,pid)).status,403);
 assert.equal((await call(env,'/api/farm/sheds',command,other.auth,pid)).status,403);
 assert.equal((await call(env,'/api/farm/sheds',command,{cookie:owner.auth.cookie},pid)).status,403);
 assert.equal((await call(env,'/api/farm/sheds',{...command,revision:0},owner.auth,pid)).status,409);
 assert.equal((await call(env,'/api/farm/sheds',{id:crypto.randomUUID(),action:'delete',revision:1,shed:0,password:owner.password},owner.auth,pid)).status,400);
});
