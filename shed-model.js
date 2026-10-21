// Stable numeric slots preserve references in old records, feeding plans and backups.
export const MAX_SHEDS=200;
const legacy=['A distribuir','Galpão 1 · Pintinhos','Galpão 2','Galpão 3','Galpão 4'];
export const shedsFor=state=>state.sheds||state.birds.map((_,id)=>({id,name:legacy[id]||`Galpão ${id}`,active:true}));
export const shedNames=state=>shedsFor(state).map(s=>s.name+(s.active?'':' (excluído)'));
export const activeSheds=state=>shedsFor(state).filter(s=>s.active);
export const activeShed=(state,id)=>Number.isInteger(id)&&shedsFor(state).some(s=>s.id===id&&s.active);
