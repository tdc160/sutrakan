import test from 'node:test';import assert from 'node:assert/strict';
import {financialReport,stockReport,reportCSV,reportRange,reportDay} from '../reports-model.js';
import {inventory,kg} from '../feed-inventory.js';
const time=day=>Date.parse(day+'T12:00:00Z');
const record=(date,type,value,extra={})=>({date,type,value,category:type==='Venda'?'Ovos':'Outros',qty:1,note:'',...extra});
test('financial report filters inclusive dates and sums cents, grouping income/expense separately',()=>{
 const state={records:[record('2026-01-01','Venda',.1),record('2026-01-31','Venda',.2),record('2026-01-15','Despesa',.15),record('2025-12-31','Venda',100),record('2026-02-01','Despesa',50),record('2026-01-10','Nascimento',0)]};
 const report=financialReport(state,'2026-01-01','2026-01-31');assert.equal(report.income,.3);assert.equal(report.expense,.15);assert.equal(report.balance,.15);assert.equal(report.rows.length,3);assert.deepEqual(report.groups,[{group:'Venda · Ovos',value:.3},{group:'Despesa · Outros',value:.15}]);assert.equal(financialReport(state,'2026-03-01','2026-03-31').rows.length,0);
 assert.throws(()=>reportRange('2026-02-30','2026-03-01'));assert.throws(()=>reportRange('2026-02-01','2026-01-01'));assert.throws(()=>reportRange('9999-01-01','9999-01-02'));
});
const stockState=()=>({records:[record('2026-01-01','Despesa',99,{category:'Ração',ingredient:'Quirera de milho',qty:100}),record('2026-01-02','Despesa',20,{category:'Ração',ingredient:'Quirera de milho',qty:10,createdAt:time('2026-01-05')})],feed:{purchaseStart:1,openedAt:time('2026-01-03'),openedBy:'Equipe',openingIngredients:[{ingredient:'Quirera de milho',kg:25}],openingRations:[{recipe:'inicio',kg:5}],productions:[{recipe:'inicio',totalKg:3,createdAt:time('2026-01-06'),createdBy:'Equipe',items:[{ingredient:'Quirera de milho',kg:2}]}],adjustments:[{target:'ingredient',ingredient:'Quirera de milho',deltaKg:-1,reason:'Consumo avulso',createdAt:time('2026-01-07'),createdBy:'Equipe'}],daily:[{day:'2026-01-04',recipe:'inicio',kg:1,status:'posted',postedAt:time('2026-01-08'),name:'Galpão 1'},{day:'2026-01-05',recipe:'inicio',kg:2,status:'pending',name:'Galpão 2'}]}});
test('stock report reconciles posted movements to actual balances and excludes pre-opening purchases/pending debits',()=>{
 const state=stockState(),before=JSON.stringify(state),report=stockReport(state,'2026-01-01','2026-01-31'),stock=inventory(state);const corn=report.balances.find(b=>b.item==='Quirera de milho'),ration=report.balances.find(b=>b.item==='Ração Início');assert.equal(corn.kg,32);assert.equal(ration.kg,7);assert.equal(corn.kg,kg(stock.raw.get('Quirera de milho')));assert.equal(report.pending.length,1);
 assert.equal(report.movements.filter(m=>m.kind==='Compra').length,1);assert.equal(report.movements.filter(m=>m.item==='Quirera de milho').reduce((sum,m)=>sum+m.deltaKg,0),corn.kg);assert.equal(report.movements.filter(m=>m.item==='Ração Início').reduce((sum,m)=>sum+m.deltaKg,0),ration.kg);assert.equal(JSON.stringify(state),before);
});
test('stock filters effective movement dates but preserves current balance and every pending day',()=>{
 const state=stockState(),backdated=stockReport(state,'2026-01-02','2026-01-02');assert.equal(backdated.movements.length,0);assert.equal(backdated.balances.find(b=>b.item==='Quirera de milho').kg,32);assert.equal(backdated.pending.length,1);
 assert.equal(stockReport(state,'2026-01-05','2026-01-05').movements[0].kind,'Compra');assert.equal(stockReport(state,'2026-01-04','2026-01-04').movements.length,0);assert.equal(stockReport(state,'2026-01-08','2026-01-08').movements[0].kind,'Consumo diário');assert.equal(stockReport({records:[]},'2026-01-01','2026-01-31'),null);assert.equal(reportDay('2026-01-02T01:00:00Z'),'2026-01-01');
});
test('CSV quotes delimiters/newlines and neutralizes formulas while preserving numeric negatives',()=>{
 const csv=reportCSV([['=SUM(A1:A2)',' +danger','@danger','-danger','a;b','"quoted"','line\nbreak',-1.5]]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=SUM(A1:A2)"'));assert.ok(csv.includes('"\' +danger"'));assert.ok(csv.includes('"\'@danger"'));assert.ok(csv.includes('"-1,5"'));assert.ok(csv.includes('"a;b"'));assert.ok(csv.includes('""quoted""'));assert.ok(csv.includes('line\nbreak'));
});
