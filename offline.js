import {loadDraft} from './record-draft.js';
let ready=false,failed=false,pending=false,registrationRef,updateRequested=false,registrationAttempt;
export function connectionMarkup(){return '<div class="connection-state" role="status" aria-live="polite"><span id="connection-label"></span><button id="install-update" hidden>Atualizar aplicativo</button></div>'}
export function refreshConnection(){
 const label=document.querySelector('#connection-label');if(!label)return;
 label.parentElement.classList.toggle('is-offline',!navigator.onLine);
 label.textContent=!navigator.onLine?'Sem conexão. Registros locais disponíveis nesta sessão.':import.meta.env.DEV?'Dados neste aparelho. Acesso offline na versão publicada.':failed?'A preparação offline falhou. Reconecte-se para tentar novamente.':ready?'Aplicativo preparado. Reabrir exige login online.':'Preparando o aplicativo para quedas de sinal…';
 const button=document.querySelector('#install-update');button.hidden=!pending;
 button.onclick=()=>{if(loadDraft(localStorage)&&!confirm('Há um rascunho guardado neste aparelho. Atualizar e recarregar o aplicativo?'))return;if(registrationRef?.waiting){updateRequested=true;registrationRef.waiting.postMessage({type:'SKIP_WAITING'})}};
}
// Native registration avoids a dynamically imported registration helper failing on a weak connection.
function setupRegistration(){if(registrationAttempt)return registrationAttempt;registrationAttempt=registerNative().finally(()=>{registrationAttempt=null});return registrationAttempt}
async function registerNative(){
 if(import.meta.env.DEV)return;
 if(!('serviceWorker' in navigator)){failed=true;refreshConnection();return}
 try{
  const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});registrationRef=registration;
  const watch=worker=>worker?.addEventListener('statechange',()=>{
   if(worker.state==='installed'&&navigator.serviceWorker.controller){pending=true;refreshConnection()}
   if(worker.state==='redundant'&&!ready){failed=true;refreshConnection()}
  });
  if(registration.waiting&&navigator.serviceWorker.controller)pending=true;
  watch(registration.installing);registration.addEventListener('updatefound',()=>watch(registration.installing));
  navigator.serviceWorker.ready.then(()=>{ready=true;failed=false;refreshConnection()}).catch(()=>{});
  refreshConnection();
 }catch{failed=true;refreshConnection()}
}
addEventListener('online',async()=>{refreshConnection();if(import.meta.env.DEV)return;await registrationAttempt;if(navigator.onLine)setupRegistration()});
addEventListener('offline',refreshConnection);
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload()});
setupRegistration();
