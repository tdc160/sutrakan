import {propertyIdSchema,propertySchema} from './property-schemas.js';
import {feedStateSchema} from './feed-schemas.js';
import {z} from 'zod';
import {isNucleus,nucleusConcentrations} from '../feed-items.js';
// Keep schema evaluation compatible with CSP: no runtime code generation / unsafe-eval.
z.config({jitless:true});
export {ingredients} from '../feed-items.js';
import {ingredients} from '../feed-items.js';
const noControls=s=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(s);
// Validate text without stripping legitimate punctuation. Encode for the OUTPUT context;
// SQL parameters must be bound if a database is introduced, never interpolated strings.
const text=max=>z.string().max(max).refine(noControls).transform(s=>s.normalize('NFC'));
export const loginSchema=z.object({username:z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/),password:z.string().min(8).max(128)}).strict();
export const emptySchema=z.object({}).strict();
const place=z.number().int().min(0).max(4);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export const localDay=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const makeRecordSchema=allowLegacyNucleus=>z.object({
 id:text(100).optional(),propertyId:propertyIdSchema.optional(),createdBy:text(64).optional(),createdAt:z.number().int().positive().optional(),type:z.enum(['Coleta de ovos','Venda','Despesa','Nascimento','Mortalidade','Transferência']),
 category:text(80),qty:z.number().finite().positive().max(1000000),value:z.number().finite().min(0).max(1000000000),
 date:z.string().refine(validDate).refine(s=>s<=localDay()),note:text(500),from:place.optional(),to:place.optional(),
 ingredient:z.enum(ingredients).optional(),concentration:z.union([z.literal(3),z.literal(4),z.literal(5)]).optional()
}).strict().superRefine((r,ctx)=>{
 const issue=(path,message)=>ctx.addIssue({code:'custom',path:[path],message});
 if(r.type!=='Despesa'&&!Number.isInteger(r.qty))issue('qty','Quantidade deve ser inteira.');
 const categoryAllowed=r.type==='Venda'?['Ovos','Pintinhos','Aves vivas','Aves abatidas']:r.type==='Despesa'?['Ração','Medicamentos','Outros']:[r.type];
 if(!categoryAllowed.includes(r.category))issue('category','Categoria inválida.');
 if(['Venda','Despesa'].includes(r.type)&&r.value<=0)issue('value','Informe o valor total.');
 if(!['Venda','Despesa'].includes(r.type)&&r.value!==0)issue('value','Este registro não tem valor financeiro.');
 const isFeed=r.type==='Despesa'&&r.category==='Ração';
 if(r.ingredient&&!isFeed)issue('ingredient','Ingrediente incompatível com o registro.');
 if(!allowLegacyNucleus&&isFeed&&!r.ingredient)issue('ingredient','Escolha o ingrediente.');
 if(r.concentration!==undefined&&(!isFeed||!isNucleus(r.ingredient)))issue('concentration','Concentração incompatível com o item.');
 if(!allowLegacyNucleus&&isNucleus(r.ingredient)&&!nucleusConcentrations.includes(r.concentration))issue('concentration','Informe a concentração do núcleo.');
 const outgoing=['Mortalidade','Transferência'].includes(r.type)||r.type==='Venda'&&r.category!=='Ovos';
 if(!allowLegacyNucleus&&outgoing&&r.from===undefined)issue('from','Escolha o galpão de origem.');
 if(!allowLegacyNucleus&&['Nascimento','Transferência'].includes(r.type)&&r.to===undefined)issue('to','Escolha o destino.');
 if(r.type==='Transferência'&&r.from===r.to)issue('to','Escolha um destino diferente.');
});
export const recordSchema=makeRecordSchema(false);
// Legacy purchases can lack ingredient/concentration. Never silently infer their values.
export const storedRecordSchema=makeRecordSchema(true);
export const backupSchema=z.object({birds:z.array(z.number().int().min(0).max(1000000)).length(5),records:z.array(storedRecordSchema).max(100000),feed:feedStateSchema.optional(),propertyId:propertyIdSchema.optional(),property:propertySchema.optional()}).strict();
export const csrfSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const sessionTokenSchema=csrfSchema;
export const hashSchema=z.string().regex(/^[a-f0-9]{64}$/);

// User administration accepts explicit fields only. New passwords require a long passphrase.
export const userCreateSchema=z.object({username:loginSchema.shape.username,name:text(80).refine(s=>s.trim().length>0),role:z.enum(['admin','operator']),password:z.string().min(8).max(128)}).strict();
export const userUpdateSchema=z.object({username:loginSchema.shape.username,active:z.boolean().optional(),role:z.enum(['admin','operator']).optional(),password:z.string().min(8).max(128).optional()}).strict();

export const centralRecordSchema=recordSchema.refine(r=>/^[a-f0-9-]{36}$/i.test(r.id||'')&&r.propertyId===undefined&&r.createdBy===undefined&&r.createdAt===undefined);
export const farmImportSchema=z.object({data:backupSchema,revision:z.number().int().min(0)}).strict();
