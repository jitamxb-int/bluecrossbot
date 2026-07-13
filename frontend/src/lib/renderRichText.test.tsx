import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderInlineText } from './renderRichText';

describe('renderInlineText', () => {
  it('renders URLs as clickable links while preserving bold formatting', () => {
    const { container } = render(<>{renderInlineText('Please see https://example.com for details and **more info**.')}</>);

    const link = container.querySelector('a[href="https://example.com"]');
    expect(link).toBeTruthy();
    expect(link?.textContent).toBe('https://example.com');
    expect(container.querySelector('strong')?.textContent).toBe('more info');
  });
});
