# UnCorded — UI Standards

Consistent design language across web and desktop. Professional, clean, dark-first.
Reference: C:\t3Code\apps\web for proven component patterns and styling approach.

---

## Design Philosophy

- **Dark-first** — dark mode is the default. Light mode is secondary.
- **Consistent** — every component follows the same spacing, radius, and color rules.
- **Accessible** — focus rings, keyboard navigation, ARIA attributes, minimum touch targets.
- **Responsive** — mobile-first breakpoints. Desktop is the enhanced experience.
- **No visual clutter** — minimal shadows, subtle borders, clean typography.

---

## Color System

All colors defined as CSS custom properties in `index.css`. Components reference tokens, never raw color values.

### Semantic Tokens

| Token | Purpose | Example |
|-------|---------|---------|
| `--background` | Page/app background | Dark: neutral-950 |
| `--foreground` | Primary text | Dark: neutral-100 |
| `--card` | Card/panel backgrounds | Slightly lighter than bg |
| `--primary` | Brand actions, active states | Purple/blue accent |
| `--secondary` | Subtle backgrounds, hover states | White 4% alpha |
| `--muted` | Disabled text, placeholders | Subdued foreground |
| `--muted-foreground` | Secondary text | |
| `--destructive` | Delete, error, danger | Red |
| `--border` | Dividers, input borders | White 6% alpha (dark) |
| `--ring` | Focus ring color | Matches primary |
| `--info` | Informational badges/alerts | Blue |
| `--success` | Success states | Emerald/green |
| `--warning` | Warnings, caution | Amber |

### Rules
- Never use raw Tailwind colors (`text-red-500`) in components — always use tokens (`text-destructive`).
- Both dark and light themes define the same token names with adjusted values.
- Dark mode selector: `@custom-variant dark (&:is(.dark, .dark *))` — apply `.dark` class to root element.

---

## Typography

### Font Stack
```css
--font-sans: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--font-mono: "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
```

### Scale
| Usage | Class | Size |
|-------|-------|------|
| Body text | `text-base` | 16px (14px on mobile) |
| Small text | `text-sm` | 14px |
| Tiny text | `text-xs` | 12px |
| Heading | `text-xl` / `text-2xl` | 20px / 24px |
| Display | `text-3xl` | 30px |

### Weights
- `font-normal` (400) — body text
- `font-medium` (500) — buttons, labels, controls
- `font-semibold` (600) — headings, titles
- `font-bold` (700) — rarely, emphasis only

### Rules
- Use `text-base sm:text-sm` pattern for responsive sizing (larger on mobile for touch).
- Secondary text uses `text-muted-foreground`, never raw gray classes.
- Monospace font for code, timestamps, technical values only.

---

## Spacing & Layout

### Spacing Scale
Use Tailwind's default spacing scale. Common patterns:

| Context | Spacing |
|---------|---------|
| Component padding | `p-4` (16px) or `p-6` (24px) |
| Gap between items | `gap-2` (8px) or `gap-3` (12px) |
| Section spacing | `gap-6` (24px) or `gap-8` (32px) |
| Inline icon gap | `gap-2` (8px) |
| Input padding | `px-3 py-2` |

### Layout Patterns
- Flexbox for linear layouts: `flex items-center gap-2`
- Grid for form layouts: `grid grid-cols-[1fr_auto]`
- Stack pattern: `flex flex-col gap-N`

### App Shell
```
┌──────┬──────────┬──────────────────────┐
│ 72px │  240px   │       flex-1         │
│Server│ Channel  │     Main Area        │
│ List │  List    │                      │
│      │          │                      │
│      │──────────│                      │
│      │User Panel│                      │
└──────┴──────────┴──────────────────────┘
```

---

## Border Radius

Consistent radius scale — never use arbitrary values.

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 6px | Small chips, badges |
| `rounded-md` | 8px | Inputs, small cards |
| `rounded-lg` | 10px | Cards, modals, panels |
| `rounded-xl` | 14px | Large cards, dialogs |
| `rounded-full` | 9999px | Avatars, pills, status dots |

Base radius: `0.625rem` (10px). All other sizes derived from this.

---

## Shadows

Minimal shadows. Dark mode relies on borders and subtle background differences, not shadows.

