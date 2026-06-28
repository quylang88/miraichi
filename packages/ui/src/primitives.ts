/**
 * UI Primitives for Miraichi.
 * Purely presentational utilities and tokens using Vanilla CSS.
 */

export const THEME = {
  colors: {
    bg: 'var(--miraichi-bg, #0f172a)',
    text: 'var(--miraichi-text, #f8fafc)',
    primary: 'var(--miraichi-primary, #3b82f6)',
    secondary: 'var(--miraichi-secondary, #64748b)',
    border: 'var(--miraichi-border, #334155)',
    accent: 'var(--miraichi-accent, #10b981)',
    danger: 'var(--miraichi-danger, #ef4444)'
  }
};

/**
 * Creates a styled button HTML string.
 *
 * @param {string} label
 * @param {string} id
 * @param {string} className
 * @returns {string} HTML string
 */
export function createBadge(label: string, id: string = '', className: string = '') {
  return `<button id="${id}" class="miraichi-btn ${className}">${label}</button>`;
}

/**
 * Creates a styled card HTML string.
 *
 * @param {string} title
 * @param {string|HTMLElement} content
 * @param {string} className
 * @returns {string} HTML string
 */
export function createCard(title: string, content: string | HTMLElement, className: string = '') {
  return `
    <div class="miraichi-card ${className}">
      <h3 class="miraichi-card-title">${title}</h3>
      <div class="miraichi-card-body">${content}</div>
    </div>
  `;
}
