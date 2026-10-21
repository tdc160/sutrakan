import {activeProperty,activePropertyId,setPropertyContext,contextKey} from './property-context.js';
import {preserveFeedDrafts,registerFeedDraftCapture} from './feed-drafts.js';
import {shortcutMarkup} from './shortcuts.js';
import {connectionMarkup,refreshConnection} from './offline.js';
import {preserveOpenRecordDraft} from './record-form.js';
const PENDING_LOGOUT='santo-expedito-pending-logout';
let session=null,renderApplication=null,expiryTimer,logoutOperation;
const validUser=data=>data&&typeof data.user==='string'&&/^[A-Za-z0-9_.-]{1,64}$/.test(data.user)&&typeof data.csrf==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.csrf)&&Number.isFinite(data.expiresAt)&&data.expiresAt>Date.now();
async function request(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let response,data;
 try{response=await fetch(path,{...options,signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});if(!response.headers.get('Content-Type')?.includes('application/json'))throw Error('invalid-response');data=await response.json()}
 catch{throw Error(response&&!controller.signal.aborted?'O acesso online não está disponível neste ambiente.':'Sem resposta do servidor. Verifique a conexão e tente novamente.')}
 finally{clearTimeout(timer)}
 if(!response.ok){const error=new Error(response.status===401?'Usuário ou senha inválidos.':response.status===429?'Muitas tentativas. Aguarde um minuto e tente novamente.':response.status>=500?'Acesso indisponível. Confira a configuração do administrador no Cloudflare.':'Não foi possível concluir. Tente novamente.');error.status=response.status;throw error}return data
}

function showLogin(message=''){
 preserveOpenRecordDraft();preserveFeedDrafts();registerFeedDraftCapture(null);setPropertyContext(null,null);
 clearTimeout(expiryTimer);session=null;
 document.querySelector('#app').innerHTML=`<main class="login-screen"><section class="login-card" aria-labelledby="login-title"><span class="tag">GESTÃO DA PROPRIEDADE RURAL</span><h1 id="login-title">Entre para cuidar <span class="login-title-tail">da sua criação.</span></h1><p>O acesso precisa de internet. Seus registros ficam na base compartilhada. Rascunhos continuam neste aparelho.</p><form id="login-form"><label>Usuário<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" required value="Talitom"></label><label>Senha<input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label><label class="show-password"><input type="checkbox" id="show-password">Mostrar senha</label><p id="login-error" role="alert"></p><button class="primary" type="submit">Entrar com segurança</button></form><p class="login-connection" id="login-connection" role="status"></p><p class="login-notice" id="login-notice"></p>${connectionMarkup()}${shortcutMarkup()}</section></main>`;
 document.querySelector('#login-error').textContent=message;
 document.querySelector('#login-notice').textContent='Rascunhos são separados por usuário e propriedade.';
 const form=document.querySelector('#login-form');
 document.querySelector('#show-password').onchange=e=>form.elements.password.type=e.target.checked?'text':'password';
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Verificando acesso…';document.querySelector('#login-error').textContent='';
  try{if(!navigator.onLine)throw Error('Sem conexão. Conecte-se à internet para entrar.');await logoutOperation;await finishPendingLogout();const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({username:form.elements.username.value,password:form.elements.password.value})});if(!validUser(result))throw Error('Não foi possível confirmar o acesso.');form.elements.password.value='';acceptSession(result)}catch(error){document.querySelector('#login-error').textContent=error.message;button.disabled=false;button.textContent='Entrar com segurança'}
 };

 updateLoginConnection();refreshConnection();
}
function updateLoginConnection(){const el=document.querySelector('#login-connection');if(el)el.textContent=navigator.onLine?'Internet disponível para verificar o acesso.':'Sem conexão. O sistema exige uma verificação online para abrir.'}
addEventListener('online',updateLoginConnection);addEventListener('offline',updateLoginConnection);
function acceptSession(data){session=data;let saved;try{saved=localStorage.getItem('active-property:'+data.user.toLowerCase())}catch{}const selected=data.properties?.find(p=>p.property.id===saved)||data.properties?.[0];setPropertyContext(data.user,selected?.property);expiryTimer=setTimeout(()=>{preserveOpenRecordDraft();showLogin('Sua sessão terminou. Entre novamente para continuar.')},Math.max(0,data.expiresAt-Date.now()));renderApplication()}
async function finishPendingLogout(){let pending;try{pending=localStorage.getItem(PENDING_LOGOUT)}catch{}if(!pending)return;try{const data=await request('/api/auth/session');if(validUser(data))await request('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':data.csrf},body:'{}'})}catch(e){if(e.status!==401)throw e}localStorage.removeItem(PENDING_LOGOUT)}
export async function startApplication(render){renderApplication=render;document.querySelector('#app').innerHTML='<main class="login-screen"><section class="login-card"><h1>Verificando acesso…</h1><p role="status">Seus dados continuam neste aparelho.</p></section></main>';try{if(!navigator.onLine)throw Error('Conecte-se à internet para abrir o sistema.');await finishPendingLogout();const data=await request('/api/auth/session');if(!validUser(data))throw Error('Entre novamente para continuar.');acceptSession(data)}catch(error){showLogin(error.status===401?'':error.message)}}
export function hasActiveSession(){return !!session&&session.expiresAt>Date.now()}
export function bindAuthControls(){document.querySelectorAll('[data-logout]').forEach(button=>button.onclick=()=>{
 preserveOpenRecordDraft();const current=session;try{localStorage.setItem(PENDING_LOGOUT,'1')}catch{}
 // Lock immediately; wait for revocation before starting a subsequent login to avoid races.
 showLogin('Saindo da conta…');
 logoutOperation=(async()=>{try{if(!navigator.onLine||!current)throw Error();await request('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':current.csrf},body:'{}'});localStorage.removeItem(PENDING_LOGOUT);const message=document.querySelector('#login-error');if(message)message.textContent=''}catch{const message=document.querySelector('#login-error');if(message)message.textContent='Acesso local encerrado. Conecte-se para concluir a saída da conta.'}})().finally(()=>{logoutOperation=null});
 })}

