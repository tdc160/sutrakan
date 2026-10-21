import {scopedStorage} from './property-context.js';
export const DRAFT_KEY='santo-expedito-record-draft-v1';
const types=['Coleta de ovos','Venda','Despesa','Nascimento','Mortalidade','Transferência'];
export function loadDraft(storage){
  try{const d=JSON.parse(scopedStorage(storage).getItem(DRAFT_KEY));if(!d||!types.includes(d.values?.type))return null;return {values:d.values,byType:d.byType||{},updatedAt:d.updatedAt}}catch{return null}
}
export function writeDraft(storage,draft){scopedStorage(storage).setItem(DRAFT_KEY,JSON.stringify(draft))}
