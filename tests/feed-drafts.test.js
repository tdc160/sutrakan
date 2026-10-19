import test from 'node:test';
import assert from 'node:assert/strict';
import {createFeedDraftStore,FEED_DRAFT_KEY} from '../feed-drafts.js';
test('feed draft retains id and fields in memory through storage failure, and persists once available',()=>{
 const data=new Map();let fail=true;const store=createFeedDraftStore(()=>({getItem:key=>data.get(key)||null,setItem(key,value){if(fail)throw Error('quota');data.set(key,value)}}));const draft={id:crypto.randomUUID(),values:{recipe:'inicio',cornKg:'25',concentration:'3'}};
 assert.throws(()=>store.write('produce',draft),/quota/);assert.deepEqual(store.read().produce,draft);fail=false;store.write('produce',store.read().produce);const restored=createFeedDraftStore(()=>({getItem:key=>data.get(key)}));assert.deepEqual(restored.read().produce,draft);store.remove('produce');assert.equal(JSON.parse(data.get(FEED_DRAFT_KEY)).produce,undefined);
});
