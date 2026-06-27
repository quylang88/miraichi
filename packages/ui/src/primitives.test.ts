import { describe, expect, it } from 'vitest';
import { THEME, renderButton, renderCard } from './primitives.js';

describe('ui primitives', () => {
  it('renders buttons with stable Miraichi classes and attributes', () => {
    expect(renderButton('Save', 'save-button', 'primary')).toBe(
      '<button id="save-button" class="miraichi-btn primary">Save</button>'
    );
  });

  it('renders cards with title and body slots', () => {
    const html = renderCard('Title', '<p>Body</p>', 'compact');

    expect(html).toContain('miraichi-card compact');
    expect(html).toContain('<h3 class="miraichi-card-title">Title</h3>');
    expect(html).toContain('<div class="miraichi-card-body"><p>Body</p></div>');
  });

  it('exposes CSS-variable based theme tokens', () => {
    expect(THEME.colors.primary).toBe('var(--miraichi-primary, #3b82f6)');
  });
});
