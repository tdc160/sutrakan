export const FEED_DRAFT_KEY='santo-expedito-feed-drafts-v1';
export function createFeedDraftStore(storageProvider){let memory=null;
 const read=()=>{if(memory)return structuredClone(memory);try{const value=JSON.parse(storageProvider().getItem(FEED_DRAFT_KEY));memory=value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{memory={}}return structuredClone(memory)};
 const persist=data=>{memory=data;storageProvider().setItem(FEED_DRAFT_KEY,JSON.stringify(data))};
 return {read,write(name,draft){const data=read();data[name]=draft;persist(data)},remove(name){const data=read();delete data[name];persist(data)}};
}
export const feedDraftStore=createFeedDraftStore(()=>globalThis.localStorage);
let activeCapture=null;
export function registerFeedDraftCapture(capture){activeCapture=capture}
export function preserveFeedDrafts(){return activeCapture?.()!==false}
if(typeof window!=='undefined'){
 addEventListener('pagehide',()=>preserveFeedDrafts());
 addEventListener('beforeunload',event=>{if(!preserveFeedDrafts()){event.preventDefault();event.returnValue=''}});
}
