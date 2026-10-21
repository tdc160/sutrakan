import {LEGACY_PROPERTY_ID} from './property-model.js';
let current=null,user=null;
export const activeProperty=()=>current;
export const activePropertyId=()=>current?.id;
export const contextKey=()=>current&&user?user.toLowerCase()+':'+current.id:null;
export function setPropertyContext(username,property){const previous=contextKey();user=username||null;current=property||null;if(typeof document!=='undefined')document.title=current?current.name+' · Gestão Rural':'Gestão Rural';if(typeof window!=='undefined')dispatchEvent(new CustomEvent('property-context-change',{detail:{previous,current:contextKey()}}))}
export function scopedKey(base){const key=contextKey();return key?base+':'+key:typeof window==='undefined'?base:null}
export function scopedStorage(storage){return {getItem(base){const key=scopedKey(base);if(!key)return null;let value=storage.getItem(key);if(value===null&&current?.id===LEGACY_PROPERTY_ID){value=storage.getItem(base);if(value!==null)try{storage.setItem(key,value)}catch{}}return value},setItem(base,value){const key=scopedKey(base);if(!key)throw Error('Selecione uma propriedade.');storage.setItem(key,value)},removeItem(base){const key=scopedKey(base);if(key)storage.removeItem(key)}}}