export function isAdministrator(){return hasActiveSession()&&session.properties?.find(p=>p.property.id===activePropertyId())?.role==='admin'}
export async function accountRequest(path,body){
 if(!hasActiveSession())throw Error('Entre novamente para continuar.');
 const scope=contextKey(),id=activePropertyId(),scoped=/^\/api\/(farm|users|assistant|properties\/update)/.test(path);if(scoped&&!id)throw Error('Selecione uma propriedade para continuar.');
 try{const result=await request(path,{method:body?'POST':'GET',headers:{...(id?{'X-Property-Id':id}:{}),...(body?{'X-CSRF-Token':session.csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});if(scoped&&scope!==contextKey())throw Error('A propriedade ativa mudou. A resposta anterior foi descartada.');return result}
 catch(error){if(error.status===401&&scope===contextKey()){preserveOpenRecordDraft();showLogin('Entre novamente para continuar.')}if(error.status===409&&path.startsWith('/api/farm'))error.message='Os dados centrais mudaram ou a operação conflita com o plantel atual. Atualize os dados e confira o registro antes de tentar novamente.';else if(error.status===409)error.message='Usuário já cadastrado, limite de 50 contas atingido ou alteração não permitida.';throw error}
}

export function currentUsername(){return session?.user}

export const currentProperty=()=>activeProperty();
export const availableProperties=()=>session?.properties||[];
export function updatePropertyList(properties){if(session)session.properties=properties}
export async function selectProperty(id){const selected=session?.properties?.find(p=>p.property.id===id);if(!selected)throw Error('Você não tem acesso a esta propriedade.');if(!preserveOpenRecordDraft()||!preserveFeedDrafts())throw Error('Não foi possível guardar o rascunho. Verifique o armazenamento antes de trocar de propriedade.');registerFeedDraftCapture(null);setPropertyContext(session.user,selected.property);try{localStorage.setItem('active-property:'+session.user.toLowerCase(),id)}catch{}renderApplication()}

export function isGeneralAdministrator(){return hasActiveSession()&&session.generalAdministrator===true}
