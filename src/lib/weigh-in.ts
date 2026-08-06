// Pesaje digital — interpreta el string de categoría de peso ("-63kg" | "+84kg" | "open")
// definido en tournament-categories.ts y evalúa un peso medido contra el límite.

export interface WeightBounds {
  min: number | null; // categorías "+Xkg" (peso mínimo)
  max: number | null; // categorías "-Xkg" (peso máximo)
}

export function parseWeightCategoryBounds(weightCategory: string | null): WeightBounds {
  if (!weightCategory || weightCategory === "open") return { min: null, max: null };
  const max = weightCategory.match(/^-(\d+(?:\.\d+)?)kg$/);
  if (max) return { min: null, max: parseFloat(max[1]) };
  const min = weightCategory.match(/^\+(\d+(?:\.\d+)?)kg$/);
  if (min) return { min: parseFloat(min[1]), max: null };
  return { min: null, max: null };
}

export type WeighInStatus = "ok" | "over" | "under";

export function evaluateWeighIn(
  actualWeight: number,
  weightCategory: string | null,
  toleranceKg: number,
): WeighInStatus {
  const { min, max } = parseWeightCategoryBounds(weightCategory);
  if (max !== null && actualWeight > max + toleranceKg) return "over";
  if (min !== null && actualWeight < min - toleranceKg) return "under";
  return "ok";
}
