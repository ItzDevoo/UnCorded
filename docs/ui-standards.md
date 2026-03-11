# UnCorded — UI Standards

Consistent design language across web and desktop. Professional, clean, dark-first.
Reference: C:\t3Code\apps\web for proven component patterns and styling approach.

---

## Design Philosophy

- **Dark-first** — dark mode is the default. Light mode is secondary.
- **Consistent** — every component follows the same spacing, radius, and color rules.
- **Accessible** — focus rings, keyboard navigation, ARIA attributes, minimum touch targets.
- **Responsive** — mobile-first breakpoints. Desktop is the enhanced experience.
- **Refined depth** — alpha borders, brand-tinted shadows, inset highlights, noise texture.

---

## Color System

Railway-inspired green-tinted dark palette. All surfaces carry the brand hue (~150° green) at low saturation for visual cohesion. Colors defined as CSS custom properties in `index.css` using OKLCH. Components reference tokens, never raw color values.

### Design Principles

- Backgrounds at hue ~150° with low chroma (subtle, not sickly)
- Borders and overlays use white-alpha (`oklch(1 0 0 / N%)`) so they adapt to any surface
- Text has very slight green warmth (not pure neutral)
- Brand green appears at full saturation for actions, low saturation for tints
- Shadows are brand-tinted (hue 155) at low chroma for subtle depth

### Semantic Tokens

| Token                      | Purpose                | OKLCH Value              |
| -------------------------- | ---------------------- | ------------------------ |
| `--background`             | Page/app background    | `oklch(0.178 0.02 155)`  |
| `--foreground`             | Primary text           | `oklch(0.955 0.008 155)` |
| `--card`                   | Card/panel backgrounds | `oklch(0.21 0.018 155)`  |
| `--card-foreground`        | Card text              | `oklch(0.955 0.008 155)` |
| `--popover`                | Popover/dropdown bg    | `oklch(0.21 0.018 155)`  |
| `--popover-foreground`     | Popover text           | `oklch(0.955 0.008 155)` |
| `--primary`                | Brand green            | `oklch(0.66 0.17 155)`   |
| `--primary-foreground`     | Text on primary        | `oklch(1 0 0)` (white)   |
| `--secondary`              | Subtle bg elements     | `oklch(1 0 0 / 4%)`     |
| `--secondary-foreground`   | Text on secondary      | `oklch(0.91 0.008 155)`  |
| `--muted`                  | Muted backgrounds      | `oklch(1 0 0 / 5%)`     |
| `--muted-foreground`       | Subdued text           | `oklch(0.62 0.008 155)`  |
| `--accent`                 | Hover backgrounds      | `oklch(1 0 0 / 4%)`     |
| `--accent-foreground`      | Text on accent         | `oklch(0.955 0.008 155)` |
| `--destructive`            | Danger/delete          | `oklch(0.55 0.2 25)`     |
| `--destructive-foreground` | Text for destructive   | `oklch(0.78 0.12 25)`    |
| `--border`                 | Borders, dividers      | `oklch(1 0 0 / 6%)`     |
| `--input`                  | Input field bg         | `oklch(1 0 0 / 8%)`     |
| `--ring`                   | Focus ring (= primary) | `oklch(0.66 0.17 155)`   |
| `--success`                | Success states         | `oklch(0.66 0.17 155)`   |
| `--success-foreground`     | Success text           | `oklch(0.78 0.12 155)`   |
| `--warning`                | Warning states         | `oklch(0.75 0.16 75)`    |
| `--warning-foreground`     | Warning text           | `oklch(0.85 0.1 75)`     |
| `--info`                   | Info states            | `oklch(0.65 0.16 255)`   |
| `--info-foreground`        | Info text              | `oklch(0.78 0.1 255)`    |
| `--sidebar`                | Server bar (darker)    | `oklch(0.16 0.022 155)`  |
| `--sidebar-foreground`     | Sidebar text           | `oklch(0.955 0.008 155)` |

