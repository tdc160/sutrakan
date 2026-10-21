export const LEGACY_PROPERTY_ID='santo-expedito';
export const DEFAULT_FEEDING_RATES={inicio:40,crescimento:70,postura:110,engorda:120};
export const legacyProperty={id:LEGACY_PROPERTY_ID,name:'Chácara Santo Expedito',owner:'Talitom',region:'',hectares:0,productionType:'Avicultura caipira',feedingRates:DEFAULT_FEEDING_RATES};
export const defaultBirds=id=>id===LEGACY_PROPERTY_ID?[200,70,0,0,0]:[0,0,0,0,0];
export const dailyGrams=(property,recipe)=>property?.feedingRates?.[recipe]??DEFAULT_FEEDING_RATES[recipe];
export function assistantContext(state){return {propertyId:state.propertyId,property:state.property,flock:{total:state.birds.reduce((a,b)=>a+b,0),byShed:state.birds},records:state.records.length,feedingRates:state.property.feedingRates,capabilities:['avicultura','estoque de ração','produção de ovos','financeiro'],limitations:['As fórmulas disponíveis são avícolas. Área e região não alteram automaticamente o balanceamento nutricional.','Não há chat com modelo de linguagem conectado. Este contexto é a base para uma futura integração.']}}
