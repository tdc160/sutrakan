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
 clearTimeout(expiryTimer);session=null;
 document.querySelector('#app').innerHTML=`<main class="login-screen"><section class="login-card" aria-labelledby="login-title"><span class="tag">CHÁCARA SANTO EXPEDITO</span><h1 id="login-title">Entre para cuidar<br>da sua criação.</h1><p>O acesso precisa de internet. Seus registros e rascunhos continuam neste aparelho.</p><form id="login-form"><label>Usuário<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" required value="Talitom"></label><label>Senha<input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required></label><label class="show-password"><input type="checkbox" id="show-password">Mostrar senha</label><p id="login-error" role="alert"></p><button class="primary" type="submit">Entrar com segurança</button></form><p class="login-connection" id="login-connection" role="status"></p><p class="login-notice" id="login-notice"></p></section></main>`;
 document.querySelector('#login-error').textContent=message;
 try{document.querySelector('#login-notice').textContent=localStorage.getItem('santo-expedito-record-draft-v1')?'Há um rascunho guardado neste aparelho. Você poderá retomá-lo após entrar.':''}catch{}
 const form=document.querySelector('#login-form');
 document.querySelector('#show-password').onchange=e=>form.elements.password.type=e.target.checked?'text':'password';
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Verificando acesso…';document.querySelector('#login-error').textContent='';
  try{if(!navigator.onLine)throw Error('Sem conexão. Conecte-se à internet para entrar.');await logoutOperation;await finishPendingLogout();const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({username:form.elements.username.value,password:form.elements.password.value})});if(!validUser(result))throw Error('Não foi possível confirmar o acesso.');form.elements.password.value='';acceptSession(result)}catch(error){document.querySelector('#login-error').textContent=error.message;button.disabled=false;button.textContent='Entrar com segurança'}
 };
 updateLoginConnection();
}
function updateLoginConnection(){const el=document.querySelector('#login-connection');if(el)el.textContent=navigator.onLine?'Internet disponível para verificar o acesso.':'Sem conexão. O sistema exige uma verificação online para abrir.'}
addEventListener('online',updateLoginConnection);addEventListener('offline',updateLoginConnection);
function acceptSession(data){session=data;expiryTimer=setTimeout(()=>{preserveOpenRecordDraft();showLogin('Sua sessão terminou. Entre novamente para continuar.')},Math.max(0,data.expiresAt-Date.now()));renderApplication()}
async function finishPendingLogout(){let pending;try{pending=localStorage.getItem(PENDING_LOGOUT)}catch{}if(!pending)return;try{const data=await request('/api/auth/session');if(validUser(data))await request('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':data.csrf},body:'{}'})}catch(e){if(e.status!==401)throw e}localStorage.removeItem(PENDING_LOGOUT)}
export async function startApplication(render){renderApplication=render;document.querySelector('#app').innerHTML='<main class="login-screen"><section class="login-card"><h1>Verificando acesso…</h1><p role="status">Seus dados continuam neste aparelho.</p></section></main>';try{if(!navigator.onLine)throw Error('Conecte-se à internet para abrir o sistema.');await finishPendingLogout();const data=await request('/api/auth/session');if(!validUser(data))throw Error('Entre novamente para continuar.');acceptSession(data)}catch(error){showLogin(error.status===401?'':error.message)}}
export function hasActiveSession(){return !!session&&session.expiresAt>Date.now()}
export function bindAuthControls(){document.querySelectorAll('[data-logout]').forEach(button=>button.onclick=()=>{
 preserveOpenRecordDraft();const current=session;try{localStorage.setItem(PENDING_LOGOUT,'1')}catch{}
 // Lock immediately; wait for revocation before starting a subsequent login to avoid races.
 showLogin('Saindo da conta…');
 logoutOperation=(async()=>{try{if(!navigator.onLine||!current)throw Error();await request('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':current.csrf},body:'{}'});localStorage.removeItem(PENDING_LOGOUT);const message=document.querySelector('#login-error');if(message)message.textContent=''}catch{const message=document.querySelector('#login-error');if(message)message.textContent='Acesso local encerrado. Conecte-se para concluir a saída da conta.'}})().finally(()=>{logoutOperation=null});
 })}
