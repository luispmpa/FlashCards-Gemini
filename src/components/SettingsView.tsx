import React, { useState } from 'react';
import { getUserSettings, saveUserSettings } from '../lib/settings';

export function SettingsView() {
  const [settings, setSettings] = useState(getUserSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    </div>
  );
}
