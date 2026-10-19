export const nucleusConcentrations = [3,4,5];
export const isNucleus = ingredient => typeof ingredient==='string' && ingredient.startsWith('Núcleo de ');
export const ingredientPriceKey = (ingredient, concentration) => isNucleus(ingredient) ? `${ingredient}::${concentration ?? 'unknown'}` : ingredient;
export const feedItemLabel = record => record.ingredient ? record.ingredient + (isNucleus(record.ingredient) ? (record.concentration ? ` · ${record.concentration}%` : ' · concentração não informada') : '') : 'Ração sem detalhamento (registros anteriores)';
