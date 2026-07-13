import type { ReactNode } from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const BOLD_REGEX = /(\*\*[^*]+\*\*)/g;

export function renderInlineText(text: string): ReactNode {
  if (!text) return null;

  const parts = text.split(URL_REGEX);
  const elements: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (!part) return;

    if (/^https?:\/\//.test(part)) {
      elements.push(
        <a
          key={`url-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', textDecoration: 'underline' }}
        >
          {part}
        </a>
      );
      return;
    }

    const boldParts = part.split(BOLD_REGEX);
    boldParts.forEach((segment, segmentIndex) => {
      if (!segment) return;
      if (segment.startsWith('**') && segment.endsWith('**')) {
        elements.push(
          <strong key={`bold-${index}-${segmentIndex}`} style={{ color: '#1d4ed8' }}>
            {segment.slice(2, -2)}
          </strong>
        );
      } else {
        elements.push(<span key={`text-${index}-${segmentIndex}`}>{segment}</span>);
      }
    });
  });

  return <>{elements}</>;
}
