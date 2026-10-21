import {z} from 'zod';
import {LEGACY_PROPERTY_ID,DEFAULT_FEEDING_RATES} from '../property-model.js';
z.config({jitless:true});
const text=max=>z.string().trim().max(max).regex(/^[^\u0000-\u001f\u007f]*$/u).transform(s=>s.normalize('NFC'));
export const propertyIdSchema=z.union([z.literal(LEGACY_PROPERTY_ID),z.uuid()]);
export const propertyInputSchema=z.object({name:text(100).refine(s=>s.length>0),owner:text(100).refine(s=>s.length>0),region:text(160),hectares:z.number().finite().min(0).max(10000000),productionType:text(100).refine(s=>s.length>0),feedingRates:z.object({inicio:z.number().int().min(1).max(1000),crescimento:z.number().int().min(1).max(1000),postura:z.number().int().min(1).max(1000),engorda:z.number().int().min(1).max(1000)}).strict().default(DEFAULT_FEEDING_RATES)}).strict();
export const propertySchema=propertyInputSchema.extend({id:propertyIdSchema});
export const propertyCreateSchema=z.object({id:z.uuid(),profile:propertyInputSchema,initialBirds:z.array(z.number().int().min(0).max(1000000)).length(5).default([0,0,0,0,0])}).strict();
export const registrationSchema=z.object({username:z.string().min(1).max(64).regex(/^[A-Za-z0-9_.-]+$/),name:text(80).refine(s=>s.length>0),password:z.string().min(15).max(128),property:propertyCreateSchema}).strict();
