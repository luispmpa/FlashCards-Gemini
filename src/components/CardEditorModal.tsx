import { useState } from 'react';
import { Flashcard, KnowledgeItem } from '../types';
import { Loader2 } from 'lucide-react';
import { uploadImageFromPaste } from '../lib/imageUpload';
import { KnowledgeTextarea } from './KnowledgeTextarea';

interface CardEditorModalProps {
  card: Flashcard;
  onSave: (card: Flashcard) => void;
  onClose: () => void;
  knowledgeItems?: KnowledgeItem[];
}

/**
 * Modal reutilizável de edição de flashcard (frente/verso), com colagem de
 * imagens (Ctrl+V) e autocomplete de referências do Acervo. Usado tanto na
 * lista de Flashcards quanto durante o estudo.
 */
export function CardEditorModal({ card, onSave, onClose, knowledgeItems = [] }: CardEditorModalProps) {
  const [draft, setDraft] = useState<Flashcard>(card);
  const [isUploading, setIsUploading] = useState(false);

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>, field: 'front' | 'back') => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const textarea = e.currentTarget;
    const startPos = textarea.selectionStart || 0;
    const endPos = textarea.selectionEnd || 0;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;

        setIsUploading(true);
        try {
          const url = await uploadImageFromPaste(file);
          const markdownImage = `\n![imagem](${url})\n`;
          setDraft(prev => {
            const text = prev[field] || '';
            const newText = text.substring(0, startPos) + markdownImage + text.substring(endPos);
            return { ...prev, [field]: newText };
          });
          setTimeout(() => {
            if (textarea && !textarea.disabled) {
              const caret = startPos + markdownImage.length;
              textarea.selectionStart = caret;
              textarea.selectionEnd = caret;
              textarea.focus();
            }
          }, 100);
        } catch (error: any) {
          console.error('Failed to upload image', error);
          alert(error?.message || 'Erro ao enviar a imagem. Verifique sua chave da API.');
        } finally {
          setIsUploading(false);
        }
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[901] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-6 flex flex-col max-h-full relative">
        <h3 className="text-xl font-bold text-slate-800">Editar Flashcard</h3>
        <div className="space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
              <span>Frente (Questão)</span>
              <span className="text-xs text-slate-400 font-normal">Ctrl+V de imagens · "\" para referências</span>
            </label>
            <KnowledgeTextarea
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
              value={draft.front}
              onChange={v => setDraft({ ...draft, front: v })}
              onPaste={(e) => handlePaste(e, 'front')}
              items={knowledgeItems}
              disabled={isUploading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
              <span>Verso (Resposta e Explicação)</span>
              <span className="text-xs text-slate-400 font-normal">Ctrl+V de imagens · "\" para referências</span>
            </label>
            <KnowledgeTextarea
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-[200px]"
              value={draft.back}
              onChange={v => setDraft({ ...draft, back: v })}
              onPaste={(e) => handlePaste(e, 'back')}
              items={knowledgeItems}
              disabled={isUploading}
            />
          </div>
        </div>
        {isUploading && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
            <div className="flex items-center space-x-2 text-indigo-600 bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-medium text-sm">Enviando imagem...</span>
            </div>
          </div>
        )}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >Cancelar</button>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            disabled={isUploading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition shadow-sm disabled:opacity-50"
          >Salvar</button>
        </div>
      </div>
    </div>
  );
}
