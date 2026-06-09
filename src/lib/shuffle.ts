// Embaralhamento imparcial (Fisher-Yates / Knuth). Diferente de
// `array.sort(() => Math.random() - 0.5)` — que produz distribuições enviesadas
// e tem comportamento dependente do motor de ordenação — esta função garante que
// toda permutação seja igualmente provável. Retorna um NOVO array (não muta a entrada).
export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
