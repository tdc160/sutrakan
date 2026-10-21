import test from 'node:test';
import assert from 'node:assert/strict';
import {setPropertyContext,scopedStorage,scopedKey} from '../property-context.js';
import {loadDraft,writeDraft,DRAFT_KEY} from '../record-draft.js';
import {LEGACY_PROPERTY_ID} from '../property-model.js';
test('drafts are namespaced by user/property and only the legacy property can recover an unscoped legacy draft',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};const legacy={values:{type:'Coleta de ovos',date:'2026-10-19',note:'antigo'},byType:{'Coleta de ovos':{qty:'12'}}};values.set(DRAFT_KEY,JSON.stringify(legacy));const id=crypto.randomUUID();
 setPropertyContext('Owner',{id});assert.equal(loadDraft(storage),null);const local={...legacy,values:{...legacy.values,note:'nova'}};writeDraft(storage,local);setPropertyContext('OtherOwner',{id});assert.equal(loadDraft(storage),null);setPropertyContext('Owner',{id:crypto.randomUUID()});assert.equal(loadDraft(storage),null);setPropertyContext('Owner',{id});assert.deepEqual(loadDraft(storage).values,local.values);
 setPropertyContext('Talitom',{id:LEGACY_PROPERTY_ID});assert.deepEqual(loadDraft(storage).values,legacy.values);assert.ok(values.get(scopedKey(DRAFT_KEY)));assert.equal(values.get(DRAFT_KEY),JSON.stringify(legacy));setPropertyContext(null,null);
});
