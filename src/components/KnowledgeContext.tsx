import { createContext, useContext } from "react";
import { KnowledgeItem } from "../types";

// Contexto que disponibiliza o índice de aliases e o callback de abertura do
// visualizador para qualquer <MarkdownContent> renderizar referências {{alias}}
// como chips clicáveis — sem precisar encadear props por toda a árvore.
export interface KnowledgeContextValue {
  aliasIndex: Map<string, KnowledgeItem>;
  onOpenKnowledge: (itemId: string) => void;
}

const EMPTY: KnowledgeContextValue = {
  aliasIndex: new Map(),
  onOpenKnowledge: () => {},
};

export const KnowledgeContext = createContext<KnowledgeContextValue>(EMPTY);

export function useKnowledge(): KnowledgeContextValue {
  return useContext(KnowledgeContext);
}
