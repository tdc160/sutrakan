import {propertyIdSchema} from './property-schemas.js';
import {z} from 'zod';
import {ingredients,isNucleus} from '../feed-items.js';
z.config({jitless:true});
export const phaseSchema=z.enum(['inicio','crescimento','postura','engorda']);
const uuid=z.uuid(),kg=z.number().finite().min(0).max(1000000),quantity=z.number().int().min(0).max(1000000),concentration=z.union([z.literal(3),z.literal(4),z.literal(5)]);
const text=max=>z.string().trim().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]*$/u);
const ingredientFields={ingredient:text(80),concentration:concentration.optional()};
export const stockEntrySchema=z.object({...ingredientFields,kg}).strict().refine(i=>isNucleus(i.ingredient)?i.concentration!==undefined:i.concentration===undefined);
export const rationEntrySchema=z.object({recipe:phaseSchema,kg}).strict();
export const planInputSchema=z.object({id:uuid,name:text(80),shed:z.number().int().min(0).max(200),recipe:phaseSchema,mode:z.literal('shed')}).strict();
const common={id:uuid};
export const feedActionSchema=z.discriminatedUnion('action',[
 z.object({...common,action:z.literal('initialize'),revision:z.number().int().nonnegative(),ingredients:z.array(stockEntrySchema).max(2030),rations:z.array(rationEntrySchema).max(4)}).strict(),
 z.object({...common,action:z.literal('produce'),recipe:phaseSchema,cornKg:kg.positive(),concentration}).strict(),
 z.object({...common,action:z.literal('plan'),plan:planInputSchema}).strict(),
 z.object({...common,action:z.literal('disable-plan'),planId:uuid}).strict(),
 z.object({...common,action:z.literal('adjust'),target:z.enum(['ingredient','ration']),ingredient:text(80).optional(),concentration:concentration.optional(),recipe:phaseSchema.optional(),deltaKg:z.number().finite().min(-1000000).max(1000000).refine(n=>n!==0),reason:text(300)}).strict().refine(i=>i.target==='ingredient'?i.ingredient!==undefined&&i.recipe===undefined&&(isNucleus(i.ingredient)?i.concentration!==undefined:i.concentration===undefined):i.recipe!==undefined&&i.ingredient===undefined&&i.concentration===undefined),
 z.object({...common,action:z.literal('settle')}).strict()
]);
const date=z.iso.date();
const planStored=z.object({id:uuid,name:text(80),shed:z.number().int().min(0).max(200),recipe:phaseSchema,mode:z.literal('shed'),active:z.boolean(),startDay:date,lastClosedDay:date}).strict();
const audit={createdBy:z.string().min(1).max(64),createdAt:z.number().int().positive()};
const production=z.object({id:uuid,recipe:phaseSchema,cornKg:kg.positive(),concentration,totalKg:kg.positive(),items:z.array(stockEntrySchema).min(3).max(5),...audit}).strict();
const adjustment=z.object({id:uuid,target:z.enum(['ingredient','ration']),ingredient:text(80).optional(),concentration:concentration.optional(),recipe:phaseSchema.optional(),deltaKg:z.number().finite(),reason:text(300),...audit}).strict();
const daily=z.object({id:z.string().max(100),day:date,planId:uuid,name:text(80),shed:z.number().int().min(0).max(200),recipe:phaseSchema,birds:quantity,grams:z.number().int().positive(),kg,status:z.enum(['posted','pending']),reason:z.string().max(300).optional(),postedAt:z.number().int().positive().optional()}).strict();
export const feedStateSchema=z.object({propertyId:propertyIdSchema.optional(),version:z.literal(1),purchaseStart:z.number().int().nonnegative(),openedAt:z.number().int().positive(),openedBy:z.string().min(1).max(64),openingIngredients:z.array(stockEntrySchema).max(2030),openingRations:z.array(rationEntrySchema).max(4),plans:z.array(planStored).max(100),productions:z.array(production).max(10000),adjustments:z.array(adjustment).max(10000),daily:z.array(daily).max(20000),receipts:z.array(z.object({id:uuid,command:z.string().max(512*1024),...audit}).strict()).max(10000)}).strict().superRefine((feed,ctx)=>{
 const unique=items=>new Set(items).size===items.length;
 if(!unique(feed.plans.map(p=>p.id))||!unique(feed.plans.filter(p=>p.active).map(p=>p.shed))||!unique(feed.productions.map(p=>p.id))||!unique(feed.adjustments.map(p=>p.id))||!unique(feed.daily.map(p=>p.id))||!unique(feed.receipts.map(p=>p.id))||!unique(feed.openingIngredients.map(p=>p.ingredient+'::'+(p.concentration||'')))||!unique(feed.openingRations.map(p=>p.recipe)))ctx.addIssue({code:'custom',message:'Identificadores ou saldos duplicados.'});
});
