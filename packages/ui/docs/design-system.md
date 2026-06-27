# Design System Specification

Aesthetic standards, CSS tokens, and component guidelines for Miraichi.

## Purpose
Establishes the design language (colors, layouts, interactions) to achieve a modern, premium user experience.

## Status
- **Status**: Active

## Scope
Design system variables, color palettes, dark modes, typography, and animation tokens.

## Rich Aesthetic Guidelines
To build a stunning, premium aesthetic that wows users at first glance, follow these requirements:

### 1. Curated Color Palette
- **Primary Color (Agnostic Gold/Bronze)**: HSL(38, 70%, 55%) - Represents predictive excellence.
- **Secondary (Deep Sapphire)**: HSL(220, 45%, 12%) - Background canvas base.
- **Accent (Electric Indigo)**: HSL(255, 85%, 65%) - Selected states, prediction indicators.
- **Dark Mode Card Color**: HSL(220, 30%, 18%) with glassmorphic backdrop filters.

### 2. Glassmorphism & Depth
- Utilize transparent overlays: `background: rgba(30, 40, 60, 0.65)`
- Apply blurred backdrops: `backdrop-filter: blur(12px)`
- Subtle borders: `border: 1px solid rgba(255, 255, 255, 0.08)`

### 3. Typography & Gradients
- Font Family: Inter, System UI.
- Heading Typography: Outfit or Space Grotesk.
- Text Gradients: `linear-gradient(135deg, #fff 0%, HSL(220, 20%, 75%) 100%)` for headlines.

### 4. Interactive Micro-Animations
- Smooth transitions for hover: `transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)`
- Add active scale-down: `transform: scale(0.98)` for buttons.

## TODO / Next Steps
- [ ] Implement utility variables CSS file.
- [ ] Design mock component library in Storybook.
