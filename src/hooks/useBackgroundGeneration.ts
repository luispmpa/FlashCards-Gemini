import { useRef, useState, useCallback, useEffect } from 'react';

export interface BgGenConfig {
  deckId: string;
  subject: string;     // nome da matéria/assunto (entra no prompt)
  topicPrompt: string; // instrução opcional
  total: number;       // total de cards a gerar
  batchSize: number;   // cards por requisição
  intervalMin: number; // minutos entre lotes
  modelPreference: 'pro' | 'flash'; // Modelo selecionado (Flash é mais leve)
}

export interface BgGenStatus {
  running: boolean;
  generated: number;   // progresso da fila (cards solicitados; o salvo pode ser um pouco menor por dedup/filtro)
  total: number;
  config: BgGenConfig | null;
  lastError: string | null;
}

type GenerateFn = (deckId: string, subject: string, topicPrompt: string, count: number, modelPreference: 'pro' | 'flash') => Promise<number>;

const MIN_INTERVAL_MIN = 3;          // respeita o limite do servidor (20 gerações/hora)
const MAX_CONSECUTIVE_FAILURES = 5;  // pausa se a IA estiver realmente indisponível

export function useBackgroundGeneration(generate: GenerateFn) {
  const [status, setStatus] = useState<BgGenStatus>({
    running: false, generated: 0, total: 0, config: null, lastError: null,
  });

  // Mantém a referência mais recente de `generate` (que fecha sobre decks/cards atuais),
  // evitando usar dados desatualizados nos lotes futuros.
  const generateRef = useRef(generate);
  useEffect(() => { generateRef.current = generate; });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const generatedRef = useRef(0);
  const configRef = useRef<BgGenConfig | null>(null);
  const failuresRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const stop = useCallback((errorMsg: string | null = null) => {
    runningRef.current = false;
    clearTimer();
    setStatus(s => ({ ...s, running: false, lastError: errorMsg }));
  }, []);

  const runBatch = useCallback(async () => {
    if (!runningRef.current || !configRef.current) return;
    const cfg = configRef.current;

    const remaining = cfg.total - generatedRef.current;
    if (remaining <= 0) { stop(null); return; }

    const count = Math.min(cfg.batchSize, remaining);
    try {
      await generateRef.current(cfg.deckId, cfg.subject, cfg.topicPrompt, count, cfg.modelPreference);
      failuresRef.current = 0;
      generatedRef.current += count; // avança pelo solicitado para garantir término
      setStatus(s => ({ ...s, generated: generatedRef.current, lastError: null }));
    } catch (e: any) {
      failuresRef.current += 1;
      setStatus(s => ({ ...s, lastError: e?.message || 'Falha ao gerar.' }));
      if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        stop('Geração pausada: a IA parece indisponível. Tente novamente mais tarde.');
        return;
      }
      // não avança o progresso: tentará o mesmo lote no próximo tick
    }

    if (!runningRef.current) return;
    if (generatedRef.current >= cfg.total) { stop(null); return; }

    const delayMs = Math.max(cfg.intervalMin, MIN_INTERVAL_MIN) * 60 * 1000;
    timerRef.current = setTimeout(runBatch, delayMs);
  }, [stop]);

  const start = useCallback((cfg: BgGenConfig) => {
    clearTimer();
    const safe: BgGenConfig = {
      ...cfg,
      total: Math.max(1, Math.floor(cfg.total)),
      batchSize: Math.max(1, Math.floor(cfg.batchSize)),
      intervalMin: Math.max(MIN_INTERVAL_MIN, Math.floor(cfg.intervalMin)),
    };
    configRef.current = safe;
    generatedRef.current = 0;
    failuresRef.current = 0;
    runningRef.current = true;
    setStatus({ running: true, generated: 0, total: safe.total, config: safe, lastError: null });
    runBatch(); // primeiro lote imediato
  }, [runBatch]);

  useEffect(() => () => clearTimer(), []); // limpa ao desmontar

  return { status, start, stop };
}
