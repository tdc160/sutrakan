import './theme.css';
import {Sun,Moon,MonitorCog} from 'lucide';
import {icon} from './ui.js';
const key='rural-theme',media=matchMedia('(prefers-color-scheme: dark)');
let preference='system';
try{const saved=localStorage.getItem(key);if(['light','dark','system'].includes(saved))preference=saved}catch{}
function apply(){
 const theme=preference==='system'?(media.matches?'dark':'light'):preference;
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101b16':'#163f2d');
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===preference)));
 window.dispatchEvent(new Event('theme-change'));
}
// This control lives outside #app so navigation and login cannot remove it.
const control=document.createElement('div');control.className='theme-control';
const modes=[['light','Claro',Sun],['dark','Escuro',Moon],['system','Automático: acompanhar o aparelho',MonitorCog]];
control.innerHTML=`<div class="theme-toggle" role="group" aria-label="Aparência do sistema">${modes.map(([value,label,glyph])=>`<button type="button" data-theme-choice="${value}" aria-label="${label}" title="${label}" aria-pressed="false">${icon(glyph)}</button>`).join('')}</div><span class="theme-feedback" role="status"></span>`;
document.body.prepend(control);
control.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{preference=button.dataset.themeChoice;let saved=true;try{localStorage.setItem(key,preference)}catch{saved=false}apply();control.querySelector('[role=status]').textContent=saved?'':'Tema aplicado. Não foi possível salvar neste aparelho.'}));
media.addEventListener('change',()=>{if(preference==='system')apply()});
window.addEventListener('storage',event=>{if(event.key===key){preference=['light','dark','system'].includes(event.newValue)?event.newValue:'system';apply()}});
apply();
