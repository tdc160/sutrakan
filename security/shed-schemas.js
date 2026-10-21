import {z} from 'zod';
import {MAX_SHEDS} from '../shed-model.js';
const name=z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/u).transform(value=>value.normalize('NFC'));
const slot=z.number().int().min(1).max(MAX_SHEDS);
export const shedsSchema=z.array(z.object({id:z.number().int().min(0).max(MAX_SHEDS),name,active:z.boolean()}).strict()).min(1).max(MAX_SHEDS+1);
const base={id:z.uuid(),revision:z.number().int().nonnegative()};
export const shedCommandSchema=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('create'),name}).strict(),
 z.object({...base,action:z.literal('edit'),shed:slot,name}).strict(),
 z.object({...base,action:z.literal('delete'),shed:slot,destination:slot.optional(),password:z.string().min(8).max(128)}).strict()
]);
export const shedEventsSchema=z.array(z.object({id:z.uuid(),command:z.string().max(500),by:z.string().max(64),at:z.number().int(),action:z.enum(['create','edit','delete']),shed:slot}).strict()).max(10000);
