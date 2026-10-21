import {z} from 'zod';
const name=z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/u).transform(value=>value.normalize('NFC'));
export const expenseItemInputSchema=z.object({id:z.uuid(),name,group:z.enum(['Ração','Medicamentos','Outros'])}).strict();
export const expenseItemsSchema=z.array(expenseItemInputSchema.extend({createdBy:z.string().min(1).max(64),createdAt:z.number().int().positive()})).max(500).superRefine((items,ctx)=>{if(new Set(items.map(i=>i.id)).size!==items.length||new Set(items.map(i=>i.group+':'+i.name.toLocaleLowerCase())).size!==items.length)ctx.addIssue({code:'custom',message:'Itens duplicados.'})});
