import './theme.css';
const key='rural-theme',media=matchMedia('(prefers-color-scheme: dark)');
let preference='system';
try{const saved=localStorage.getItem(key);if(['light','dark','system'].includes(saved))preference=saved}catch{}
function apply(){
 const theme=preference==='system'?(media.matches?'dark':'light'):preference;
 document.documentElement.dataset.theme=theme;
 document.documentElement.style.colorScheme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101b16':'#163f2d');
 const select=document.querySelector('#theme-choice');if(select)select.value=preference;
 window.dispatchEvent(new Event('theme-change'));
}
// This control lives outside #app so navigation and login cannot remove it.
const control=document.createElement('div');control.className='theme-control';
control.innerHTML='<label for="theme-choice">Aparência</label><select id="theme-choice" aria-label="Aparência do sistema"><option value="system">Automático</option><option value="light">Claro</option><option value="dark">Escuro</option></select><span class="theme-feedback" role="status"></span>';
document.body.prepend(control);
control.querySelector('select').addEventListener('change',event=>{preference=event.target.value;let saved=true;try{localStorage.setItem(key,preference)}catch{saved=false}apply();control.querySelector('[role=status]').textContent=saved?'':'Tema aplicado. Não foi possível salvar neste aparelho.'});
media.addEventListener('change',()=>{if(preference==='system')apply()});
window.addEventListener('storage',event=>{if(event.key===key){preference=['light','dark','system'].includes(event.newValue)?event.newValue:'system';apply()}});
apply();
