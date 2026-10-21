import {scopedStorage,contextKey} from './property-context.js';
import {isNucleus,nucleusConcentrations} from './feed-items.js';
import {DRAFT_KEY,loadDraft,writeDraft} from './record-draft.js';
const types=['Coleta de ovos','Venda','Despesa','Nascimento','Mortalidade','Transferência'];
let captureActive=null,memoryDraft=null;const scopedMemory=new Map();
addEventListener('property-context-change',event=>{if(event.detail.previous)scopedMemory.set(event.detail.previous,memoryDraft);captureActive=null;memoryDraft=scopedMemory.get(event.detail.current)||null});
export function preserveOpenRecordDraft(){return captureActive?.()!==false}
export function clearRecordDraft(){captureActive=null;memoryDraft=null;try{scopedStorage(localStorage).removeItem(DRAFT_KEY)}catch{}}
addEventListener('pagehide',()=>captureActive?.());
addEventListener('beforeunload',e=>{if(captureActive?.()===false){e.preventDefault();e.returnValue=''}});
export function showRecordForm({ingredients,names,birds,today,preset,submit}){
 const dialog=document.querySelector('#modal');
 if(dialog.open)return;
 const stored=memoryDraft||loadDraft(localStorage);
 let draft=stored||{values:{type:types.includes(preset)?preset:types[0],date:today,note:''},byType:{}};
 let currentType=draft.values.type;
 const mobile=matchMedia('(max-width:700px)').matches;
 dialog.setAttribute('aria-labelledby','record-title');
 dialog.innerHTML=`<form id="recordform"><div class="formtop"><div><span class="eyebrow">REGISTRO DA CRIAÇÃO</span><h2 id="record-title">Novo registro</h2></div><button type="button" id="close" aria-label="Fechar e guardar rascunho">✕</button></div><p id="draft-status" class="draft-status" role="status">${stored?'Rascunho retomado. Confira e termine de preencher.':'Ao salvar, o registro será enviado à base compartilhada. Sem conexão, o rascunho fica neste aparelho.'}</p><label for="type">O que deseja registrar?<select name="type" id="type">${types.map(t=>`<option>${t}</option>`).join('')}</select></label><div id="fields"></div><details class="record-extras" ${mobile?'':'open'}><summary>Data e observações <span id="record-date-label"></span></summary><label>Data do registro<input type="date" name="date" required max="${today}"></label><label>Observações (opcional)<textarea name="note" maxlength="500" placeholder="Ex.: 2 sacos de 25 kg"></textarea></label></details><p id="error" role="alert"></p><button type="button" id="discard-draft">Descartar rascunho</button><div class="formactions"><button type="button" id="cancel">Guardar e fechar</button><button class="primary" type="submit">Salvar registro</button></div></form>`;
 const form=dialog.querySelector('form');
 form.dataset.recordId=/^[a-f0-9-]{36}$/i.test(draft.values.recordId||'')?draft.values.recordId:crypto.randomUUID();
 form.elements.type.value=currentType;
 form.elements.date.value=draft.values.date||today;
 form.elements.note.value=draft.values.note||'';
 const status=dialog.querySelector('#draft-status');
 const dateLabel=()=>dialog.querySelector('#record-date-label').textContent=form.elements.date.value===today?'Hoje':form.elements.date.value.split('-').reverse().join('/');
 const capture=()=>{
   if(!captureActive)return true;
   const fields=Object.fromEntries(new FormData(form));
   const {type,date,note,...rest}=fields;
   draft.values={type:currentType,date,note,recordId:form.dataset.recordId};draft.byType[currentType]=rest;draft.updatedAt=new Date().toISOString();memoryDraft=draft;
   try{writeDraft(localStorage,draft);if(status.textContent!=='Rascunho guardado neste aparelho.')status.textContent='Rascunho guardado neste aparelho.';status.classList.remove('draft-error');dateLabel();return true}catch{status.textContent='Não foi possível guardar o rascunho. Mantenha esta tela aberta e verifique o espaço do navegador.';status.classList.add('draft-error');return false}
 };
 const fields=()=>{
   const type=currentType,values=draft.byType[type]||{};
   const options=(items,selected)=>items.map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('');
   const placeOptions=(selected,prompt)=>`<option value="">${prompt}</option>`+names.map((n,i)=>`<option value="${i}" ${String(i)===String(selected)?'selected':''}>${n} (${birds[i]} aves)</option>`).join('');
   const categories=type==='Venda'?['Ovos','Pintinhos','Aves vivas','Aves abatidas']:type==='Despesa'?['Ração','Medicamentos','Outros']:[];
   const moves=['Mortalidade','Transferência','Venda'].includes(type);
   dialog.querySelector('#fields').innerHTML=`${categories.length?`<label>Categoria<select name="category" id="category">${options(categories,values.category)}</select></label>`:''}${type==='Despesa'?`<div id="ingredientfield"><label>O que comprou?<select name="ingredient" id="ingredient"><option value="">Selecione o ingrediente ou a ração</option>${options(ingredients,values.ingredient)}</select></label><div id="concentrationfield" hidden><label>Concentração do núcleo<select name="concentration" id="concentration"><option value="">Confira no rótulo</option>${nucleusConcentrations.map(c=>`<option value="${c}" ${String(c)===values.concentration?'selected':''}>${c}% (${c*10} kg por tonelada)</option>`).join('')}</select></label><p class="field-help">Use o percentual de inclusão na ração, não a porcentagem de proteína.</p></div><p class="field-help">Informe o peso total dos sacos em kg e o valor total pago.</p></div>`:''}<div class="formrow"><label><span id="quantity-label">${type==='Coleta de ovos'?'Quantos ovos coletou?':type==='Despesa'?'Quantidade comprada':'Quantidade de aves ou ovos'}</span><input type="number" name="qty" inputmode="${type==='Despesa'?'decimal':'numeric'}" min="${type==='Despesa'?'0.01':'1'}" step="${type==='Despesa'?'0.01':'1'}" required placeholder="${type==='Coleta de ovos'?'Ex.: 30':'Ex.: 10'}" autocomplete="off"></label>${['Venda','Despesa'].includes(type)?'<label>Valor total (R$)<input name="value" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="Ex.: 50,00" autocomplete="off"></label>':''}</div>${moves?`<div id="originfield"><label>De qual galpão?<select name="from">${placeOptions(values.from,'Selecione a origem')}</select></label></div>`:''}${['Nascimento','Transferência'].includes(type)?`<label>Galpão de destino<select name="to">${placeOptions(values.to??(type==='Nascimento'?'1':''),'Selecione o destino')}</select></label>`:''}<p id="unit-help" class="field-help"></p>`;
   for(const name of ['qty','value'])if(form.elements[name]&&values[name]!==undefined)form.elements[name].value=values[name];
   const sync=()=>{
     const category=form.elements.category?.value;
     const feed=type==='Despesa'&&category==='Ração';
     if(type==='Despesa'){
       dialog.querySelector('#ingredientfield').hidden=!feed;form.elements.ingredient.disabled=!feed;form.elements.ingredient.required=feed;
       const nucleus=feed&&isNucleus(form.elements.ingredient.value);
       dialog.querySelector('#concentrationfield').hidden=!nucleus;form.elements.concentration.disabled=!nucleus;form.elements.concentration.required=nucleus;
       if(!nucleus)form.elements.concentration.value='';
     }
     if(moves){const needsFrom=type!=='Venda'||category!=='Ovos';dialog.querySelector('#originfield').hidden=!needsFrom;form.elements.from.disabled=!needsFrom;form.elements.from.required=needsFrom}
     if(form.elements.to)form.elements.to.required=true;
     if(type==='Despesa')dialog.querySelector('#quantity-label').textContent=feed?'Peso total comprado (kg)':'Quantidade comprada';
     if(type==='Venda')dialog.querySelector('#quantity-label').textContent=category==='Ovos'?'Quantos ovos vendeu?':'Quantas aves vendeu?';
     dialog.querySelector('#unit-help').textContent=type==='Venda'&&category==='Ovos'?'Informe unidades: 1 dúzia = 12 ovos.':type==='Despesa'&&feed?'Exemplo: 2 sacos de 25 kg = 50 kg. O valor é o total da compra.':'';
   };
   form.elements.category?.addEventListener('change',sync);form.elements.ingredient?.addEventListener('change',sync);sync();
 };
 fields();dateLabel();
 captureActive=capture;
 form.elements.type.addEventListener('change',()=>{capture();currentType=form.elements.type.value;draft.values.type=currentType;fields();capture()});
 form.addEventListener('input',capture);form.addEventListener('change',capture);
 form.onsubmit=submit;
 const close=()=>{if(capture())dialog.close()};
 dialog.querySelector('#close').onclick=close;dialog.querySelector('#cancel').onclick=close;
 dialog.oncancel=e=>{if(!capture())e.preventDefault()};
 dialog.onclose=()=>{captureActive=null};
 dialog.querySelector('#discard-draft').onclick=()=>{if(confirm('Descartar somente o preenchimento deste rascunho? Os registros salvos serão mantidos.')){clearRecordDraft();dialog.close()}};
 dialog.showModal();
 if(preset&&!stored)form.elements.qty.focus({preventScroll:true});
}
