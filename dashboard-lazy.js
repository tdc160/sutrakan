let dashboard=null,pending=null,generation=0;
export function destroyDashboard(){generation++;dashboard?.destroyDashboard()}
export function dashboardMarkup(){return dashboard?dashboard.dashboardMarkup():'<div id="dashboard-lazy"><p role="status">Os gráficos serão carregados ao abrir a análise.</p></div>'}
export function bindDashboard(state,navigate){
 const analysis=document.querySelector('#field-analysis');if(!analysis)return;
 const ownGeneration=generation;let bound=false;
 const activate=async()=>{
  if(!analysis.open||bound)return;
  bound=true;
  try{
   if(!dashboard){const placeholder=document.querySelector('#dashboard-lazy');if(placeholder)placeholder.innerHTML='<p role="status">Carregando os gráficos…</p>';pending=pending||import('./dashboard.js').then(module=>{dashboard=module;return module}).catch(error=>{pending=null;throw error});await pending}
   if(ownGeneration!==generation||!analysis.isConnected)return;
   const placeholder=analysis.querySelector('#dashboard-lazy');if(placeholder)placeholder.outerHTML=dashboard.dashboardMarkup();
   dashboard.bindDashboard(state,navigate);
  }catch{bound=false;const placeholder=analysis.querySelector('#dashboard-lazy');if(placeholder){placeholder.innerHTML='<p role="alert">Não foi possível carregar os gráficos. Confira a conexão e tente novamente.</p><button id="retry-dashboard" type="button">Tentar novamente</button>';placeholder.querySelector('button').onclick=activate}}
 };
 analysis.addEventListener('toggle',activate);activate();
}
