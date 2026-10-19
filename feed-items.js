export const ingredients=['Quirera de milho','Milho em grão inteiro','Núcleo de engorda','Núcleo de início','Núcleo de crescimento','Núcleo de postura','Farelo de soja','Farelo de trigo','Calcário calcítico','Ração pronta','Outro ingrediente'];
export const nucleusConcentrations = [3,4,5];
export const isNucleus = ingredient => typeof ingredient==='string' && ingredient.startsWith('Núcleo de ');
export const ingredientPriceKey = (ingredient, concentration) => isNucleus(ingredient) ? `${ingredient}::${concentration ?? 'unknown'}` : ingredient;
export const feedItemLabel = record => record.ingredient ? record.ingredient + (isNucleus(record.ingredient) ? (record.concentration ? ` · ${record.concentration}%` : ' · concentração não informada') : '') : 'Ração sem detalhamento (registros anteriores)';
