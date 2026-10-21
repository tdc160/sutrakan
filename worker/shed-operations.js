import {shedsFor,activeShed,MAX_SHEDS} from '../shed-model.js';
import {shedCommandSchema} from '../security/shed-schemas.js';
import {localDay} from '../security/schemas.js';
import {addDays} from '../feed-inventory.js';
import {settleFeed} from './feed-operations.js';
import {HttpError} from './security.js';
export function applyShedCommand(state,input,username){
 const command=shedCommandSchema.parse(input),{password,...safe}=command,encoded=JSON.stringify(safe),previous=state.shedEvents?.find(e=>e.id===command.id);
 if(previous){if(previous.command!==encoded)throw new HttpError(409);return state}
 if(!state.initialized||command.revision!==state.revision||(state.shedEvents?.length||0)>=10000)throw new HttpError(409);
 // Close previous days with the old population before moving birds or stopping feeding.
 const next=structuredClone(settleFeed(state,localDay()));if(next.feed?.plans.some(p=>p.active&&p.lastClosedDay<addDays(localDay(),-1)))throw new HttpError(409);next.sheds=structuredClone(shedsFor(state));let id=command.shed;
 if(command.action==='create'){
  if(next.birds.length>MAX_SHEDS||next.sheds.some(s=>s.active&&s.name.toLocaleLowerCase()===command.name.toLocaleLowerCase()))throw new HttpError(409);
  id=next.birds.length;next.birds.push(0);next.sheds.push({id,name:command.name,active:true});
 }else{
  if(!activeShed(next,id))throw new HttpError(409);
  if(command.action==='edit'){if(next.sheds.some(s=>s.id!==id&&s.active&&s.name.toLocaleLowerCase()===command.name.toLocaleLowerCase()))throw new HttpError(409);next.sheds[id].name=command.name;if(next.feed)next.feed.plans=next.feed.plans.map(p=>p.shed===id&&p.active?{...p,name:command.name}:p)}
  else{
   const count=next.birds[id],to=command.destination;
   if(count&&(!activeShed(next,to)||to===id||next.birds[to]+count>1000000))throw new HttpError(409);
   if(count){next.birds[to]+=count;next.birds[id]=0;next.records.push({id:command.id,propertyId:state.propertyId,type:'Transferência',category:'Transferência',qty:count,value:0,date:localDay(),note:'Transferência ao excluir '+next.sheds[id].name,from:id,to,createdBy:username,createdAt:Date.now()})}
   next.sheds[id].active=false;
   if(next.feed)next.feed.plans=next.feed.plans.map(p=>p.shed===id?{...p,active:false}:p);
  }
 }
 next.shedEvents=[...(next.shedEvents||[]),{id:command.id,command:encoded,by:username,at:Date.now(),action:command.action,shed:id}];return next;
}
