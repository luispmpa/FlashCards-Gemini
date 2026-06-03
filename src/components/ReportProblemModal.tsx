import { useState } from 'react';
import { X, Copy, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ReportProblemModal({ isOpen, onClose }: ReportProblemModalProps) {
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<'input' | 'copied'>('input');
  const [copyError, setCopyError] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const textToCopy = `Report de Problema/Bug:\n${description}\n\nPor favor, analise as descrições acima e corrija o problema reportado.`;
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      // Em contextos sem permissão de área de transferência (ou HTTP),
      // avisamos o usuário para copiar manualmente em vez de fingir sucesso.
      setCopyError(true);
      return;
    }
    setCopyError(false);
    setStep('copied');
    setTimeout(() => {
        onClose();
        setTimeout(() => {
            setStep('input');
            setDescription("");
        }, 500);
    }, 3500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <AlertCircle className="text-amber-500" size={24} />
            <h2 className="text-xl font-bold text-slate-800">Relatar Problema</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          {step === 'input' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Descreva detalhadamente o erro encontrado ou o problema vivenciado. Ao clicar em gerar, um relatório formatado será copiado automaticamente.
              </p>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição do Erro</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full h-32 p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Ex: Tentei excluir a matéria X, mas o card Y continuou aparecendo com um erro de leitura..."
                />
              </div>

              {copyError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  Não foi possível copiar automaticamente. Selecione o texto da descrição acima e copie manualmente (Ctrl+C).
                </p>
              )}

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={handleCopy}
                  disabled={description.trim().length === 0}
                  className="flex items-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  <Copy size={16} />
                  <span>Gerar e Copiar Relatório</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Copiado com Sucesso!</h3>
                <p className="text-sm text-slate-600 max-w-sm mx-auto">
                  A mensagem foi copiada. Volte à aba do <strong>Google AI Studio</strong> e cole (Ctrl+V) no chat para relatar ao assistente AI.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
