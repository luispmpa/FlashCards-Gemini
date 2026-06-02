import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

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

const INLINE_TOKEN = /(==[^=]+==|\{(?:mark|yellow|red|green|blue):[^{}]+\})/gi;

function createFormattedNode(part: string, index: number) {
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

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={cn('max-w-none prose prose-slate prose-sm prose-headings:font-bold prose-a:text-indigo-600 prose-mark:bg-yellow-200 prose-mark:px-1 prose-mark:rounded', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkInlineFormatting]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap">{children}</p>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
          code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-800">{children}</code>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
