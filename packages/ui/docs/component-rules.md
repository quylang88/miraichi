# Component Design Rules

Directives for building reusable, accessible UI elements.

## Purpose
Establishes the structural rules for custom UI components.

## Status
- **Status**: Active

## Scope
Governs components files structure, state passing, and styling rules.

## Design Rules
1. **Framework Agnosticism**: Keep core component logic separate from HTML rendering where possible.
2. **Vanilla Styling**: All styling must live in accompanying `.css` files rather than dynamic in-line scripts.
3. **Accessibility**: All interactive elements must support proper aria roles and target labels.

## TODO / Next Steps
- [ ] Set up lint rules for custom accessibility tags.
