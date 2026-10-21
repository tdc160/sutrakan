import test from 'node:test';import assert from 'node:assert/strict';
import {abcReport,flockReport,birdCostsReport} from '../reports-model.js';
const date='2026-01-01';
const record=(type,qty,extra={})=>({type,qty,date,category:type,value:0,note:'',...extra});
test('ABC ranks separately by item/group/concentration and assigns whole boundary items before crossing 80/95 percent',()=>{
 const state={records:[record('Despesa',1,{category:'Ração',ingredient:'Milho em grão inteiro',value:79}),record('Despesa',1,{category:'Medicamentos',expenseItemName:'Vacina',value:10}),record('Despesa',1,{category:'Outros',value:6}),record('Despesa',1,{category:'Outros',expenseItemName:'Ferramenta',value:5}),record('Venda',1,{category:'Ovos',value:999})]};
 const report=abcReport(state,date,date);assert.equal(report.total,100);assert.deepEqual(report.rows.map(r=>r.category),['A','A','B','C']);assert.equal(report.rows.at(-1).cumulative,100);assert.equal(report.classes[0].value,89);
 const a=abcReport({records:[record('Despesa',1,{category:'Ração',ingredient:'Núcleo de início',concentration:3,expenseItemId:'same',value:80}),record('Despesa',1,{category:'Ração',ingredient:'Núcleo de início',concentration:4,expenseItemId:'same',value:15}),record('Despesa',1,{category:'Outros',value:5})]},date,date);assert.equal(a.rows.length,3);assert.deepEqual(a.rows.map(r=>r.category),['A','B','C']);
 assert.deepEqual(abcReport({records:[]},date,date).rows,[]);
});
const state=()=>({birds:[0,11,2],records:[record('Nascimento',4,{date:'2026-01-02',to:1}),record('Transferência',2,{date:'2026-01-02',from:1,to:2}),record('Mortalidade',1,{date:'2026-01-03',from:1}),record('Venda',2,{date:'2026-01-04',category:'Aves vivas',from:1,value:80}),record('Nascimento',2,{date:'2026-01-05',to:1}),record('Despesa',1,{date:'2026-01-03',category:'Ração',ingredient:'Milho em grão inteiro',value:60}),record('Coleta de ovos',12,{date:'2026-01-03'}),record('Venda',6,{date:'2026-01-03',category:'Ovos',value:10})]});
test('flock reconstructs boundaries, daily closing exposure and internal shed transfers without counting egg sales as birds',()=>{
 const report=flockReport(state(),'2026-01-02','2026-01-04');assert.equal(report.opening,10);assert.equal(report.closing,11);assert.equal(report.current,13);assert.equal(report.births,4);assert.equal(report.sold,2);assert.equal(report.deaths,1);assert.equal(report.birdDays,14+13+11);assert.equal(report.average,38/3);assert.equal(report.mortality,1/14*100);assert.equal(report.byShed[2].incoming,2);assert.equal(report.byShed[1].outgoing,2);assert.equal(report.byShed[1].closing,9);assert.equal(report.valid,true);
});
test('cost metrics expose denominators and keep purchases, bird revenue, eggs and pending consumption distinct',()=>{
 const input=state();input.feed={daily:[{day:'2026-01-03',recipe:'inicio',kg:1,status:'posted'},{day:'2026-01-03',recipe:'inicio',kg:2,status:'pending'}]};const report=birdCostsReport(input,'2026-01-02','2026-01-04');assert.equal(report.perAverageBird,60/(38/3));assert.equal(report.perBirdDay,60/38);assert.equal(report.perSoldBird,30);assert.equal(report.revenuePerSoldBird,40);assert.equal(report.perEgg,5);assert.equal(report.perDozen,60);assert.equal(report.postedKg,1);assert.equal(report.pendingKg,2);assert.equal(report.feedPerBirdDay,1/38);assert.equal(report.eggRevenue,10);
 const empty=birdCostsReport({birds:[0],records:[]},date,date);assert.equal(empty.perAverageBird,null);assert.equal(empty.perSoldBird,null);assert.equal(empty.perEgg,null);assert.equal(empty.feedPerBirdDay,null);
});
test('incomplete legacy references and impossible negative histories suppress estimates without suppressing recorded totals',()=>{
 const legacy=flockReport({birds:[0,5],records:[record('Venda',2,{category:'Aves vivas'})]},date,date);assert.equal(legacy.valid,false);assert.equal(legacy.sold,2);assert.equal(legacy.average,null);
 const invalid=flockReport({birds:[0,1],records:[record('Nascimento',5,{date:'2026-01-03',to:1})]},date,'2026-01-03');assert.equal(invalid.opening,-4);assert.equal(invalid.valid,false);assert.equal(invalid.birdDays,null);
});
test('financial insights compare equal-length previous intervals and retain numeric monthly results',async()=>{
 const {financialInsights}=await import('../reports-model.js');const report=financialInsights({records:[record('Venda',1,{date:'2026-01-04',category:'Ovos',value:100}),record('Despesa',1,{date:'2026-01-04',category:'Outros',value:50}),record('Despesa',1,{date:'2026-01-01',category:'Outros',value:25})]},'2026-01-04','2026-01-06');assert.equal(report.priorStart,'2026-01-01');assert.equal(report.priorEnd,'2026-01-03');assert.equal(report.margin,50);assert.equal(report.expenseChange,100);assert.deepEqual(report.months,[{month:'2026-01',income:100,expense:50,balance:50}]);
});
test('negative intermediate shed balances invalidate bird-day estimates even when total flock stays positive',()=>{
 const report=flockReport({birds:[0,1,10],records:[record('Venda',2,{date:'2026-01-02',category:'Aves vivas',from:1}),record('Nascimento',2,{date:'2026-01-03',to:1})]},'2026-01-01','2026-01-03');assert.equal(report.opening,11);assert.equal(report.closing,11);assert.equal(report.valid,false);assert.equal(report.average,null);
 const valid=flockReport({birds:[0,1],records:[record('Venda',1,{date:'2025-12-01',category:'Aves vivas'})]},date,date);assert.equal(valid.valid,true);assert.equal(valid.average,1);
});