### Rules

- Never use raw Tailwind colors (`text-red-500`) in components — always use tokens (`text-destructive`).
- Dark mode is the only mode. All values defined in `:root` directly.
- `@custom-variant dark (&:is(.dark, .dark *))` pattern available for future light mode.

---

## Typography

### Font Stack

```css
--font-sans: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--font-mono: "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
```

### Scale

| Usage      | Class                  | Size                  |
| ---------- | ---------------------- | --------------------- |
| Body text  | `text-base`            | 16px (14px on mobile) |
| Small text | `text-sm`              | 14px                  |
| Tiny text  | `text-xs`              | 12px                  |
| Heading    | `text-xl` / `text-2xl` | 20px / 24px           |
| Display    | `text-3xl`             | 30px                  |

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

| Context           | Spacing                          |
| ----------------- | -------------------------------- |
| Component padding | `p-4` (16px) or `p-6` (24px)     |
| Gap between items | `gap-2` (8px) or `gap-3` (12px)  |
| Section spacing   | `gap-6` (24px) or `gap-8` (32px) |
| Inline icon gap   | `gap-2` (8px)                    |
| Input padding     | `px-3 py-2`                      |

### Layout Patterns

- Flexbox for linear layouts: `flex items-center gap-2`
- Grid for form layouts: `grid grid-cols-[1fr_auto]`
- Stack pattern: `flex flex-col gap-N`

### App Shell

```
┌────────────┬───────────────────────────┐
│   288px    │         flex-1            │
│  Sidebar   │       Main Area          │
│ ┌────────┐ │                           │
│ │Switcher│ │                           │
│ ├────────┤ │                           │
│ │Channels│ │                           │
│ │ or DMs │ │                           │
│ ├────────┤ │                           │
│ │  User  │ │                           │
│ └────────┘ │                           │
└────────────┴───────────────────────────┘
```

Single sidebar with dropdown server switcher, unified channel/DM list, and user panel.

---

## Border Radius

Consistent radius scale — never use arbitrary values.

| Token          | Value  | Usage                       |
| -------------- | ------ | --------------------------- |
| `rounded-sm`   | 6px    | Small chips, badges         |
| `rounded-md`   | 8px    | Inputs, small cards         |
| `rounded-lg`   | 10px   | Cards, modals, panels       |
| `rounded-xl`   | 14px   | Large cards, dialogs        |
| `rounded-full` | 9999px | Avatars, pills, status dots |

Base radius: `0.625rem` (10px). All other sizes derived from this.

---

## Shadows

Brand-tinted shadow scale (hue 155) for refined depth. Defined as CSS custom properties overriding Tailwind defaults.

| Class       | Value                                                | Usage                          |
| ----------- | ---------------------------------------------------- | ------------------------------ |
| `shadow-xs` | `0 1px 2px oklch(0.15 0.01 155 / 20%)`              | Buttons, inputs                |
| `shadow-sm` | Two-layer, 3px + 2px blur                            | Cards, elevated panels         |
| `shadow-md` | Two-layer, 6px + 4px blur                            | Modals, popovers               |
| `shadow-lg` | Two-layer, 15px + 6px blur                           | Large floating elements        |

### Rules

- Use `shadow-xs` on interactive elements (buttons, inputs) for subtle lift.
- Use `shadow-sm` on cards and panels for separation.
- Use `shadow-md` on modals and popovers.
- Combine with `border border-border` — shadows complement, not replace borders.
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

