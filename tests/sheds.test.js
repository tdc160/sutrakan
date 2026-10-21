import test from 'node:test';import assert from 'node:assert/strict';
import {applyShedCommand} from '../worker/shed-operations.js';
import {backupSchema} from '../security/schemas.js';
import {addDays} from '../feed-inventory.js';
import {applyFeedAction} from '../worker/feed-operations.js';
import {localDay} from '../security/schemas.js';
const base=()=>({initialized:true,revision:1,birds:[0,10,0,0,0],records:[]});
test('shed deletion settles prior feeding days, stops only the source plan and preserves stock and totals',()=>{
 let state=base(),day=localDay();state=applyFeedAction(state,{id:crypto.randomUUID(),action:'initialize',revision:1,ingredients:[],rations:[{recipe:'inicio',kg:10}]},'Test',day);
 state=applyFeedAction(state,{id:crypto.randomUUID(),action:'plan',plan:{id:crypto.randomUUID(),name:'Origem',shed:1,recipe:'inicio',mode:'shed'}},'Test',addDays(day,-1));
 const result=applyShedCommand(state,{id:crypto.randomUUID(),revision:1,action:'delete',shed:1,destination:2,password:'SyntheticOnly'},'Test');
 assert.equal(result.feed.daily[0].birds,10);assert.equal(result.feed.daily[0].kg,.4);assert.equal(result.feed.plans[0].active,false);assert.equal(result.birds[2],10);assert.equal(result.birds[1],0);
 const {initialized,revision,...backup}=result;assert.equal(backupSchema.safeParse(backup).success,true);
});
test('malformed shed backups and overflowing transfers are rejected',()=>{
 const state=base();state.birds[2]=1000000;assert.throws(()=>applyShedCommand(state,{id:crypto.randomUUID(),revision:1,action:'delete',shed:1,destination:2,password:'SyntheticOnly'},'Test'));
 assert.equal(backupSchema.safeParse({birds:[0,1],records:[],sheds:[{id:0,name:'A distribuir',active:true},{id:1,name:'Excluído',active:false}]}).success,false);
});
test('empty sheds can be deleted without moving birds; deleting does not erase old references',()=>{
 const state=base();state.records=[{id:crypto.randomUUID(),type:'Transferência',category:'Transferência',qty:2,value:0,date:localDay(),note:'Antigo',from:2,to:1}];
 const result=applyShedCommand(state,{id:crypto.randomUUID(),revision:1,action:'delete',shed:2,password:'SyntheticOnly'},'Test');
 assert.equal(result.sheds[2].active,false);assert.equal(result.records.length,1);assert.equal(result.records[0].from,2);assert.deepEqual(result.birds,state.birds);
});
