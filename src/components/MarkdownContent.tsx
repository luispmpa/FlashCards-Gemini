import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookMarked } from 'lucide-react';
import { cn } from '../lib/utils';
import { segmentText } from '../lib/knowledge';
import { useKnowledge } from './KnowledgeContext';

interface MarkdownContentProps {
  children: string;
  className?: string;
}

const highlightStyles: Record<string, string> = {
  mark: 'bg-yellow-200/80 text-slate-950 px-1 rounded',
  yellow: 'bg-yellow-200/80 text-slate-950 px-1 rounded',
  red: 'text-rose-700 bg-rose-50 px-1 rounded',
  green: 'text-emerald-700 bg-emerald-50 px-1 rounded',
  blue: 'text-indigo-700 bg-indigo-50 px-1 rounded',
};

const INLINE_TOKEN = /(\^\^[^^]+\^\^|==[^=]+==|\{(?:mark|yellow|red|green|blue):[^{}]+\})/gi;

// Estilo de "legenda" discreta — usado para metadados da questão (banca, ano,
// órgão, "Elaborada pelo professor") sem competir com o enunciado.
const CAPTION_CLASS = 'text-[11px] font-semibold uppercase tracking-wider text-slate-400';

function createFormattedNode(part: string, index: number) {
  if (part.startsWith('^^') && part.endsWith('^^')) {
    return {
      type: 'formattedText',
      data: { hName: 'span', hProperties: { className: CAPTION_CLASS } },
      children: [{ type: 'text', value: part.slice(2, -2) }],
      position: undefined,
      key: index,
    };
  }

  if (part.startsWith('==') && part.endsWith('==')) {
    return {
      type: 'formattedText',
      data: { hName: 'mark', hProperties: { className: highlightStyles.mark } },
      children: [{ type: 'text', value: part.slice(2, -2) }],
      position: undefined,
      key: index,
    };
  }

  const colorMatch = part.match(/^\{(mark|yellow|red|green|blue):([^{}]+)\}$/i);
  if (colorMatch) {
    const tone = colorMatch[1].toLowerCase();
    return {
      type: 'formattedText',
      data: { hName: 'span', hProperties: { className: highlightStyles[tone] } },
      children: [{ type: 'text', value: colorMatch[2] }],
      position: undefined,
      key: index,
    };
  }

  return { type: 'text', value: part };
}

function remarkInlineFormatting() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (!node?.children) return;

      node.children = node.children.flatMap((child: any) => {
        if (child.type !== 'text' || !INLINE_TOKEN.test(child.value)) {
          INLINE_TOKEN.lastIndex = 0;
          visit(child);
          return [child];
        }

        INLINE_TOKEN.lastIndex = 0;
        return child.value
          .split(INLINE_TOKEN)
          .filter(Boolean)
          .map(createFormattedNode);
      });

      node.children.forEach(visit);
    };

    visit(tree);
  };
}

// Converte referências (\alias ou {{alias}}) presentes em nós de texto em nós
// "span" marcados com data-kb-alias, renderizados como chips clicáveis.
function remarkKnowledgeRefs() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (!node?.children) return;

      node.children = node.children.flatMap((child: any) => {
        if (child.type !== 'text' || (child.value.indexOf('{{') === -1 && child.value.indexOf('\\') === -1)) {
          visit(child);
          return [child];
        }

        const segments = segmentText(child.value);
        if (!segments.some(s => s.type === 'reference')) return [child];

        return segments.map(seg => {
          if (seg.type === 'text') return { type: 'text', value: seg.value };
          return {
            type: 'kbReference',
            data: { hName: 'span', hProperties: { className: 'kb-ref', 'data-kb-alias': seg.value } },
            children: [{ type: 'text', value: seg.value }],
          };
        });
      });

      node.children.forEach(visit);
    };

    visit(tree);
  };
}

// Chip que resolve o alias no Acervo e abre o visualizador ao ser clicado.
function KnowledgeRefChip({ alias }: { alias: string }) {
  const { aliasIndex, onOpenKnowledge } = useKnowledge();
  const item = aliasIndex.get(alias);

  if (!item) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 align-baseline text-[0.85em] font-medium text-slate-400 line-through"
        title={`Referência não encontrada no Acervo: ${alias}`}
      >
        {alias}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenKnowledge(item.id);
      }}
      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 align-baseline text-[0.85em] font-semibold text-indigo-700 no-underline transition-colors hover:bg-indigo-100"
      title={item.description || item.title}
    >
      <BookMarked size={12} aria-hidden="true" />
      {item.title}
    </button>
  );
}

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={cn('max-w-none prose prose-slate prose-sm prose-headings:font-bold prose-a:text-indigo-600 prose-mark:bg-yellow-200 prose-mark:px-1 prose-mark:rounded', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkInlineFormatting, remarkKnowledgeRefs]}
        components={{
          span: ({ node, children, ...props }: any) => {
            // O nome da propriedade pode chegar como camelCase (dataKbAlias) ou
            // com o hífen literal, dependendo da normalização — cobrimos ambos.
            const p = node?.properties || {};
            const alias = p.dataKbAlias ?? p['data-kb-alias'] ?? props['data-kb-alias'];
            if (typeof alias === 'string' && alias) return <KnowledgeRefChip alias={alias} />;
            return <span {...props}>{children}</span>;
          },
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
          h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold text-slate-900 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold text-slate-900 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-bold text-slate-800 first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
          del: ({ children }) => <del className="text-slate-400">{children}</del>,
          code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">{children}</code>,
          hr: () => <hr className="my-4 border-slate-200" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{children}</a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-r border-l-4 border-indigo-300 bg-indigo-50/60 px-4 py-2 text-slate-700">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-slate-900">{children}</thead>,
          tr: ({ children }) => <tr className="even:bg-slate-50/60">{children}</tr>,
          th: ({ children }) => <th className="border-b border-slate-200 px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-100 px-3 py-2 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
