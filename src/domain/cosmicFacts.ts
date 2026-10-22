export function shuffleIndices(
  count: number,
  previousLast?: number,
  rng: () => number = Math.random
): number[] {
  if (count <= 0) return [];
  const indices = Array.from({ length: count }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // Boundary check: first item must not be identical to previousLast
  if (count > 1 && previousLast !== undefined && indices[0] === previousLast) {
    [indices[0], indices[indices.length - 1]] = [indices[indices.length - 1], indices[0]];
  }
  return indices;
}
