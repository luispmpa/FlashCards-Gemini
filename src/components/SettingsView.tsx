import React, { useState } from 'react';
import { getUserSettings, saveUserSettings } from '../lib/settings';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface SettingsViewProps {
  cardCount: number;
  onClearAllData: () => Promise<void>;
}

export function SettingsView({ cardCount, onClearAllData }: SettingsViewProps) {
  const [settings, setSettings] = useState(getUserSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Danger zone
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: parseInt(e.target.value) || 0 }));
    setSaveSuccess(false);
  };

  const handleSave = () => {
    saveUserSettings(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleClear = async () => {
    if (confirmText !== "APAGAR") return;
    setClearing(true);
    try {
      await onClearAllData();
      setConfirmText("");
    } finally {
      setClearing(false);
    }
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

      <div className="bg-white p-6 rounded-xl border border-rose-200">
        <h3 className="text-lg font-bold text-rose-700 mb-2 flex items-center gap-2">
          <AlertTriangle size={20} /> Zona de Perigo
        </h3>
        <p className="text-slate-600 text-sm mb-4">
          Apaga <strong>todos os {cardCount} flashcards</strong> e <strong>todo o histórico de revisões</strong> da sua conta.
          As matérias e tópicos serão mantidos. <strong>Esta ação não pode ser desfeita.</strong>
        </p>
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Para confirmar, digite <span className="font-mono font-bold">APAGAR</span>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="APAGAR"
              className="w-full px-3 py-2 border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
          <button
            onClick={handleClear}
            disabled={confirmText !== "APAGAR" || clearing}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {clearing ? <><Loader2 className="animate-spin" size={16} /> Apagando...</> : "Apagar todos os flashcards"}
          </button>
        </div>
      </div>
    </div>
  );
}
