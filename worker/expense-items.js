import {expenseItemInputSchema} from '../security/expense-item-schemas.js';
import {ingredients} from '../feed-items.js';
import {HttpError} from './security.js';
export function createExpenseItem(state,input,username){
 if(!state.initialized)throw new HttpError(409);
 const item=expenseItemInputSchema.parse(input),items=state.expenseItems||[],existing=items.find(i=>i.id===item.id);
 if(existing){if(existing.name!==item.name||existing.group!==item.group)throw new HttpError(409);return state}
 if(items.length>=500||items.some(i=>i.group===item.group&&i.name.toLocaleLowerCase()===item.name.toLocaleLowerCase())||item.group==='Ração'&&ingredients.some(name=>name.toLocaleLowerCase()===item.name.toLocaleLowerCase()))throw new HttpError(409);
 return {...state,expenseItems:[...items,{...item,createdBy:username,createdAt:Date.now()}]};
}
