import {ingredients} from './feed-items.js';
export const expenseGroups=['Ração','Medicamentos','Outros'];
export const expenseItemsFor=(state,group)=>(state.expenseItems||[]).filter(item=>!group||item.group===group);
export const feedIngredientsFor=state=>ingredients.concat(expenseItemsFor(state,'Ração').map(item=>item.name));
export const knownFeedIngredient=(state,name)=>feedIngredientsFor(state).includes(name);
