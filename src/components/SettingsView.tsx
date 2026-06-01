import React, { useState } from 'react';
import { getUserSettings, saveUserSettings } from '../lib/settings';
import { Deck } from '../types';
import { BgGenConfig, BgGenStatus } from '../hooks/useBackgroundGeneration';

interface SettingsViewProps {
  decks: Deck[];
  bgGenStatus: BgGenStatus;
  onStartBgGen: (cfg: BgGenConfig) => void;
  onStopBgGen: () => void;
}

export function SettingsView({ decks, bgGenStatus, onStartBgGen, onStopBgGen }: SettingsViewProps) {
  const [settings, setSettings] = useState(getUserSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Status for Background Generator
  const [bgDeckId, setBgDeckId] = useState("");
  const [bgTopicPrompt, setBgTopicPrompt] = useState("");
  const [bgTotal, setBgTotal] = useState(30);
  const [bgBatchSize, setBgBatchSize] = useState(10);
  const [bgIntervalMin, setBgIntervalMin] = useState(5);

  const flatDecks = decks.map(d => {
    if (!d.parentId) return d;
    const parent = decks.find(p => p.id === d.parentId);
    return { ...d, name: parent ? `${parent.name} - ${d.name}` : d.name };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: parseInt(e.target.value) || 0 }));
    setSaveSuccess(false);
  };

  const handleSave = () => {
    saveUserSettings(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-6">Configurações</h2>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Metas Diárias</h3>
        <div className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Novos cartões por dia</label>
            <input 
              type="number" 
              name="newPerDay"
              value={settings.newPerDay}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Revisões máximas por dia</label>
            <input 
              type="number" 
              name="reviewsPerDay"
              value={settings.reviewsPerDay}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
            Salvar
          </button>
          {saveSuccess && <span className="ml-3 text-sm text-green-600">Salvo!</span>}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Informações do FSRS</h3>
        <p className="text-slate-600 text-sm">
            O algoritmo de espaçamento está operando usando FSRS v5 (via ts-fsrs). O limite máximo de intervalo está configurado para anos, visando evitar o estouro de agendamentos longos, sem perder granularidade.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Geração em segundo plano (beta)</h3>
        <p className="text-slate-500 text-sm mb-6">Gera novos flashcards em lotes automaticamente enquanto o aplicativo está aberto. Funciona apenas com o aplicativo aberto. Ao fechar a aba, a geração para.</p>
        
        <div className="space-y-4 max-w-lg">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Matéria / Assunto</label>
             <select 
               value={bgDeckId} 
               onChange={e => setBgDeckId(e.target.value)}
               disabled={bgGenStatus.running}
               className="w-full px-3 py-2 border rounded-lg bg-slate-50"
             >
               <option value="">Selecione uma matéria</option>
               {flatDecks.map(d => (
                 <option key={d.id} value={d.id}>{d.name}</option>
               ))}
             </select>
           </div>
           
           <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instrução Opcional</label>
              <textarea 
                value={bgTopicPrompt}
                onChange={e => setBgTopicPrompt(e.target.value)}
                disabled={bgGenStatus.running}
                placeholder="Ex: Focar apenas nos artigos 5 a 15 da CF..."
                className="w-full px-3 py-2 border rounded-lg h-20 bg-slate-50"
              />
           </div>

           <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total a gerar</label>
                <input 
                  type="number" min="1" 
                  value={bgTotal} onChange={e => setBgTotal(parseInt(e.target.value) || 1)}
                  disabled={bgGenStatus.running}
                  className="w-full px-3 py-2 border rounded-lg bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cards / lote</label>
                <input 
                  type="number" min="1" 
                  value={bgBatchSize} onChange={e => setBgBatchSize(parseInt(e.target.value) || 1)}
                  disabled={bgGenStatus.running}
                  className="w-full px-3 py-2 border rounded-lg bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intervalo (min)</label>
                <input 
                  type="number" min="3" 
                  value={bgIntervalMin} onChange={e => setBgIntervalMin(parseInt(e.target.value) || 3)}
                  disabled={bgGenStatus.running}
                  className="w-full px-3 py-2 border rounded-lg bg-slate-50"
                />
                <p className="text-xs text-slate-400 mt-1">Mínimo 3</p>
              </div>
           </div>

           <div className="pt-4 flex items-center justify-between border-t border-slate-100">
               {bgGenStatus.running ? (
                  <div className="flex-1 mr-4">
                     <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-indigo-700 font-semibold flex items-center gap-2">
                           <span className="animate-spin">⏳</span> Gerando...
                        </span>
                        <span className="text-sm font-bold text-slate-700">{bgGenStatus.generated} / {bgGenStatus.total}</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((bgGenStatus.generated/bgGenStatus.total)*100))}%` }}></div>
                     </div>
                     {bgGenStatus.lastError && <p className="text-xs text-rose-600 mt-2">{bgGenStatus.lastError}</p>}
                  </div>
               ) : (
                  <div className="flex-1 mr-4 text-sm text-slate-500">
                     {bgGenStatus.lastError && <p className="text-rose-600 font-medium">Erro Anterior: {bgGenStatus.lastError}</p>}
                  </div>
               )}

               {bgGenStatus.running ? (
                  <button onClick={() => onStopBgGen()} className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-medium rounded-lg">Parar</button>
               ) : (
                  <button 
                    onClick={() => {
                       const deck = decks.find(d => d.id === bgDeckId);
                       if (deck) {
                         onStartBgGen({ deckId: bgDeckId, subject: deck.name, topicPrompt: bgTopicPrompt, total: bgTotal, batchSize: bgBatchSize, intervalMin: bgIntervalMin });
                       }
                    }}
                    disabled={!bgDeckId}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50"
                  >
                     Iniciar geração
                  </button>
               )}
           </div>
        </div>
      </div>
    </div>
  );
}
