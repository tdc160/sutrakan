import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFeedAction,settleFeed} from '../worker/feed-operations.js';
import {inventory,batchIngredients,mg,dailyForecast} from '../feed-inventory.js';
import {recipes} from '../feed-model.js';
import {ingredients,isNucleus,ingredientPriceKey} from '../feed-items.js';
import {backupSchema} from '../security/schemas.js';
import {feedActionSchema} from '../security/feed-schemas.js';
import {farmFixture} from './helpers/farm-fixture.js';
const today='2026-10-01',now=Date.parse(today+'T12:00:00Z');
const base=()=>({initialized:true,revision:1,birds:[200,70,10,5,2],records:[]});
const command=(action,fields={})=>feedActionSchema.parse({id:crypto.randomUUID(),action,...fields});
const act=(state,c,day=today)=>applyFeedAction(state,c,'Talitom',day,now);
const opening=(fields={})=>command('initialize',{revision:1,ingredients:ingredients.flatMap(ingredient=>isNucleus(ingredient)?[3,4,5].map(concentration=>({ingredient,concentration,kg:100})):[{ingredient,kg:100}]),rations:recipes.map(r=>({recipe:r.id,kg:100})),...fields});
const plan=(shed,recipe)=>command('plan',{plan:{id:crypto.randomUUID(),name:'Galpão '+shed,shed,recipe,mode:'shed'}});
const call=(object,path,body={})=>object.fetch(new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)}));
test('opening balance excludes previous purchases; later purchases enter matching ingredient/concentration only',()=>{
 const initial=base();initial.records=[{type:'Despesa',category:'Ração',ingredient:'Quirera de milho',qty:1000,value:900}];const c=opening(),state=act(initial,c);assert.equal(inventory(state).raw.get('Quirera de milho'),mg(100));
 state.records.push({type:'Despesa',category:'Ração',ingredient:'Quirera de milho',qty:25,value:30},{type:'Despesa',category:'Ração',ingredient:'Milho em grão inteiro',qty:50,value:40},{type:'Despesa',category:'Ração',ingredient:'Núcleo de início',concentration:3,qty:2,value:20});
 const stock=inventory(state);assert.equal(stock.raw.get('Quirera de milho'),mg(125));assert.equal(stock.raw.get('Milho em grão inteiro'),mg(150));assert.equal(stock.raw.get('Núcleo de início::3'),mg(102));assert.equal(stock.raw.get('Núcleo de início::4'),mg(100));assert.throws(()=>act(state,opening()),e=>e.status===409);
});
test('all recipes and 3/4/5% concentrations debit exact ingredient masses and credit conserved finished mass without expenses',()=>{
 for(const r of recipes)for(const concentration of [3,4,5]){let state=act(base(),opening());const c=command('produce',{recipe:r.id,cornKg:25,concentration}),expected=batchIngredients(r.id,25,concentration);state=act(state,c);const balances=inventory(state);for(const i of expected.items)assert.equal(balances.raw.get(ingredientPriceKey(i.ingredient,i.concentration)),mg(100)-mg(i.kg));assert.equal(balances.rations.get(r.id),mg(100)+mg(expected.totalKg));assert.equal(expected.items.reduce((n,i)=>n+mg(i.kg),0),mg(expected.totalKg));assert.equal(state.records.length,0);assert.equal(state.feed.productions.length,1);assert.equal(act(state,c),state);assert.throws(()=>act(state,{...c,cornKg:26}),e=>e.status===409)}
});
test('insufficient ingredients reject the whole production; whole corn or a different nucleus concentration cannot substitute',()=>{
 const state=act(base(),opening({ingredients:[{ingredient:'Milho em grão inteiro',kg:100},{ingredient:'Farelo de soja',kg:100},{ingredient:'Núcleo de início',concentration:3,kg:100}]})),before=structuredClone(state);
 assert.throws(()=>act(state,command('produce',{recipe:'inicio',cornKg:25,concentration:4})),e=>e.status===409);assert.deepEqual(state,before);
});
test('daily closure uses each formula rate, closes yesterday only, and cannot debit twice',()=>{
 let state=act(base(),opening());for(const [shed,recipe] of [[0,'postura'],[1,'inicio'],[2,'crescimento'],[3,'engorda']])state=act(state,plan(shed,recipe));assert.equal(state.feed.daily.length,0);state=settleFeed(state,'2026-10-02',now);const stock=inventory(state).rations;assert.equal(stock.get('postura'),mg(78));assert.equal(stock.get('inicio'),mg(97.2));assert.equal(stock.get('crescimento'),mg(99.3));assert.equal(stock.get('engorda'),mg(99.4));assert.equal(state.feed.daily.length,4);assert.equal(state.feed.daily.every(e=>e.day===today&&e.status==='posted'),true);assert.deepEqual(settleFeed(state,'2026-10-02',now),state);
 state.birds[0]=195;assert.equal(dailyForecast(state).find(p=>p.shed===0).birds,195);state=settleFeed(state,'2026-10-03',now);assert.equal(state.feed.daily.find(e=>e.day==='2026-10-02'&&e.shed===0).kg,21.45);
});
test('ration shortage stays pending without negative balance and is filled FIFO after production',()=>{
 let state=act(base(),opening({rations:[{recipe:'postura',kg:0}]}));state=act(state,plan(0,'postura'));state=settleFeed(state,'2026-10-03',now);assert.equal(state.feed.daily.length,2);assert.equal(state.feed.daily.every(e=>e.status==='pending'),true);assert.equal(inventory(state).rations.get('postura'),0);
 state=act(state,command('produce',{recipe:'postura',cornKg:25,concentration:4}),'2026-10-03');assert.equal(state.feed.daily[0].status,'posted');assert.equal(state.feed.daily[1].status,'pending');assert.equal(inventory(state).rations.get('postura'),mg(batchIngredients('postura',25,4).totalKg)-mg(22));
});
test('plan changes preserve closed-day recipe/counts, one plan per shed, and disabling preserves pending history',()=>{
 let state=act(base(),opening()),first=plan(1,'inicio');state=act(state,first);assert.throws(()=>act(state,plan(1,'engorda')),e=>e.status===409);
 state=act(state,command('plan',{plan:{...first.plan,recipe:'crescimento'}}),'2026-10-02');assert.equal(state.feed.daily[0].recipe,'inicio');assert.equal(state.feed.daily[0].kg,2.8);state=settleFeed(state,'2026-10-03',now);assert.equal(state.feed.daily[1].recipe,'crescimento');assert.equal(state.feed.daily[1].kg,4.9);
 state=act(state,command('disable-plan',{planId:first.plan.id}),'2026-10-03');state=settleFeed(state,'2026-10-05',now);assert.equal(state.feed.daily.length,2);
});
test('stock corrections require a reason, prevent negative balances, and never create financial records',()=>{
 let state=act(base(),opening());state=act(state,command('adjust',{target:'ingredient',ingredient:'Milho em grão inteiro',deltaKg:-2,reason:'Fornecido avulso'}));assert.equal(inventory(state).raw.get('Milho em grão inteiro'),mg(98));assert.equal(state.records.length,0);assert.throws(()=>act(state,command('adjust',{target:'ingredient',ingredient:'Milho em grão inteiro',deltaKg:-99,reason:'Perda'})),e=>e.status===409);assert.equal(feedActionSchema.safeParse({id:crypto.randomUUID(),action:'adjust',target:'ration',recipe:'inicio',deltaKg:1,reason:''}).success,false);
});
test('central transactions serialize competing batches and retain feed data when saving ordinary records and backups',async()=>{
 const {object}=farmFixture();await call(object,'/import',{data:{birds:[200,70,0,0,0],records:[]},revision:0});const c=opening({ingredients:[{ingredient:'Quirera de milho',kg:25},{ingredient:'Farelo de soja',kg:100},{ingredient:'Núcleo de início',concentration:4,kg:100}]});assert.equal((await call(object,'/feed',{command:c,username:'Talitom'})).status,200);
 const produce=()=>call(object,'/feed',{command:command('produce',{recipe:'inicio',cornKg:25,concentration:4}),username:'Equipe'});assert.deepEqual((await Promise.all([produce(),produce()])).map(r=>r.status),[200,409]);
 const record={id:crypto.randomUUID(),type:'Coleta de ovos',category:'Coleta de ovos',qty:2,value:0,date:today,note:''};assert.equal((await call(object,'/record',{record,username:'Equipe'})).status,200);const saved=await (await call(object,'/read')).json();assert.equal(saved.feed.productions.length,1);assert.equal(saved.records.length,1);const {initialized,revision,...data}=saved;assert.equal(backupSchema.safeParse(data).success,true);
});
test('scheduled Worker closes the prior day without a browser, and retries cannot debit twice',async()=>{
 const {default:worker}=await import('../worker/index.js');const {localDay}=await import('../security/schemas.js');const {addDays}=await import('../feed-inventory.js');const actualToday=localDay(),yesterday=addDays(actualToday,-1),{object}=farmFixture();
 let seeded=act(base(),opening(),yesterday);seeded=act(seeded,plan(1,'inicio'),yesterday);const {initialized,revision,...data}=seeded;await object.write(data,1);
 const env={FARM_STORE:{idFromName:name=>name,get:()=>({fetch:request=>object.fetch(request)})}},run=async()=>{const jobs=[];await worker.scheduled({},env,{waitUntil:job=>jobs.push(job)});await Promise.all(jobs)};
 await run();let saved=await (await call(object,'/read')).json();assert.equal(saved.feed.daily.length,1);assert.equal(saved.feed.daily[0].day,yesterday);assert.equal(saved.feed.daily[0].kg,2.8);assert.equal(inventory(saved).rations.get('inicio'),mg(97.2));const version=saved.revision;await run();saved=await (await call(object,'/read')).json();assert.equal(saved.revision,version);assert.equal(saved.feed.daily.length,1);
 const record={id:crypto.randomUUID(),type:'Nascimento',category:'Nascimento',qty:5,value:0,date:actualToday,note:'',to:1};assert.equal((await call(object,'/record',{record,username:'Equipe'})).status,200);saved=await (await call(object,'/read')).json();assert.equal(saved.feed.daily[0].birds,70);const following=settleFeed(saved,addDays(actualToday,1));assert.equal(following.feed.daily.find(e=>e.day===actualToday).birds,75);assert.equal(following.feed.daily.find(e=>e.day===actualToday).kg,3);
});
test('feed writes roll back both ingredients and finished ration when persistence fails',async()=>{
 const {object,setFail}=farmFixture();await call(object,'/import',{data:{birds:[200,70,0,0,0],records:[]},revision:0});await call(object,'/feed',{command:opening(),username:'Talitom'});const before=await (await call(object,'/read')).json();setFail(true);
 await assert.rejects(call(object,'/feed',{command:command('produce',{recipe:'inicio',cornKg:25,concentration:4}),username:'Equipe'}),/synthetic-storage-failure/);setFail(false);assert.deepEqual(await (await call(object,'/read')).json(),before);
});
