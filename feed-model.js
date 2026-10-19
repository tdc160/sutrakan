import {isNucleus,ingredientPriceKey,nucleusConcentrations} from './feed-items.js';
export const recipes = [
  { id:'inicio', name:'Início', age:'01 a 56 dias', daily:40, parts:[['Quirera de milho',63],['Farelo de soja',33],['Núcleo de início',4]] },
  { id:'crescimento', name:'Crescimento', age:'57 a 126 dias', daily:70, parts:[['Quirera de milho',62],['Farelo de soja',20],['Farelo de trigo',14],['Núcleo de crescimento',4]] },
  { id:'postura', name:'Postura', age:'127 dias até o descarte', daily:110, parts:[['Quirera de milho',60],['Farelo de soja',23],['Farelo de trigo',5],['Calcário calcítico',8],['Núcleo de postura',4]] },
  { id:'engorda', name:'Engorda', age:'Fase sem idade informada', daily:120, parts:[['Quirera de milho',82],['Farelo de soja',14],['Núcleo de engorda',4]] }
];
export function calculateMix(recipe, cornKg, concentration=4) {
  if(!Number.isFinite(cornKg)||cornKg<=0)throw Error('Informe uma quantidade de milho maior que zero.');
  if(!nucleusConcentrations.includes(concentration))throw Error('Escolha uma concentração de núcleo de 3%, 4% ou 5%.');
  const baseTotal=cornKg/(recipe.parts[0][1]/100);
  const baseNucleus=recipe.parts.find(([name])=>isNucleus(name))[1];
  const otherKg=baseTotal*(100-baseNucleus)/100;
  const total=otherKg/(1-concentration/100);
  if(!Number.isFinite(total))throw Error('Quantidade acima do limite de cálculo.');
  return {total,concentration,items:recipe.parts.map(([ingredient,percent])=>{
    const kg=isNucleus(ingredient)?total*concentration/100:baseTotal*percent/100;
    return {ingredient,percent:isNucleus(ingredient)?concentration:kg/total*100,kg};
  })};
}
export function ingredientPrices(records){
  const groups=new Map();
  for(const r of records){if(r.type!=='Despesa'||r.category!=='Ração'||!r.ingredient)continue;const key=ingredientPriceKey(r.ingredient,r.concentration);const g=groups.get(key)||{qty:0,value:0};g.qty+=r.qty;g.value+=r.value;groups.set(key,g)}
  return new Map([...groups].filter(([,g])=>g.qty>0).map(([n,g])=>[n,g.value/g.qty]));
}
