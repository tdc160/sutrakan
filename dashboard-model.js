import {feedItemLabel} from './feed-items.js';
export const localToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const DAY=86400000;
const parseDate=s=>new Date(`${s}T00:00:00Z`);
const iso=d=>d.toISOString().slice(0,10);
export function dashboardRange(records,period,today=localToday(),start='',end=''){
  let from,to=today;
  if(period==='custom'){
    const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(parseDate(s).getTime())&&iso(parseDate(s))===s;
    if(!valid(start)||!valid(end))throw Error('Informe as duas datas do período.');
    if(start>end)throw Error('A data inicial deve ser anterior ou igual à data final.');
    if(end>today)throw Error('A data final não pode estar no futuro.');
    return {start,end};
  }
  if(period==='all')from=records.reduce((a,r)=>r.date<a?r.date:a,today);
  else if(period==='month')from=today.slice(0,7)+'-01';
  else if(['7','30','90'].includes(period))from=iso(new Date(parseDate(today).getTime()-(Number(period)-1)*DAY));
  else throw Error('Período inválido.');
  return {start:from,end:to};
}
export function dashboardData(state,{period='30',today=localToday(),start='',end='',expenseMode='category'}={}){
  const range=dashboardRange(state.records,period,today,start,end);
  const records=state.records.filter(r=>r.date>=range.start&&r.date<=range.end);
  const days=Math.round((parseDate(range.end)-parseDate(range.start))/DAY)+1;
  const monthly=days>62;
  const bucketKey=date=>monthly?date.slice(0,7):date;
  const buckets=new Map();
  let cursor=parseDate(monthly?range.start.slice(0,7)+'-01':range.start);
  const limit=parseDate(range.end);
  while(cursor<=limit){
    const key=bucketKey(iso(cursor));buckets.set(key,{key,income:0,expense:0,eggs:0,records:0});
    if(monthly)cursor.setUTCMonth(cursor.getUTCMonth()+1);else cursor=new Date(cursor.getTime()+DAY);
    // Bound chart density for unusually long histories; actual sums are computed independently.
    if(buckets.size>2400)throw Error('Período muito longo. Escolha um intervalo de até 200 anos.');
  }
  let income=0,expense=0,eggs=0;const categories=new Map(),sales=new Map();
  for(const r of records){const b=buckets.get(bucketKey(r.date));if(b)b.records++;
    if(r.type==='Venda'){income+=r.value;if(b)b.income+=r.value;sales.set(r.category,(sales.get(r.category)||0)+r.value)}
    if(r.type==='Despesa'){expense+=r.value;if(b)b.expense+=r.value;const name=expenseMode==='ingredient'&&r.category==='Ração'?feedItemLabel(r):r.category;categories.set(name,(categories.get(name)||0)+r.value)}
    if(r.type==='Coleta de ovos'){eggs+=r.qty;if(b)b.eggs+=r.qty}
  }
  return {range,records,days,monthly,buckets:[...buckets.values()],income,expense,balance:income-expense,eggs,categories:[...categories].sort((a,b)=>b[1]-a[1]),sales:[...sales].sort((a,b)=>b[1]-a[1]),birds:state.birds.reduce((a,b)=>a+b,0)};
}

export function recordTouchesFlock(record,index){
  if(record.type==='Nascimento')return record.to===index;
  if(record.type==='Mortalidade')return record.from===index;
  if(record.type==='Transferência')return record.from===index||record.to===index;
  return record.type==='Venda'&&record.category!=='Ovos'&&record.from===index;
}
