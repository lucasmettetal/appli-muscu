import { type ReactNode } from 'react';

// Rendu Markdown léger et sans dépendance, ciblé sur ce que produit le Coach IA :
// titres (#…), **gras**, *italique*, listes à puces/numérotées, séparateurs ---.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-gray-900">{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i}`} className="text-gray-500">{m[2]}</em>);
    } else if (m[3] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-c${i}`} className="bg-gray-100 rounded px-1 text-[0.85em]">{m[3]}</code>);
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isBullet = (l: string) => /^\s*[-*+]\s+/.test(l);
const isNumbered = (l: string) => /^\s*\d+\.\s+/.test(l);
const isHr = (l: string) => /^(-{3,}|\*{3,}|_{3,})$/.test(l.trim());
const headingMatch = (l: string) => l.trim().match(/^(#{1,6})\s+(.*)$/);

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    if (isHr(line)) {
      blocks.push(<hr key={key++} className="my-2.5 border-gray-200" />);
      i++;
      continue;
    }

    const h = headingMatch(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level <= 2 ? 'text-[15px] font-bold text-gray-900 mt-3 first:mt-0'
        : level === 3 ? 'text-sm font-bold text-gray-900 mt-3 first:mt-0'
        : 'text-sm font-semibold text-gray-800 mt-2 first:mt-0';
      blocks.push(<p key={key++} className={cls}>{renderInline(h[2], `h${key}`)}</p>);
      i++;
      continue;
    }

    if (isBullet(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        const item = lines[i].replace(/^\s*[-*+]\s+/, '');
        items.push(<li key={items.length}>{renderInline(item, `ul${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ul key={key++} className="list-disc pl-5 my-1.5 space-y-1">{items}</ul>);
      continue;
    }

    if (isNumbered(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isNumbered(lines[i])) {
        const item = lines[i].replace(/^\s*\d+\.\s+/, '');
        items.push(<li key={items.length}>{renderInline(item, `ol${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ol key={key++} className="list-decimal pl-5 my-1.5 space-y-1">{items}</ol>);
      continue;
    }

    // Paragraphe : regroupe les lignes consécutives « normales ».
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isBullet(lines[i]) &&
      !isNumbered(lines[i]) &&
      !headingMatch(lines[i]) &&
      !isHr(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1">
        {para.map((pl, idx) => (
          <span key={idx}>
            {renderInline(pl, `p${key}-${idx}`)}
            {idx < para.length - 1 && <br />}
          </span>
        ))}
      </p>,
    );
  }

  return <div className="space-y-0.5">{blocks}</div>;
}
