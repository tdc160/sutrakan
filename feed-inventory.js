import {recipes,calculateMix} from './feed-model.js';
import {ingredientPriceKey,isNucleus} from './feed-items.js';
// Integer milligrams prevent cumulative floating point drift across batches and daily debits.
export const mg=kg=>Math.round(kg*1000000);
export const kg=milligrams=>milligrams/1000000;
export const addDays=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function inventory(state){const feed=state.feed,raw=new Map(),rations=new Map(recipes.map(r=>[r.id,0]));if(!feed)return {raw,rations};
 const addRaw=(ingredient,concentration,amount)=>{const key=ingredientPriceKey(ingredient,concentration);raw.set(key,(raw.get(key)||0)+mg(amount))};
 for(const item of feed.openingIngredients)addRaw(item.ingredient,item.concentration,item.kg);
 for(const item of feed.openingRations)rations.set(item.recipe,(rations.get(item.recipe)||0)+mg(item.kg));
 for(const r of state.records.slice(feed.purchaseStart))if(r.type==='Despesa'&&r.category==='Ração'&&r.ingredient)addRaw(r.ingredient,r.concentration,r.qty);
 for(const batch of feed.productions){for(const item of batch.items)addRaw(item.ingredient,item.concentration,-item.kg);rations.set(batch.recipe,rations.get(batch.recipe)+mg(batch.totalKg))}
 for(const entry of feed.adjustments)if(entry.target==='ingredient')addRaw(entry.ingredient,entry.concentration,entry.deltaKg);else rations.set(entry.recipe,rations.get(entry.recipe)+mg(entry.deltaKg));
 for(const entry of feed.daily)if(entry.status==='posted')rations.set(entry.recipe,rations.get(entry.recipe)-mg(entry.kg));
 return {raw,rations};
}
export function batchIngredients(recipeId,cornKg,concentration){const recipe=recipes.find(r=>r.id===recipeId);if(!recipe)throw Error('invalid-recipe');const mix=calculateMix(recipe,cornKg,concentration);const items=mix.items.map(i=>({ingredient:i.ingredient,...(isNucleus(i.ingredient)?{concentration}:{}),kg:kg(mg(i.kg))}));return {items,totalKg:kg(items.reduce((sum,i)=>sum+mg(i.kg),0))}}
export function validatePlans(plans,birds){const active=plans.filter(p=>p.active);return new Set(active.map(p=>p.shed)).size===active.length&&active.every(p=>Number.isInteger(birds[p.shed])&&birds[p.shed]>=0)}
export function dailyForecast(state){return (state.feed?.plans||[]).filter(p=>p.active).map(p=>{const recipe=recipes.find(r=>r.id===p.recipe),birds=state.birds[p.shed];return {...p,birds,grams:recipe.daily,kg:birds*recipe.daily/1000,valid:validatePlans(state.feed.plans,state.birds)}})}
