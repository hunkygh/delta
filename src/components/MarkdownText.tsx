import type { ReactNode } from 'react';

interface MarkdownTextProps {
  text: string;
  className?: string;
}

const renderInline = (value: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }
    if (match[2] && match[3]) {
      nodes.push(
        <a key={`${match.index}-link`} href={match[3]} target="_blank" rel="noreferrer">
          {match[2]}
        </a>
      );
    } else if (match[4]) {
      nodes.push(<strong key={`${match.index}-strong`}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(<em key={`${match.index}-em`}>{match[5]}</em>);
    } else if (match[6]) {
      nodes.push(<code key={`${match.index}-code`}>{match[6]}</code>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }
  return nodes;
};

const renderBlocks = (text: string): ReactNode[] => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = Math.min(3, trimmed.match(/^#+/)?.[0].length || 1);
      const content = trimmed.replace(/^#{1,3}\s+/, '');
      if (level === 1) blocks.push(<h1 key={`h-${index}`}>{renderInline(content)}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h-${index}`}>{renderInline(content)}</h2>);
      else blocks.push(<h3 key={`h-${index}`}>{renderInline(content)}</h3>);
      index += 1;
      continue;
    }

    if (/^>\s+/.test(trimmed)) {
      blocks.push(<blockquote key={`q-${index}`}>{renderInline(trimmed.replace(/^>\s+/, ''))}</blockquote>);
      index += 1;
      continue;
    }

    const paragraph: string[] = [trimmed];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^[-*]\s+/.test(next) || /^#{1,3}\s+/.test(next) || /^>\s+/.test(next)) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push(<p key={`p-${index}`}>{renderInline(paragraph.join(' '))}</p>);
  }

  return blocks;
};

export default function MarkdownText({ text, className = '' }: MarkdownTextProps): JSX.Element {
  return <div className={['delta-markdown', className].filter(Boolean).join(' ')}>{renderBlocks(text)}</div>;
}
