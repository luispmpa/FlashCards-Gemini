export const normalizeTopic = (name: string): string => {
  return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/\s*\(.*?\)\s*/g, ' ') // Remove parentheses like (Lei nº 8.429/92) or (Lei nº 14.133/2021)
      .replace(/[^a-z0-9\s]/g, ' ')   // Remove non-alphanumeric
      .trim()
      .replace(/\s+/g, ' ');          // Collapse spaces
};

export const stemPortugueseWord = (w: string): string => {
  if (w.length <= 3) return w;
  let stemmed = w;
  // Plural removal
  if (stemmed.endsWith('s')) {
      stemmed = stemmed.slice(0, -1);
  }
  // 'oe' -> 'ao'
  if (stemmed.endsWith('oe')) {
      stemmed = stemmed.slice(0, -2) + 'ao';
  }
  // Masculine/feminine uniformization
  if (stemmed.endsWith('a')) {
      stemmed = stemmed.slice(0, -1) + 'o';
  }
  // 'ai'/'ei'/'oi' -> 'al'/'el'/'ol'
  if (stemmed.endsWith('ai') || stemmed.endsWith('ei') || stemmed.endsWith('oi')) {
      stemmed = stemmed.slice(0, -1) + 'l';
  }
  return stemmed;
};

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Procura, entre os candidatos, um tópico semelhante a `topicName` (mesmo helper de
// similaridade usado no resto do app). Útil no import para reaproveitar um subtópico
// existente em vez de criar um duplicado/redundante.
export const findSimilarDeck = <T extends { name: string }>(
  topicName: string,
  candidates: T[],
  subjectName?: string
): T | undefined => candidates.find(d => isSimilarTopic(d.name, topicName, subjectName));

export const isSimilarTopic = (nameA: string, nameB: string, subjectName?: string): boolean => {
  const normA = normalizeTopic(nameA);
  const normB = normalizeTopic(nameB);
  
  if (normA === normB) return true;
  if (!normA || !normB) return false;

  // Simple direct substring checks
  if (normA.includes(normB) || normB.includes(normA)) {
      // Except if they both are extremely short words to avoid matching "Atos" with "Atos Administrativos" 
      // if they are actually denoting something broader, but generally substring is a strong indicator.
      if (normA.length > 3 && normB.length > 3) return true;
  }

  // Levenshtein for close typos/variations (e.g., "licitacoes" vs "licitacao")
  const dist = levenshteinDistance(normA, normB);
  // Allow up to 30% difference in spelling
  const maxLen = Math.max(normA.length, normB.length);
  if (dist / maxLen <= 0.3) {
      return true;
  }
  
  const stopwords = new Set([
      'e', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'um', 'uma', 'no', 'na', 'nos', 'nas', 
      'para', 'com', 'por', 'sobre', 'sob', 'art', 'artigo', 'lei', 'decreto', 'regulamento', 'poker',
      'geral', 'basico', 'introducao', 'teoria', 'questoes', 'questao', 'n', 'no', 'num', 'numero',
      'principios', 'conceitos', 'fundamentos', 'noções', 'nocoes', 'normas', 'aspectos'
  ]);

  if (subjectName) {
      const subjectTokens = normalizeTopic(subjectName).split(' ');
      subjectTokens.forEach(token => {
          if (token.length > 2) {
              stopwords.add(token);
              // Also add its stem
              stopwords.add(stemPortugueseWord(token));
          }
      });
  }
  
  const wordsA = normA.split(' ').filter(w => w.length > 1 && !stopwords.has(w)).map(stemPortugueseWord);
  const wordsB = normB.split(' ').filter(w => w.length > 1 && !stopwords.has(w)).map(stemPortugueseWord);
  
  // If filtering left us with empty arrays, fallback to containing stopwords to check
  const finalWordsA = wordsA.length > 0 ? wordsA : normA.split(' ').filter(w => w.length > 1).map(stemPortugueseWord);
  const finalWordsB = wordsB.length > 0 ? wordsB : normB.split(' ').filter(w => w.length > 1).map(stemPortugueseWord);

  if (finalWordsA.length === 0 || finalWordsB.length === 0) return false;
  
  // Find intersection of words
  const setB = new Set(finalWordsB);
  const intersection = finalWordsA.filter(w => setB.has(w));
  
  if (intersection.length === 0) return false;
  
  // If all words of one is in the other, they are similar (e.g. "Licitações" and "Dispensa de Licitações")
  const allAInB = finalWordsA.every(w => setB.has(w));
  const setA = new Set(finalWordsA);
  const allBInA = finalWordsB.every(w => setA.has(w));
  if (allAInB || allBInA) return true;
  
  // Otherwise, require at least 50% overlap of the smaller set of words
  const minLength = Math.min(finalWordsA.length, finalWordsB.length);
  const overlapRatio = intersection.length / minLength;
  
  return overlapRatio >= 0.5;
};
