import {inventory,mg,kg} from './feed-inventory.js';
import {recipes} from './feed-model.js';
import {feedItemLabel} from './feed-items.js';
export const reportDay=value=>new Date(value).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
export function reportRange(start,end){const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;if(!valid(start)||!valid(end)||start>end||end>reportDay(Date.now()))throw Error('Informe um período válido, sem datas futuras.');return {start,end}}
export function financialReport(state,start,end){reportRange(start,end);const rows=state.records.filter(r=>['Venda','Despesa'].includes(r.type)&&r.date>=start&&r.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date));let income=0,expense=0;const groups=new Map();for(const row of rows){const cents=Math.round(row.value*100);if(row.type==='Venda')income+=cents;else expense+=cents;const key=row.type+' · '+row.category;groups.set(key,(groups.get(key)||0)+cents)}return {rows,income:income/100,expense:expense/100,balance:(income-expense)/100,groups:[...groups].map(([group,cents])=>({group,value:cents/100}))}}
export function stockReport(state,start,end){reportRange(start,end);if(!state.feed)return null;const feed=state.feed,balances=inventory(state),movements=[],phase=id=>recipes.find(r=>r.id===id)?.name||id;
 const add=(date,item,kind,delta,by='',reference='')=>{if(delta!==0&&date>=start&&date<=end)movements.push({date,item,kind,deltaKg:kg(mg(delta)),by,reference})};
 const openingDay=reportDay(feed.openedAt);for(const item of feed.openingIngredients)add(openingDay,feedItemLabel(item),'Saldo de abertura',item.kg,feed.openedBy);for(const item of feed.openingRations)add(openingDay,'Ração '+phase(item.recipe),'Saldo de abertura',item.kg,feed.openedBy);
 for(const record of state.records.slice(feed.purchaseStart))if(record.type==='Despesa'&&record.category==='Ração'&&record.ingredient)add(record.createdAt?reportDay(record.createdAt):record.date,feedItemLabel(record),'Compra',record.qty,record.createdBy,record.date);
 for(const batch of feed.productions){const day=reportDay(batch.createdAt);for(const item of batch.items)add(day,feedItemLabel(item),'Uso na mistura',-item.kg,batch.createdBy);add(day,'Ração '+phase(batch.recipe),'Produção',batch.totalKg,batch.createdBy)}
 for(const entry of feed.adjustments)add(reportDay(entry.createdAt),entry.target==='ingredient'?feedItemLabel(entry):'Ração '+phase(entry.recipe),'Ajuste',entry.deltaKg,entry.createdBy,entry.reason);
 for(const entry of feed.daily)if(entry.status==='posted')add(entry.postedAt?reportDay(entry.postedAt):entry.day,'Ração '+phase(entry.recipe),'Consumo diário',-entry.kg,'Rotina automática',entry.day+' · '+entry.name);
 const raw=[...balances.raw].map(([key,value])=>({item:key.replace(/::(3|4|5)$/,' · $1%').replace('::unknown',' · concentração não informada'),kind:'Ingrediente',kg:kg(value)})),rations=[...balances.rations].map(([id,value])=>({item:'Ração '+phase(id),kind:'Ração pronta',kg:kg(value)}));
 return {balances:[...raw,...rations],movements:movements.sort((a,b)=>a.date.localeCompare(b.date)),pending:feed.daily.filter(e=>e.status==='pending').map(e=>({...e,item:'Ração '+phase(e.recipe)}))};
}
// Spreadsheet cells containing user text must never be interpreted as formulas.
export function reportCSV(rows){return '\uFEFF'+rows.map(row=>row.map(value=>{let text=typeof value==='number'?String(value).replace('.',','):String(value??'');if(typeof value!=='number'&&/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}).join(';')).join('\r\n')}

const daysBetween=(start,end)=>Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;
const cents=value=>Math.round(value*100);
export function abcReport(state,start,end){
 const financial=financialReport(state,start,end),items=new Map();
 for(const r of financial.rows.filter(r=>r.type==='Despesa')){const label=r.category==='Ração'?feedItemLabel(r):r.expenseItemName||r.category+' (sem item detalhado)',key=r.category+'\u0000'+(r.expenseItemId||'')+'\u0000'+label;const item=items.get(key)||{name:label,group:r.category,cents:0,count:0};item.cents+=cents(r.value);item.count++;items.set(key,item)}
 let accumulated=0;const total=cents(financial.expense),rows=[...items.values()].sort((a,b)=>b.cents-a.cents||a.name.localeCompare(b.name,'pt-BR')).map(item=>{const before=accumulated,category=total?(before/total<.8?'A':before/total<.95?'B':'C'):'C';accumulated+=item.cents;return {...item,value:item.cents/100,share:total?item.cents/total*100:0,cumulative:total?accumulated/total*100:0,category}});
 return {total:financial.expense,rows,classes:['A','B','C'].map(category=>{const selected=rows.filter(r=>r.category===category);return {category,items:selected.length,value:selected.reduce((s,r)=>s+r.cents,0)/100}})};
}
export function flockReport(state,start,end){
 reportRange(start,end);const opening=[...state.birds],closing=[...state.birds],rows=state.records.filter(r=>r.date>=start&&r.date<=end),daily=new Map(),dailySlots=new Map(),byShed=state.birds.map((current,id)=>({id,current,births:0,deaths:0,sold:0,incoming:0,outgoing:0}));let births=rows.filter(r=>r.type==='Nascimento').reduce((s,r)=>s+r.qty,0),deaths=rows.filter(r=>r.type==='Mortalidade').reduce((s,r)=>s+r.qty,0),sold=rows.filter(r=>r.type==='Venda'&&r.category!=='Ovos').reduce((s,r)=>s+r.qty,0),legacyMissing=false;
 for(const r of state.records){if(r.date<start)continue;let deltas=[];if(r.type==='Nascimento')deltas=[[r.to??1,r.qty]];else if(r.type==='Mortalidade'||r.type==='Venda'&&r.category!=='Ovos')deltas=[[r.from??0,-r.qty]];else if(r.type==='Transferência')deltas=[[r.from??0,-r.qty],[r.to??1,r.qty]];if(!deltas.length)continue;if(deltas.length&&((r.type==='Nascimento'&&r.to===undefined)||(r.type!=='Nascimento'&&r.from===undefined)||(r.type==='Transferência'&&r.to===undefined)))legacyMissing=true;if(deltas.some(([id])=>opening[id]===undefined)){legacyMissing=true;continue}
  for(const [id,delta] of deltas){if(r.date>=start)opening[id]-=delta;if(r.date>end)closing[id]-=delta}
  if(r.date<start||r.date>end)continue;
  const slots=dailySlots.get(r.date)||state.birds.map(()=>0);for(const [id,delta] of deltas)slots[id]+=delta;dailySlots.set(r.date,slots);
  daily.set(r.date,(daily.get(r.date)||0)+deltas.reduce((sum,[,n])=>sum+n,0));
  if(r.type==='Nascimento'){byShed[r.to??1].births+=r.qty}else if(r.type==='Mortalidade'){byShed[r.from??0].deaths+=r.qty}else if(r.type==='Venda'&&r.category!=='Ovos'){byShed[r.from??0].sold+=r.qty}else if(r.type==='Transferência'){byShed[r.from??0].outgoing+=r.qty;byShed[r.to??1].incoming+=r.qty}
 }
 const days=daysBetween(start,end),initial=opening.reduce((a,b)=>a+b,0),final=closing.reduce((a,b)=>a+b,0);let balance=initial,birdDays=initial*days,valid=!legacyMissing&&opening.every(n=>n>=0)&&closing.every(n=>n>=0);const evolution=[{date:start,change:0,birds:initial,kind:'Abertura estimada'}];
 const dailyBirds=[...opening];
 for(const [date,delta] of [...daily].sort(([a],[b])=>a.localeCompare(b))){dailySlots.get(date).forEach((n,i)=>dailyBirds[i]+=n);if(dailyBirds.some(n=>n<0))valid=false;balance+=delta;if(balance<0)valid=false;birdDays+=delta*daysBetween(date,end);evolution.push({date,change:delta,birds:balance,kind:'Saldo após movimentos do dia'})}
 evolution.push({date:end,change:0,birds:final,kind:'Fechamento estimado'});
 return {opening:initial,closing:final,current:state.birds.reduce((a,b)=>a+b,0),births,deaths,sold,days,birdDays:valid?birdDays:null,average:valid?birdDays/days:null,mortality:valid&&initial+births>0?deaths/(initial+births)*100:null,valid,evolution,byShed:byShed.map(s=>({...s,opening:opening[s.id],closing:closing[s.id]})),movements:rows.filter(r=>['Nascimento','Mortalidade','Transferência'].includes(r.type)||r.type==='Venda'&&r.category!=='Ovos')};
}
export function birdCostsReport(state,start,end){
 const finance=financialReport(state,start,end),flock=flockReport(state,start,end),groups=new Map(),perDay=new Map();let eggs=0,eggRevenue=0,birdRevenue=0,postedKg=0,pendingKg=0;
 for(const r of finance.rows){if(r.type==='Despesa')groups.set(r.category,(groups.get(r.category)||0)+cents(r.value));else if(r.category==='Ovos')eggRevenue+=cents(r.value);else birdRevenue+=cents(r.value)}
 for(const r of state.records)if(r.date>=start&&r.date<=end&&r.type==='Coleta de ovos')eggs+=r.qty;
 for(const entry of state.feed?.daily||[])if(entry.day>=start&&entry.day<=end){if(entry.status==='posted')postedKg+=mg(entry.kg);else pendingKg+=mg(entry.kg);const bucket=perDay.get(entry.recipe)||{recipe:entry.recipe,posted:0,pending:0};bucket[entry.status==='posted'?'posted':'pending']+=mg(entry.kg);perDay.set(entry.recipe,bucket)}
 const ratio=(value,base)=>base>0?value/base:null;
 return {finance,flock,eggs,eggRevenue:eggRevenue/100,birdRevenue:birdRevenue/100,perAverageBird:ratio(finance.expense,flock.average),perBirdDay:ratio(finance.expense,flock.birdDays),perSoldBird:ratio(finance.expense,flock.sold),perEgg:ratio(finance.expense,eggs),perDozen:eggs>0?finance.expense/eggs*12:null,revenuePerSoldBird:ratio(birdRevenue/100,flock.sold),postedKg:kg(postedKg),pendingKg:kg(pendingKg),feedPerBirdDay:ratio(kg(postedKg),flock.birdDays),consumption:[...perDay.values()].map(r=>({...r,posted:kg(r.posted),pending:kg(r.pending)})),groups:[...groups].map(([group,value])=>({group,value:value/100,perBird:ratio(value/100,flock.average),share:finance.expense?value/cents(finance.expense)*100:0}))};
}
export function financialInsights(state,start,end){
 const current=financialReport(state,start,end),months=new Map();for(const row of current.rows){const month=row.date.slice(0,7),bucket=months.get(month)||{month,income:0,expense:0};bucket[row.type==='Venda'?'income':'expense']+=cents(row.value);months.set(month,bucket)}
 const days=daysBetween(start,end),base=Date.parse(start+'T12:00:00Z'),priorStart=new Date(base-days*86400000).toISOString().slice(0,10),priorEnd=new Date(base-86400000).toISOString().slice(0,10),previous=/^\d{4}-/.test(priorStart)?financialReport(state,priorStart,priorEnd):null;
 return {months:[...months.values()].map(m=>({month:m.month,income:m.income/100,expense:m.expense/100,balance:(m.income-m.expense)/100})),previous,priorStart,priorEnd,margin:current.income?current.balance/current.income*100:null,expenseChange:previous?.expense?(current.expense-previous.expense)/previous.expense*100:null};
}
