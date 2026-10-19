import { isNucleus, ingredientPriceKey, nucleusConcentrations } from './feed-items.js';
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
let active='inicio',corn='25',birds='';
const concentrations=Object.fromEntries(recipes.map(r=>[r.id,4]));
const number=(n,digits=3)=>n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const label=n=>n==='Quirera de milho'?'Quirera de milho ou fubá':n==='Núcleo de crescimento'?'Núcleo de crescimento (recria)':n;
export function feedMarkup(){return `<section class="guidehero"><div><span class="tag">RECEITAS DA SANTO EXPEDITO</span><h2>Quatro rações.<br>Uma base de 25 kg de milho.</h2><p>Suas formulações, proporcionais à quantidade de milho que você vai usar. Consulte os ingredientes e estime o custo da mistura.</p></div><span class="guidebook" aria-hidden="true">♧</span></section><div class="recipecards" role="group" aria-label="Selecionar receita">${recipes.map(r=>`<button class="recipecard" data-recipe="${r.id}" aria-pressed="${active===r.id}"><span>${r.age}</span><strong>${r.name}</strong><small><span data-recipe-total="${r.id}">${number(calculateMix(r,25,concentrations[r.id]).total)}</span> kg por base de 25 kg de milho · núcleo <span data-recipe-concentration="${r.id}">${concentrations[r.id]}</span>%</small><b>${r.daily} g por ave/dia</b></button>`).join('')}</div><section class="panel mixpanel"><div class="sectiontitle"><h2 id="mixheading">Calcular mistura</h2><span>Base ajustável</span></div><div class="mixinputs"><label for="cornkg">Milho usado como base (kg)<input id="cornkg" type="number" min="0.001" step="0.001" value="${corn}" required></label><label for="mixconcentration">Concentração do núcleo<select id="mixconcentration" required>${nucleusConcentrations.map(c=>`<option value="${c}" ${concentrations[active]===c?'selected':''}>${c}% (${c*10} kg por tonelada)</option>`).join('')}</select></label><label for="feedbirds">Aves que receberão esta ração <span class="muted">(opcional)</span><input id="feedbirds" type="number" min="1" step="1" value="${birds}" placeholder="Informe apenas as aves deste lote"></label></div><p id="mixerror" class="mixerror" role="alert"></p><div id="mixresult" aria-live="polite"></div></section><section class="panel recipesource"><span class="tag">COMO ESTA CONTA É FEITA</span><p>Receitas-base a 4% e consumo diário fornecidos pelo proprietário. O milho e as quantidades de soja, trigo e calcário da receita-base são mantidos na escala escolhida. Núcleo (kg) = soma dos demais ingredientes × concentração ÷ (100 − concentração). O total e os percentuais finais mudam conforme a concentração; os kg são exibidos com três casas decimais e podem ter pequenas diferenças na soma por arredondamento.</p><p>Início: 1 a 56 dias. Crescimento: 57 a 126 dias. Postura: a partir de 127 dias. A seleção é manual e não altera a fase das aves. “Núcleo recria” foi associado a “Núcleo de crescimento” para consultar as compras; confira se correspondem ao mesmo produto utilizado.</p><p><b>Confira o núcleo antes de misturar:</b> selecione o percentual de inclusão indicado para o produto (3%, 4% ou 5%). As receitas originais usam 4%. O cálculo ajusta a massa de núcleo para o percentual escolhido na ração final e usa somente o preço de compras da mesma fase e concentração. A inclusão pode variar entre produtos e fabricantes, como você observou. Este ajuste é matemático e não valida o balanceamento nutricional. Confira no rótulo e com assistência técnica se o produto pode ser usado nessa mistura, mantendo os demais ingredientes; marcas e concentrações diferentes podem exigir outra receita.</p><p>Este cálculo é uma simulação. Não registra produção de ração, não baixa estoque e não lança nova despesa. O custo estimado usa a média ponderada das compras registradas, sem incluir mão de obra, energia ou perdas. Não é uma cotação atual.</p></section>`}
export function bindFeed(records){
  if(!document.querySelector('#mixresult'))return;
  const prices=ingredientPrices(records);
  const priceKey=ingredient=>ingredientPriceKey(ingredient,concentrations[active]);
  const update=()=>{
    const recipe=recipes.find(r=>r.id===active);
    document.querySelector('#mixheading').textContent=`Mistura de ${recipe.name.toLowerCase()}`;
    document.querySelector('#mixconcentration').value=String(concentrations[active]);
    document.querySelectorAll('[data-recipe-total]').forEach(el=>el.textContent=number(calculateMix(recipes.find(r=>r.id===el.dataset.recipeTotal),25,concentrations[el.dataset.recipeTotal]).total));
    document.querySelectorAll('[data-recipe-concentration]').forEach(el=>el.textContent=concentrations[el.dataset.recipeConcentration]);
    document.querySelectorAll('[data-recipe]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.recipe===active)));
    const result=document.querySelector('#mixresult'),error=document.querySelector('#mixerror');
    error.textContent='';
    let mix;
    try{mix=calculateMix(recipe,Number(corn),concentrations[active]);if(birds!==''&&(!Number.isInteger(Number(birds))||Number(birds)<=0))throw Error('Informe uma quantidade inteira de aves maior que zero.')}catch(e){error.textContent=e.message;result.innerHTML='';return}
    const missing=mix.items.filter(i=>!prices.has(priceKey(i.ingredient)));
    const cost=mix.items.reduce((a,i)=>a+i.kg*(prices.get(priceKey(i.ingredient))||0),0);
    const demand=Number(birds)*recipe.daily/1000;
    result.innerHTML=`<div class="mixstats"><article><small>Total da mistura</small><strong>${number(mix.total)} kg</strong><span>Milho + demais ingredientes</span></article><article><small>Consumo informado</small><strong>${recipe.daily} g</strong><span>por ave / dia</span></article><article><small>Custo estimado da mistura</small><strong>${missing.length?'Preços pendentes':money(cost)}</strong><span>${missing.length?`${missing.length} ingrediente(s) sem preço cadastrado`:money(cost/mix.total)+' por kg'}</span></article></div><div class="tablewrap"><table><thead><tr><th>Ingrediente</th><th>Proporção</th><th>Quantidade</th><th>Preço médio / kg</th><th>Custo estimado</th></tr></thead><tbody>${mix.items.map(i=>`<tr><td>${label(i.ingredient)}${isNucleus(i.ingredient)?' · '+concentrations[active]+'%':''}</td><td>${number(i.percent)}%</td><td>${number(i.kg)} kg</td><td>${prices.has(priceKey(i.ingredient))?money(prices.get(priceKey(i.ingredient))):'Sem compra registrada'}</td><td>${prices.has(priceKey(i.ingredient))?money(prices.get(priceKey(i.ingredient))*i.kg):'—'}</td></tr>`).join('')}</tbody></table></div>${missing.length?'<p class="muted">Para obter o custo completo, registre as compras dos ingredientes que faltam em Novo registro → Despesa → Ração. Para núcleos, o preço precisa ser de compras com a mesma concentração selecionada na calculadora. Compras antigas sem ingrediente ou concentração não fornecem esse preço.</p>':''}${birds!==''?`<div class="mixdemand"><b>Estimativa para ${number(Number(birds),0)} aves desta fase</b><p>${number(demand)} kg de ração por dia · esta mistura rende aproximadamente ${number(mix.total/demand,1)} dias.</p><small>Base: ${recipe.daily} g por ave/dia, conforme a tabela fornecida por você. Não considera perdas nem substitui o acompanhamento do lote.</small></div>`:'<p class="muted">Informe as aves desta fase para estimar a necessidade diária e quantos dias a mistura pode durar. O plantel inteiro não é usado automaticamente.</p>'}`;
  };
  document.querySelector('#mixconcentration').addEventListener('change',e=>{concentrations[active]=Number(e.target.value);update()});
  document.querySelector('#cornkg').addEventListener('input',e=>{corn=e.target.value;update()});
  document.querySelector('#feedbirds').addEventListener('input',e=>{birds=e.target.value;update()});
  document.querySelectorAll('[data-recipe]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.recipe;update()}));
  update();
}
