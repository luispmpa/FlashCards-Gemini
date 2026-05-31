import { Deck, Flashcard } from "../types";
import { v4 as uuidv4 } from "uuid";
import { createInitialFSRSData } from "../lib/fsrs";
import { subDays } from "date-fns";

export const MOCK_DECKS: Deck[] = [
  { id: "root-afo", name: "AFO (Orçamento)", createdAt: new Date() },
  { id: "root-diradmin", name: "Direito Administrativo", createdAt: new Date() },
  { id: "root-dirconst", name: "Direito Constitucional", createdAt: new Date() },
  { id: "root-port", name: "Português", createdAt: new Date() },
  { id: "sub-afo-1", parentId: "root-afo", name: "Princípios Orçamentários", createdAt: new Date() },
  { id: "sub-diradmin-1", parentId: "root-diradmin", name: "Atos Administrativos", createdAt: new Date() },
];

export const MOCK_CARDS: Flashcard[] = [
  {
    id: uuidv4(),
    deckId: "sub-afo-1",
    front: "O princípio orçamentário que estabelece que a Lei Orçamentária Anual não conterá dispositivo estranho à previsão da receita e à fixação da despesa é o Princípio da:",
    options: [
      "A) Exclusividade",
      "B) Universalidade",
      "C) Unidade",
      "D) Anualidade",
      "E) Não afetação de receitas"
    ],
    back: "Gabarito: A\n\nO princípio da Exclusividade (art. 165, § 8º, da CF) determina que a LOA não conterá dispositivo estranho à previsão da receita e à fixação da despesa, não se incluindo na proibição a autorização para abertura de créditos suplementares e contratação de operações de crédito, ainda que por antecipação de receita (ARO).",
    fsrsData: createInitialFSRSData(),
    createdAt: new Date(),
    tags: ["afo", "princípios"],
  },
  {
    id: uuidv4(),
    deckId: "sub-diradmin-1",
    front: "Os atributos dos atos administrativos incluem, EXCETO:",
    options: [
      "A) Presunção de legitimidade",
      "B) Imperatividade",
      "C) Autoexecutoriedade",
      "D) Tipicidade",
      "E) Irrevogabilidade"
    ],
    back: "Gabarito: E\n\nOs atributos do ato administrativo formam o mnemônico PATI: Presunção de legitimidade, Autoexecutoriedade, Tipicidade e Imperatividade. O ato administrativo não é irrevogável por natureza; a revogação ocorre por razões de conveniência e oportunidade.",
    fsrsData: {
        ...createInitialFSRSData(),
        state: "Review",
        due: subDays(new Date(), 2), // overdue
        stability: 3,
        reps: 2
    },
    createdAt: new Date(),
    tags: ["atos"],
  }
];
