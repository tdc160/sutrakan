import test from 'node:test';
import assert from 'node:assert/strict';
import {recipes,calculateMix,ingredientPrices} from '../feed.js';
import {ingredientPriceKey,isNucleus} from '../feed-items.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} differs from ${b}`);

test('all recipes keep the corn base and non-nucleus masses while achieving the selected final inclusion',()=>{
  for(const recipe of recipes){for(const corn of [12.5,25,50]){
    const original=calculateMix(recipe,corn,4);
    for(const concentration of [3,4,5]){
      const mix=calculateMix(recipe,corn,concentration);
      near(mix.items[0].kg,corn);
      near(mix.items.reduce((sum,i)=>sum+i.kg,0),mix.total);
      near(mix.items.reduce((sum,i)=>sum+i.percent,0),100);
      const nucleus=mix.items.find(i=>isNucleus(i.ingredient));
      near(nucleus.kg/mix.total*100,concentration);
      for(const item of mix.items.filter(i=>!isNucleus(i.ingredient)))near(item.kg,original.items.find(i=>i.ingredient===item.ingredient).kg);
    }
  }}
});

test('the original initial recipe is preserved at 4%, and 3%/5% use exact final-mass percentages',()=>{
  const initial=recipes.find(r=>r.id==='inicio');
  const base=calculateMix(initial,25,4);near(base.total,25/0.63);near(base.items[1].kg,25*33/63);
  const nonNucleus=25+25*33/63;
  near(calculateMix(initial,25,3).items.at(-1).kg,nonNucleus*3/97);
  near(calculateMix(initial,25,5).items.at(-1).kg,nonNucleus*5/95);
});

test('reject invalid quantities and unsupported concentration values',()=>{
  for(const corn of [0,-1,NaN,Infinity])assert.throws(()=>calculateMix(recipes[0],corn,4));
  for(const concentration of [0,2,6,NaN,'4'])assert.throws(()=>calculateMix(recipes[0],25,concentration));
});

test('historical prices separate nucleus phase and concentration, including legacy purchases',()=>{
  const purchase=(ingredient,concentration,qty,value)=>({type:'Despesa',category:'Ração',ingredient,concentration,qty,value});
  const prices=ingredientPrices([
    purchase('Núcleo de início',3,10,300),purchase('Núcleo de início',4,10,400),
    purchase('Núcleo de início',4,20,1000),purchase('Núcleo de início',5,10,500),
    purchase('Núcleo de início',undefined,10,900),purchase('Núcleo de postura',4,10,800),
    purchase('Quirera de milho',undefined,50,100),purchase('Quirera de milho',undefined,25,75),
    purchase('Milho em grão inteiro',undefined,50,500)
  ]);
  near(prices.get(ingredientPriceKey('Núcleo de início',3)),30);
  near(prices.get(ingredientPriceKey('Núcleo de início',4)),1400/30);
  near(prices.get(ingredientPriceKey('Núcleo de início',5)),50);
  near(prices.get(ingredientPriceKey('Núcleo de início')),90);
  near(prices.get(ingredientPriceKey('Núcleo de postura',4)),80);
  near(prices.get('Quirera de milho'),175/75);
  assert.equal(ingredientPrices([purchase('Núcleo de início',undefined,10,100)]).has(ingredientPriceKey('Núcleo de início',4)),false);
});