- Inset shadow highlight on default/destructive: `inset-shadow-[0_1px_--theme(--color-white/16%)]`
- Active press: `active:scale-[0.98]`, shadow removed, inset darkens
- Minimum touch target: 44x44px on touch devices (`pointer-coarse:after:absolute after:min-h-11 after:min-w-11`)
- Disabled state: `opacity-50`, `pointer-events-none`
- Focus: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`
- Loading state: swap icon for spinner, disable button
- Icon + text buttons: icon before text, `gap-2`
- SVGs: `[&_svg]:pointer-events-none [&_svg]:shrink-0`

### Inputs

**States:**

- Default: `border-border bg-input shadow-xs`
- Focus: `ring-2 ring-ring/50` with `transition-shadow duration-200`
- Error: `border-destructive/50` + `aria-invalid="true"`
- Disabled: `opacity-50`, `pointer-events-none`

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
- Border: `border border-border rounded-2xl shadow-sm`

### Modals / Dialogs

- Backdrop: `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm`
- Content: centered, `rounded-xl`, max-width constraint
- Close: Escape key + backdrop click + explicit close button
- Mobile: full-width bottom sheet (`max-sm:` variant)
- Animation: `animate-scale-in` (scale 0.98→1 + opacity, 200ms ease-out)
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

### Approach: Inline SVGs

- No icon component library installed — all icons are inline `<svg>` elements (Heroicons-style)
- Consistent sizing via Tailwind classes: `class="h-4 w-4"` (16px) or `class="h-5 w-5"` (20px)
- Color: `currentColor` via `stroke="currentColor"` — inherits from parent text color
- `stroke-width="2"` for consistent weight across all icons

### Rules

- Icon-only buttons must have both `aria-label` (screen reader) and `title` (hover tooltip)
- SVGs on buttons: `[&_svg]:pointer-events-none [&_svg]:shrink-0` pattern on parent
- Keep SVGs inline for tree-shaking — no barrel icon files

---

## Animation & Transitions

### Standard Transitions

- `transition-all duration-200` — buttons (covers color, shadow, scale)
- `transition-shadow duration-200` — inputs (focus ring appearance)
- `transition-transform duration-200` — scale effects

### Animation Keyframes

Defined as CSS custom properties in `@theme inline`:

| Class              | Keyframe     | Duration | Easing   | Usage              |
| ------------------ | ------------ | -------- | -------- | ------------------ |
| `animate-scale-in` | `scale-in`   | 200ms    | ease-out | Dialogs, popovers  |
| `animate-slide-in` | `slide-in`   | 300ms    | ease-out | Toasts             |
| `animate-fade-in`  | `fade-in`    | 200ms    | ease-out | General fade entry |
| `animate-skeleton` | `skeleton`   | 2s loop  | linear   | Skeleton loader    |

- `scale-in`: scale 0.98→1 + opacity 0→1
- `slide-in`: translateY 16px→0 + opacity 0→1
- `fade-in`: opacity 0→1
- `skeleton`: background-position sweep -200%→0

### Rules

- Keep transitions under 200ms for interactive elements
- Use `prefers-reduced-motion` media query to disable non-essential animation
- No animation on initial page load — only on user-triggered interactions
- Suppress transitions during theme switch (`.no-transitions` class)

---

## Noise Texture

A subtle SVG noise overlay on `body::after` adds texture to all surfaces:

- `position: fixed; inset: 0; pointer-events: none` — covers viewport, non-interactive
- `opacity: 0.035` — barely perceptible, adds depth without distraction
- `z-index: 9999` — above all content
- Uses inline SVG `feTurbulence` filter for fractal noise at 256×256px tile size
- `body` has `relative` for stacking context

---

## Sidebar

Composable sidebar primitives for the app shell. File: `components/ui/sidebar.tsx`

### Subcomponents

| Component | Element | Purpose |
|-----------|---------|---------|
| `Sidebar` | `<aside>` | Root container — `w-72`, `bg-sidebar`, `border-r` |
| `SidebarHeader` | `<div>` | Top section — houses ServerSwitcher |
| `SidebarContent` | `ScrollArea` | Scrollable middle — channels or DMs |
| `SidebarFooter` | `<div>` | Bottom section — user panel, `border-t` |
| `SidebarGroup` | `<div>` | Labeled section with optional collapse (`collapsible`, `defaultOpen`) |
| `SidebarMenu` | `<ul>` | Menu list container |
| `SidebarMenuItem` | `<li>` | Menu item with `group/menu-item` for hover actions |
| `SidebarMenuButton` | `<button>` | Interactive item — `active` prop toggles `bg-accent` |
| `SidebarMenuAction` | `<button>` | Hover-revealed action button (right-aligned) |

### SidebarGroup Collapsible

```tsx
<SidebarGroup label="Channels" collapsible defaultOpen>
  <SidebarMenu>{/* items */}</SidebarMenu>