| Class | Usage |
|-------|-------|
| `shadow-xs` | Subtle elevation (dropdowns) |
| `shadow-md` | Modals, popovers |
| None | Most cards and panels (use border instead) |

### Rules
- Prefer `border border-border` over shadows for separation in dark mode.
- Shadows at low opacity: `shadow-md/5` (5% opacity).
- Use `backdrop-blur-sm` for overlay glassmorphism effects.

---

## Component Standards

### Buttons

**Variants:**
| Variant | Usage |
|---------|-------|
| `default` | Primary actions (Create, Send, Save) |
| `secondary` | Secondary actions (Cancel, Back) |
| `ghost` | Tertiary actions, icon buttons in toolbars |
| `outline` | Alternative secondary style |
| `destructive` | Dangerous actions (Delete, Leave, Ban) |
| `link` | Inline text actions |

**Sizes:**
| Size | Height | Usage |
|------|--------|-------|
| `sm` | 32px | Compact UI, inline actions |
| `default` | 36px | Standard buttons |
| `lg` | 40px | Primary CTAs, form submits |
| `icon` | 36x36px | Icon-only buttons |
| `icon-sm` | 32x32px | Compact icon buttons |

**Rules:**
- Minimum touch target: 44x44px on touch devices (`pointer-coarse:after:min-h-11 min-w-11`)
- Disabled state: `opacity-64`, `pointer-events-none`
- Focus: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`
- Loading state: swap icon for spinner, disable button
- Icon + text buttons: icon before text, `gap-2`

### Inputs

**States:**
- Default: `border-border bg-background`
- Focus: `ring-2 ring-ring` (3px ring width)
- Error: `border-destructive` + `aria-invalid="true"`
- Disabled: `opacity-64`, `pointer-events-none`

**Rules:**
- Always pair with a `<label>` (visually hidden if needed via `sr-only`)
- Placeholder text uses `text-muted-foreground`
- Auto-resize textareas for chat input
- Autofill styling overridden to match theme

### Cards

**Structure:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

- Standard padding: `p-6`
- Background: `bg-card`
- Border: `border border-border rounded-lg`

### Modals / Dialogs

- Backdrop: `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm`
- Content: centered, `rounded-xl`, max-width constraint
- Close: Escape key + backdrop click + explicit close button
- Mobile: full-width bottom sheet (`max-sm:` variant)
- Animation: scale + opacity transition, 200ms duration
- Nested dialogs supported (z-index stacking)

### Badges

Semantic color mapping:
| Variant | Color | Usage |
|---------|-------|-------|
| `default` | Primary | General labels |
| `success` | Green | Online, active, connected |
| `warning` | Amber | Idle, pending |
| `destructive` | Red | Error, DND, offline |
| `info` | Blue | Informational |
| `outline` | Border | Neutral tags |

### Tooltips
- Delay: 200ms before show
- Position: top by default
- Style: `bg-foreground text-background rounded-md text-xs px-2 py-1`
- Use for icon-only buttons and truncated text

---

## Icons

### Library: Lucide (SolidJS)
- Package: `lucide-solid`
- Consistent sizing: `size-4.5` (18px) default, `size-4` (16px) in compact contexts
- Color: `currentColor` (inherits from parent text color)
- Custom icons in `components/Icons.tsx` for brand logos

### Rules
- Never use raw SVGs inline — always wrap in a component or use Lucide
- Icon-only buttons must have `aria-label` or a tooltip
- Size classes on icons: `[&_svg]:size-4.5` pattern on parent

---

## Animation & Transitions

### Standard Transitions
- `transition-colors duration-150` — hover color changes
- `transition-shadow duration-200` — focus ring appearance
- `transition-all duration-200` — modal/dialog open/close
- `transition-transform duration-200` — scale effects

### Entry/Exit Animations
- Modals: `scale-98 opacity-0` → `scale-100 opacity-100`
- Popovers: `opacity-0` → `opacity-100` with transform-origin
- Toasts: slide in from edge

### Rules
- Keep transitions under 200ms for interactive elements
- Use `prefers-reduced-motion` media query to disable non-essential animation
- No animation on initial page load — only on user-triggered interactions
- Suppress transitions during theme switch (`.no-transitions` class)

---

## Scrollbar Styling

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);  /* dark mode */
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

---

## Responsive Breakpoints

Mobile-first approach. Single primary breakpoint:

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Default | 0px+ | Mobile layout |
| `sm:` | 640px+ | Desktop enhancements |
| `md:` | 768px+ | Tablet adjustments (rare) |
| `lg:` | 1024px+ | Wide desktop (rare) |

### Rules
- Most responsive work happens at `sm:` breakpoint
- Mobile: single-column, bottom sheets for modals, larger touch targets
- Desktop: multi-column app shell, hover states, smaller text
- Test on 360px width minimum (smallest common phone)

---

## Accessibility

### Focus Management
- All interactive elements must be keyboard accessible
- `focus-visible:ring-2 focus-visible:ring-ring` on all focusable elements
- Ring offset uses background color for visual separation
- Tab order follows visual order — no `tabindex` hacks

### ARIA
- `aria-label` on icon-only buttons
- `aria-invalid="true"` on invalid form fields
- `role="status"` on live regions (typing indicators, connection status)
- `aria-live="polite"` for toast notifications

### Color Contrast
- Text on background: minimum 4.5:1 ratio (WCAG AA)
- Large text / UI components: minimum 3:1 ratio
- Never rely on color alone to convey information — use icons or text labels

### Touch Targets
- Minimum 44x44px on touch devices
- Use `pointer-coarse` media query for touch-specific sizing

---

## Utility Function

```typescript
// lib/utils.ts
import { cx, type CxOptions } from "cva";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: CxOptions) {
  return twMerge(cx(inputs));
}
```

All component class merging goes through `cn()`. This prevents Tailwind class conflicts.

---

## Component File Structure

```
apps/web/src/
├── components/
│   ├── ui/               # Reusable primitives (button, input, card, badge, etc.)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── modals/           # Modal dialogs (CreateServerModal, InviteModal, etc.)
│   ├── Icons.tsx          # Custom brand icons
│   ├── ChatArea.tsx       # Feature components
│   ├── MessageBubble.tsx
│   └── ...
├── stores/               # SolidJS reactive stores
├── lib/                  # Utilities, API client, gateway
├── pages/                # Route pages
└── index.css             # Theme tokens, global styles
```

### Rules
- UI primitives in `components/ui/` — generic, reusable, no business logic
- Feature components in `components/` — app-specific, compose UI primitives
- One component per file (small helper components in same file are fine)
- File names: kebab-case. Export names: PascalCase.

---

## Data Attributes

Use `data-slot` for component identification in CSS:
```tsx
<button data-slot="button" data-variant="destructive" data-size="sm">
```

This enables parent-aware styling without complex class selectors:
```css
[data-slot="card"] [data-slot="button"] { /* nested styling */ }
```

---

## Virtual Scrolling

Large lists (messages, members, server lists) must use virtual scrolling to maintain performance.

### Library: `@tanstack/solid-virtual`
- Only renders visible items + overscan buffer
- Handles variable-height items (messages with different content lengths)
- Integrates with scroll-to-bottom behavior for chat

### Where Required
| List | Trigger | Implementation |
|------|---------|----------------|
| Message list | Always (any channel could have thousands) | Virtual + reverse scroll + auto-scroll on new message |
| Member list | > 50 members | Virtual with fixed item height |
| Server list | > 20 servers | Virtual with fixed item height |
| Search results | Always | Virtual with variable height |

### Rules
- Never render unbounded lists with `<For>` directly — always virtualize
- Overscan: 5 items above and below viewport
- Measure item heights dynamically for variable-height content
- Preserve scroll position across channel switches (store scroll offset per channel)

---

## Performance Patterns

### Debouncing
- Search/filter inputs: 300ms debounce
- Typing indicator: 5s throttle per channel (already implemented)
- Window resize handlers: 100ms debounce

### Lazy Loading
- Route pages: lazy-loaded via `lazy()` (already implemented)
- Heavy components (settings panels, modals): lazy-loaded on first open
- Images: `loading="lazy"` attribute

### Caching
- Static assets: `Cache-Control: max-age=31536000, immutable`
- Messages cached in store across channel switches (already implemented)
- API responses: cache in SolidJS resources where appropriate

---

_This file is the source of truth for all UI decisions. Every component must follow these standards. Update when the design system evolves._
