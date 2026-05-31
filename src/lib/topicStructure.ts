// Estrutura canônica de matérias (decks raiz) e seus assuntos/tópicos (subdecks).
// Compartilhada entre a migração no app (src/lib/migration.ts) e o script de
// seed direto no banco (scripts/seed-topics.ts) para evitar divergência.

export interface TopicGroup {
  name: string;
  subtopics: string[];
}

export const TARGET_STRUCTURE: TopicGroup[] = [
  {
    name: "Direito Administrativo",
    subtopics: [
      "Princípios administrativos",
      "Atos administrativos",
      "Poderes administrativos",
      "Organização administrativa",
      "Agentes públicos",
      "Licitações e contratos (Lei 14.133)",
      "Responsabilidade civil do Estado",
      "Improbidade administrativa",
      "Serviços públicos",
      "Controle da Administração"
    ]
  },
  {
    name: "Direito Constitucional",
    subtopics: [
      "Princípios fundamentais",
      "Direitos e garantias fundamentais",
      "Organização do Estado",
      "Administração Pública",
      "Poder Legislativo",
      "Poder Executivo",
      "Poder Judiciário",
      "Controle de constitucionalidade",
      "Processo legislativo",
      "Poder constituinte"
    ]
  },
  {
    name: "AFO - Administração Financeira Orçamentária",
    subtopics: [
      "PPA",
      "LDO",
      "LOA",
      "Créditos adicionais",
      "Receita pública",
      "Despesa pública",
      "Restos a pagar",
      "LRF",
      "Ciclo orçamentário",
      "Execução orçamentária"
    ]
  }
];
