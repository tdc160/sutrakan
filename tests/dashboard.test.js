import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardData,dashboardRange,recordTouchesFlock} from '../dashboard-model.js';
const records=[
 {date:'2026-09-30',type:'Venda',category:'Ovos',qty:12,value:20},
 {date:'2026-10-01',type:'Venda',category:'Ovos',qty:30,value:60},
 {date:'2026-10-13',type:'Despesa',category:'Ração',ingredient:'Núcleo de início',concentration:3,qty:5,value:50},
 {date:'2026-10-19',type:'Despesa',category:'Ração',ingredient:'Núcleo de início',concentration:4,qty:10,value:80},
 {date:'2026-10-19',type:'Despesa',category:'Medicamentos',qty:1,value:20},
 {date:'2026-10-19',type:'Coleta de ovos',category:'Coleta de ovos',qty:120,value:0},
 {date:'2026-10-19',type:'Venda',category:'Pintinhos',qty:2,value:30,from:1},
];
const state={birds:[200,68,0,0,0],records};
test('7-day window includes both bounds and independently aggregates quantities and monetary values',()=>{
 const before=JSON.stringify(state);const d=dashboardData(state,{period:'7',today:'2026-10-19'});
 assert.deepEqual(d.range,{start:'2026-10-13',end:'2026-10-19'});assert.equal(d.buckets.length,7);
 assert.equal(d.income,30);assert.equal(d.expense,150);assert.equal(d.balance,-120);assert.equal(d.eggs,120);assert.equal(d.birds,268);
 assert.equal(d.buckets[0].expense,50);assert.equal(d.buckets.at(-1).expense,100);assert.equal(d.buckets[1].records,0);assert.equal(JSON.stringify(state),before);
});
test('custom one-day range and monthly selection use only matching records',()=>{
 const d=dashboardData(state,{period:'custom',today:'2026-10-19',start:'2026-10-19',end:'2026-10-19'});assert.equal(d.days,1);assert.equal(d.expense,100);assert.equal(d.income,30);
 const month=dashboardData(state,{period:'month',today:'2026-10-19'});assert.equal(month.income,90);assert.equal(month.days,19);
});
test('expense breakdown separates nucleus concentration and preserves all monetary totals',()=>{
 const d=dashboardData(state,{period:'all',today:'2026-10-19',expenseMode:'ingredient'});
 assert.ok(d.categories.some(([name,value])=>name==='Núcleo de início · 3%'&&value===50));
 assert.ok(d.categories.some(([name,value])=>name==='Núcleo de início · 4%'&&value===80));
 assert.equal(d.categories.reduce((sum,[,value])=>sum+value,0),d.expense);assert.equal(d.sales.reduce((sum,[,value])=>sum+value,0),d.income);
});
test('long histories use chronological monthly buckets and retain inclusive range',()=>{
 const d=dashboardData(state,{period:'90',today:'2026-10-19'});assert.equal(d.monthly,true);assert.deepEqual(d.buckets.map(b=>b.key),['2026-07','2026-08','2026-09','2026-10']);assert.equal(d.buckets[2].income,20);assert.equal(d.buckets[3].income,90);
});
test('empty records retain actual flock, zero indicators, and no synthetic transactions',()=>{
 const d=dashboardData({birds:[200,70,0,0,0],records:[]},{period:'30',today:'2026-10-19'});assert.equal(d.birds,270);assert.equal(d.records.length,0);assert.equal(d.income,0);assert.equal(d.eggs,0);assert.equal(d.buckets.length,30);
});
test('date validation rejects reversed, impossible, missing, or future custom dates',()=>{
 for(const [start,end] of [['2026-10-20','2026-10-19'],['2026-02-30','2026-10-19'],['','2026-10-19'],['2026-10-01','2026-10-20']])assert.throws(()=>dashboardRange(records,'custom','2026-10-19',start,end));
});
test('flock drill-down uses only relevant origin and destination fields',()=>{
 assert.equal(recordTouchesFlock({type:'Nascimento',from:0,to:1},0),false);assert.equal(recordTouchesFlock({type:'Nascimento',from:0,to:1},1),true);
 assert.equal(recordTouchesFlock({type:'Mortalidade',from:1,to:0},0),false);assert.equal(recordTouchesFlock({type:'Mortalidade',from:1,to:0},1),true);
 assert.equal(recordTouchesFlock({type:'Transferência',from:1,to:2},2),true);assert.equal(recordTouchesFlock({type:'Venda',category:'Ovos',from:0},0),false);
});
