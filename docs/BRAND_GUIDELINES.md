# Publo Brand Guidelines

## Brand Philosophy

Publo is a creative writing assistant that empowers storytellers. The brand should feel:
- **Warm & Welcoming**: Approachable and encouraging
- **Creative & Playful**: Inspiring without being overwhelming  
- **Professional**: Reliable and trustworthy
- **Modern**: Clean, contemporary design

## Color Palette

### Primary Colors

**Yellow** - Our signature color representing creativity, optimism, and inspiration

```css
--brand-yellow-400: #facc15  /* Primary brand color */
--brand-yellow-300: #fde047  /* Lighter variant */
--brand-yellow-500: #eab308  /* Darker variant */
```

**Usage:**
- Primary actions (buttons, CTAs)
- Focus states and interactive elements
- Active/selected states
- Highlights and accents

### Complementary Colors

**Warm Amber** - For info messages and secondary accents

```css
--brand-amber-50: #fffbeb   /* Info backgrounds */
--brand-amber-100: #fef3c7  /* Info borders */
--brand-amber-400: #fbbf24  /* Info accents */
```

**Usage:**
- Information banners
- Helpful tips and guidance
- Secondary buttons
- Warm backgrounds

**Soft Purple** - Reserved for special features

```css
--brand-purple-100: #f3e8ff  /* Backgrounds */
--brand-purple-400: #c084fc  /* Accents */
--brand-purple-500: #a855f7  /* Primary purple */
```

**Usage:**
- Premium features
- Special states
- Alternative accents
- Diversity in complex UIs

### Neutral Colors

**Grays** - For text, borders, and backgrounds

```css
--brand-gray-50: #f9fafb    /* Lightest background */
--brand-gray-100: #f3f4f6   /* Light background */
--brand-gray-200: #e5e7eb   /* Borders */
--brand-gray-400: #9ca3af   /* Disabled text */
--brand-gray-500: #6b7280   /* Secondary text */
--brand-gray-600: #4b5563   /* Icons */
--brand-gray-700: #374151   /* Body text */
--brand-gray-900: #111827   /* Headings */
```

### Semantic Colors

**Success** - Green for positive actions
```css
--brand-success-500: #22c55e
```

**Error** - Red for errors and warnings
```css
--brand-error-500: #ef4444
```

## Typography

### Font Families

**Sans Serif (Primary)**
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

**Monospace (Code & Technical)**
```css
font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
```

### Type Scale

| Size | Rem | Pixels | Usage |
|------|-----|--------|-------|
| xs   | 0.75rem | 12px | Captions, helper text |
| sm   | 0.875rem | 14px | Secondary text, labels |
| base | 1rem | 16px | Body text (default) |
| lg   | 1.125rem | 18px | Emphasized text |
| xl   | 1.25rem | 20px | Section headings |
| 2xl  | 1.5rem | 24px | Page headings |

### Font Weights

- **Regular (400)**: Body text
- **Medium (500)**: Emphasized text, labels
- **Semibold (600)**: Subheadings
- **Bold (700)**: Headings

## Spacing System

Based on 0.25rem (4px) increments:

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| xs    | 0.25rem | 4px  | Tight spacing |
| sm    | 0.5rem  | 8px  | Component padding |
| md    | 1rem    | 16px | Default spacing |
| lg    | 1.5rem  | 24px | Section spacing |
| xl    | 2rem    | 32px | Large gaps |
| 2xl   | 3rem    | 48px | Major sections |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm    | 0.375rem (6px) | Small elements, tags |
| md    | 0.5rem (8px)   | Buttons, inputs (default) |
| lg    | 0.75rem (12px) | Cards, panels |
| xl    | 1rem (16px)    | Large cards, modals |
| full  | 9999px         | Pills, avatars |

## Shadows

```css
--brand-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--brand-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--brand-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--brand-shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

**Usage:**
- sm: Subtle elevation (cards)
- md: Buttons, dropdowns
- lg: Modals, popovers
- xl: Overlays, major elevations

## Component Patterns

### Buttons

**Primary Button**
- Background: `--brand-yellow-400`
- Text: `--brand-gray-900`
- Hover: Slightly darker yellow
- Active state: Ring with yellow-400

**Secondary Button**
- Background: White
- Border: `--brand-gray-200`
- Text: `--brand-gray-700`
- Hover: `--brand-gray-50` background

**Destructive Button**
- Background: `--brand-error-500`
- Text: White
- Use sparingly for delete/remove actions

### Info Banners

Use the warm amber palette for helpful information:
```css
background: var(--brand-amber-50);
border: 1px solid var(--brand-amber-200);
color: var(--brand-amber-900);
```

### Form Controls

- Border: `--brand-gray-300`
- Focus: 2px ring with `--brand-yellow-400`
- Disabled: `--brand-gray-200` background, reduced opacity
- Error: Red border with `--brand-error-500`

### Toggles & Switches

- Active: `--brand-yellow-400`
- Inactive: `--brand-gray-200`
- Use rounded, iOS-style switches

## Interaction Patterns

### Hover States
- Buttons: Subtle background shift
- Cards: Slight lift with shadow increase
- Links: Underline or color shift

### Active States
- Yellow ring (`ring-yellow-400`)
- 2px ring width
- 2px offset for breathing room

### Focus States
- Always show focus rings for accessibility
- Use `focus-visible:` for keyboard-only focus
- Yellow ring consistent with brand

### Transitions
```css
transition: all 0.2s ease;
```

## Accessibility

- Minimum contrast ratio: 4.5:1 for text
- Focus indicators always visible
- Support keyboard navigation
- Use semantic HTML
- Provide text alternatives

## Usage Examples

### Info Banner
```jsx
<div className="brand-info-banner p-3 rounded-lg">
  <p className="text-xs">Helpful information here</p>
</div>
```

### Primary Button
```jsx
<button className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg hover:bg-yellow-500 focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2">
  Click me
</button>
```

### Card/Panel
```jsx
<div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
  Content
</div>
```

## Don'ts

❌ Don't use bright, saturated colors for large areas  
❌ Don't mix blue with yellow (creates visual tension)  
❌ Don't use more than 3 colors in a single component  
❌ Don't use pure black (#000000)  
❌ Don't forget focus states  
❌ Don't make text smaller than 12px  
❌ Don't use thin fonts (< 400 weight) for body text  

## Do's

✅ Use yellow sparingly for maximum impact  
✅ Embrace white space  
✅ Use consistent spacing  
✅ Maintain visual hierarchy  
✅ Keep interactions smooth and responsive  
✅ Test in both light conditions  
✅ Ensure touch targets are at least 44x44px  

