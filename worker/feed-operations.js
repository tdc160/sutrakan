import {recipes} from '../feed-model.js';
import {inventory,batchIngredients,mg,kg,addDays,validatePlans} from '../feed-inventory.js';
import {ingredientPriceKey} from '../feed-items.js';
import {HttpError} from './security.js';
export function settleFeed(state,today,now=Date.now()){
 if(!state.feed)return state;const next=structuredClone(state),feed=next.feed,yesterday=addDays(today,-1);
 for(const plan of feed.plans.filter(p=>p.active)){
  let day=addDays(plan.lastClosedDay,1),count=0;
  // Bounded catch-up per invocation. The next run continues from lastClosedDay, never drops dates.
  while(day<=yesterday&&count++<31){if(day>=plan.startDay){const birds=state.birds[plan.shed],recipe=recipes.find(r=>r.id===plan.recipe);
    feed.daily.push({id:day+':'+plan.id,day,planId:plan.id,name:plan.name,shed:plan.shed,recipe:plan.recipe,birds,grams:recipe.daily,kg:birds*recipe.daily/1000,status:'pending'});
   }plan.lastClosedDay=day;day=addDays(day,1)}
 }
 const balances=inventory(next).rations,blocked=new Set();
 for(const event of [...feed.daily].sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id))){if(event.status==='posted')continue;const available=balances.get(event.recipe)||0,needed=mg(event.kg);
  if(needed===0||!blocked.has(event.recipe)&&available>=needed){event.status='posted';event.postedAt=now;delete event.reason;balances.set(event.recipe,available-needed)}else{event.reason='Ração insuficiente. A baixa permanece pendente, sem saldo negativo.';blocked.add(event.recipe)}
 }
 return next;
}
export function applyFeedAction(state,command,username,today,now=Date.now()){
 const serialized=JSON.stringify(command),receipt=state.feed?.receipts.find(r=>r.id===command.id);
 // A lost response can be retried with the same command ID; a changed payload cannot reuse it.
 if(receipt){if(receipt.command!==serialized)throw new HttpError(409);return state}
 let next=settleFeed(state,today,now),feed=next.feed;
 if(command.action==='initialize'){
  if(feed||command.revision!==state.revision)throw new HttpError(409);
  const rawKeys=command.ingredients.map(i=>ingredientPriceKey(i.ingredient,i.concentration));if(new Set(rawKeys).size!==rawKeys.length||new Set(command.rations.map(i=>i.recipe)).size!==command.rations.length)throw new HttpError(400);
  next=structuredClone(state);feed=next.feed={version:1,purchaseStart:state.records.length,openedAt:now,openedBy:username,openingIngredients:command.ingredients,openingRations:command.rations,plans:[],productions:[],adjustments:[],daily:[],receipts:[]};
 }else{
  if(!feed)throw new HttpError(409);
  if(command.action==='produce'){
   const batch=batchIngredients(command.recipe,command.cornKg,command.concentration),balances=inventory(next);
   if(batch.totalKg>1000000||batch.items.some(i=>mg(i.kg)<=0||(balances.raw.get(ingredientPriceKey(i.ingredient,i.concentration))||0)<mg(i.kg)))throw new HttpError(409);
   feed.productions.push({id:command.id,recipe:command.recipe,cornKg:command.cornKg,concentration:command.concentration,...batch,createdBy:username,createdAt:now});
  }
  if(command.action==='plan'){
   const existing=feed.plans.find(p=>p.id===command.plan.id);
   // Finish past days before changing the plan; no phase/count changes rewrite past consumption.
   if(existing&&existing.lastClosedDay<addDays(today,-1))throw new HttpError(409);
   const plan={...command.plan,active:true,startDay:today,lastClosedDay:addDays(today,-1)},plans=feed.plans.filter(p=>p.id!==plan.id).concat(plan);
   if(!validatePlans(plans,state.birds)||plans.length>100)throw new HttpError(409);feed.plans=plans;
  }
  if(command.action==='disable-plan'){const plan=feed.plans.find(p=>p.id===command.planId);if(!plan||plan.lastClosedDay<addDays(today,-1))throw new HttpError(409);plan.active=false}
  if(command.action==='adjust'){
   const balances=inventory(next),available=command.target==='ingredient'?(balances.raw.get(ingredientPriceKey(command.ingredient,command.concentration))||0):(balances.rations.get(command.recipe)||0);
   if(available+mg(command.deltaKg)<0||mg(command.deltaKg)===0)throw new HttpError(409);
   const {action,...fields}=command;feed.adjustments.push({...fields,createdBy:username,createdAt:now});
  }

 }
 feed.receipts.push({id:command.id,command:serialized,createdBy:username,createdAt:now});
 return settleFeed(next,today,now);
}