</SidebarGroup>
```

When `collapsible` is set, the label header shows a chevron and toggles children visibility on click.

### ServerSwitcher

Dropdown in `SidebarHeader` for switching between Home and servers. Uses `Portal` + fixed backdrop for click-outside dismiss (same pattern as Dialog). File: `components/ServerSwitcher.tsx`

### AppSidebar

Composes all sidebar primitives with app data. Owns modal signals for Create/Join/Invite. File: `components/AppSidebar.tsx`

- **Server view:** Channels group + Invite People button
- **Home view:** Friends button + Direct Messages group
- **Footer:** User avatar, username, online status, logout

---

## ScrollArea

Styled scrollable container with thin scrollbar. Use instead of raw `overflow-auto` for consistent scrollbar styling.

```tsx
<ScrollArea class="h-64">
  {/* scrollable content */}
</ScrollArea>
```

- `scrollbar-width: thin` + custom webkit scrollbar (`w-1.5`, 6px)
- Thumb: `foreground/12`, hover: `foreground/20`
- File: `components/ui/scroll-area.tsx`

---

## Skeleton

Loading placeholder with animated shimmer effect.

```tsx
<Skeleton class="h-4 w-48" />
<Skeleton class="size-10 rounded-full" />
```

- Uses `animate-skeleton` keyframe (2s linear loop)
- Gradient sweep over `--color-muted` background
- File: `components/ui/skeleton.tsx`

---

## Empty

Empty state component for lists and panels with no content.

```tsx
<Empty
  icon={<InboxIcon />}
  title="No messages yet"
  description="Start a conversation!"
>
  <Button>Send Message</Button>
</Empty>
```

- Centers content vertically and horizontally
- Optional icon (rendered at 48px), title (required), description, and action slot
- File: `components/ui/empty.tsx`

---

## Scrollbar Styling

```css
* {
  scrollbar-width: thin;
  scrollbar-color: oklch(1 0 0 / 12%) transparent;
}
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: oklch(1 0 0 / 12%);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: oklch(1 0 0 / 20%);
}
```

---

## Responsive Breakpoints

Mobile-first approach. Single primary breakpoint:

| Breakpoint | Width   | Usage                     |
| ---------- | ------- | ------------------------- |
| Default    | 0px+    | Mobile layout             |
| `sm:`      | 640px+  | Desktop enhancements      |
| `md:`      | 768px+  | Tablet adjustments (rare) |
| `lg:`      | 1024px+ | Wide desktop (rare)       |

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
// lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
[data-slot="card"] [data-slot="button"] {
  /* nested styling */
}
```

---

## Virtual Scrolling

Large lists (messages, members, server lists) must use virtual scrolling to maintain performance.

### Library: `@tanstack/solid-virtual`

- Only renders visible items + overscan buffer
- Handles variable-height items (messages with different content lengths)
- Integrates with scroll-to-bottom behavior for chat

### Where Required

| List           | Trigger                                   | Implementation                                        |
| -------------- | ----------------------------------------- | ----------------------------------------------------- |
| Message list   | Always (any channel could have thousands) | Virtual + reverse scroll + auto-scroll on new message |
| Member list    | > 50 members                              | Virtual with fixed item height                        |
| Server list    | > 20 servers                              | Virtual with fixed item height                        |
| Search results | Always                                    | Virtual with variable height                          |

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
