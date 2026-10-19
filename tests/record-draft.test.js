import test from 'node:test';
import assert from 'node:assert/strict';
import {loadDraft,writeDraft,DRAFT_KEY} from '../record-draft.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data}};
test('draft round-trip preserves partially filled values and separate entries for each type',()=>{
 const storage=memory();const d={values:{type:'Despesa',date:'2026-10-19',note:'2 sacos'},byType:{Despesa:{category:'Ração',ingredient:'Núcleo de início',concentration:'3',qty:'',value:'95.50'},'Coleta de ovos':{qty:'27'}},updatedAt:'2026-10-19T15:00:00.000Z'};
 writeDraft(storage,d);assert.deepEqual(loadDraft(storage),d);
});
test('invalid or unavailable drafts do not erase stored records',()=>{
 const storage=memory();storage.setItem('santo-expedito-v1','existing records');storage.setItem(DRAFT_KEY,'broken json');assert.equal(loadDraft(storage),null);assert.equal(storage.getItem('santo-expedito-v1'),'existing records');
 assert.equal(loadDraft({getItem(){throw Error('unavailable')}}),null);
 storage.setItem(DRAFT_KEY,JSON.stringify({values:{type:'unknown'}}));assert.equal(loadDraft(storage),null);
});
test('draft write failure propagates so the form can preserve input and report failure',()=>{
 assert.throws(()=>writeDraft({setItem(){throw Error('QuotaExceeded')}},{values:{type:'Venda'}}),/QuotaExceeded/);
});
