import test from 'node:test';
import assert from 'node:assert/strict';
import {FarmStore} from '../worker/farm.js';
import {farmFixture} from './helpers/farm-fixture.js';

const call=(object,path,body={})=>object.fetch(new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)}));
const record=(type='Coleta de ovos',fields={})=>({id:crypto.randomUUID(),type,category:type,qty:3,value:0,date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),note:'',...fields});
test('one-time import preserves current flock without replaying historic movements; survives instance restart',async()=>{
 const {object,ctx}=farmFixture();assert.equal((await (await call(object,'/read')).json()).initialized,false);
 const data={birds:[8,2,0,0,0],records:[record('Nascimento',{qty:2,to:1})]};assert.equal((await call(object,'/import',{data,revision:0})).status,200);
 assert.equal((await call(object,'/import',{data,revision:0})).status,409);const restored=await (await call(new FarmStore(ctx),'/read')).json();assert.deepEqual(restored.birds,data.birds);assert.equal(restored.records.length,1);
});
test('concurrent movements are serialized; retries are idempotent and payload changes conflict',async()=>{
 const {object}=farmFixture();await call(object,'/import',{data:{birds:[4,0,0,0,0],records:[]},revision:0});const r=record('Mortalidade',{from:0});
 const results=await Promise.all([call(object,'/record',{record:r,username:'a'}),call(object,'/record',{record:record('Mortalidade',{from:0}),username:'b'})]);assert.deepEqual(results.map(r=>r.status),[200,409]);
 assert.equal((await call(object,'/record',{record:r,username:'a'})).status,200);assert.equal((await call(object,'/record',{record:{...r,qty:1},username:'a'})).status,409);
 const state=await (await call(object,'/read')).json();assert.equal(state.records.length,1);assert.equal(state.records[0].createdBy,'a');assert.equal(state.revision,2);assert.equal(state.birds[0],1);
});
test('chunked atomic persistence preserves unicode and rolls back storage failures',async()=>{
 const {object,setFail}=farmFixture();const records=Array.from({length:250},()=>record('Coleta de ovos',{note:'🐔'.repeat(200)}));const data={birds:[1,2,3,4,5],records};
 assert.equal((await call(object,'/import',{data,revision:0})).status,200);assert.deepEqual((await (await call(object,'/read')).json()).records.map(({propertyId,...r})=>r),records);
 setFail(true);await assert.rejects(call(object,'/record',{record:record(),username:'a'}),/synthetic-storage-failure/);setFail(false);const restored=await (await call(object,'/read')).json();assert.equal(restored.revision,1);assert.equal(restored.records.length,250);
});
