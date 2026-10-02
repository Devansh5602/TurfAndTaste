# Turf & Taste — Canonical UI Kit

## 1. Token Architecture

### Source of Truth
- `src/theme/tokens.css` — Canonical design tokens (single source of truth)
- `src/theme/light.css` — Clubhouse Ivory theme (light)
- `src/theme/dark.css` — Midnight Ivory theme (dark)

### Token Categories

#### Colors
| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-background` | `#FAF9F6` | `#101411` | Page canvas |
| `--color-surface` | `#FFFFFF` | `#1B211D` | Cards, sheets |
| `--color-surface-subtle` | `#F3F1ED` | `#232B25` | Recessed containers |
| `--color-surface-elevated` | `#FFFFFF` | `#2D3C2F` | Elevated surfaces |
| `--color-text-primary` | `#1A1C1A` | `#F1EFE7` | Headings, body |
| `--color-text-secondary` | `#5A645E` | `#B4B8AA` | Secondary text |
| `--color-text-muted` | `#8D9490` | `#718177` | Captions, metadata |
| `--color-primary` | `#0F3D2E` | `#9ECF8C` | Brand accent, CTAs |
| `--color-primary-hover` | `#1A5A44` | `#B4E6A2` | Hover state |
| `--color-accent` | `#A0F399` | `#A0F399` | Highlights |
| `--color-success` | `#15803D` | `#4ADE80` | Success states |
| `--color-warning` | `#B45309` | `#FBBF24` | Warning states |
| `--color-danger` | `#BA1A1A` | `#E58C7C` | Destructive, errors |
| `--color-info` | `#3B82F6` | `#60A5FA` | Informational |
| `--color-border` | `#EAE8E4` | `#3A4239` | Hairline borders |
| `--color-disabled` | `#C5C5C5` | `#4A5249` | Disabled controls |
| `--color-overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.7)` | Modal scrim |
| `--color-focus-ring` | `rgba(15,61,46,0.15)` | `rgba(158,207,140,0.2)` | Focus indicator |
| `--color-skeleton-base` | `#EAE8E4` | `#2D3C2F` | Skeleton base |
| `--color-skeleton-highlight` | `#F5F5F5` | `#3A4239` | Skeleton shimmer |

#### Spacing (4px base)
| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |

#### Radii
| Token | Value |
|---|---|
| `--radius-sm` | 8px |
| `--radius-md` | 12px |
| `--radius-lg` | 16px |
| `--radius-xl` | 20px |
| `--radius-full` | 9999px |

#### Shadows
| Token | Usage |
|---|---|
| `--shadow-sm` | Cards, subtle elevation |
| `--shadow-md` | Elevated cards |
| `--shadow-lg` | Modals, drawers |
| `--shadow-overlay` | Modal overlay |

#### Typography
| Token | Value | Usage |
|---|---|---|
| `--font-family` | Outfit, system fallback | All text |
| `--text-xs` | 0.75rem (12px) | Badges, captions |
| `--text-sm` | 0.85rem (13.6px) | Secondary text |
| `--text-base` | 0.95rem (15.2px) | Body text |
| `--text-md` | 1.05rem (16.8px) | Card titles |
| `--text-lg` | 1.25rem (20px) | Section headers |
| `--text-xl` | 1.5rem (24px) | Page titles |
| `--text-2xl` | 2rem (32px) | Display headings |

#### Interaction
| Token | Value |
|---|---|
| `--touch-target-min` | 44px |
| `--control-height` | 48px |
| `--control-height-sm` | 38px |
| `--control-height-lg` | 52px |
| `--transition-fast` | 0.1s ease-out |
| `--transition-normal` | 0.15s ease-out |
| `--transition-smooth` | 0.2s cubic-bezier(0.16, 1, 0.3, 1) |

#### Layout
| Token | Value |
|---|---|
| `--page-gutter` | 16px |
| `--content-max-width` | 480px |
| `--content-max-width-wide` | 600px |
| `--bottom-nav-height` | 64px |
| `--sticky-action-height` | 72px |

#### Safe Areas
| Token | Value |
|---|---|
| `--safe-top` | env(safe-area-inset-top, 0px) |
| `--safe-bottom` | env(safe-area-inset-bottom, 0px) |
| `--safe-left` | env(safe-area-inset-left, 0px) |
| `--safe-right` | env(safe-area-inset-right, 0px) |

---

## 2. Theme Architecture

### ThemeProvider
- Location: `src/theme/ThemeProvider.jsx`
- Wraps entire application in `App.jsx`
- Provides `useTheme()` hook
- Supports `light` (Clubhouse Ivory) and `dark` (Midnight Ivory)
- Persists to localStorage
- Falls back to Clubhouse Ivory on invalid stored value
- Applies `data-theme` attribute to document root

### Usage
```jsx
import { ThemeProvider, useTheme } from './theme';

// Wrap app
<ThemeProvider>
  <App />
</ThemeProvider>

// Use in components
const { theme, setTheme, toggleTheme } = useTheme();
```

---

## 3. Component Categories

### Primitives (`src/ui/primitives/`)
Basic building blocks with semantic variants.

| Component | Variants | Description |
|---|---|---|
| Button | primary, secondary, danger, ghost | Action button |
| IconButton | default, subtle, danger | Icon-only button |
| Card | default, elevated, subtle | Content container |
| Input | — | Text input with label/error |
| Textarea | — | Multi-line input |
| Select | — | Dropdown select |
| Checkbox | — | Checkbox with label |
| Radio | — | Radio with label |
| Chip | default, subtle | Filter/selection chip |
| Badge | default, success, warning, danger, info, primary | Status badge |
| StatusBadge | auto-mapped | Booking/session status |
| Avatar | sm, md, lg, xl | User avatar with initial |
| FormField | — | Form field wrapper |

### Components (`src/ui/components/`)
Structural patterns.

| Component | Description |
|---|---|
| PageHeader | Page title with back button and actions |
| SectionHeader | Section title with action link |
| Stepper | Booking progress indicator |
| Modal | Overlay dialog |
| StickyActionBar | Fixed bottom action bar |

### Navigation (`src/ui/navigation/`)
| Component | Description |
|---|---|
| BottomNav | Fixed bottom tab bar |
| TabBar | Horizontal tab selector |

### Feedback (`src/ui/feedback/`)
| Component | Description |
|---|---|
| ToastProvider | FIFO toast queue with useToast() hook |
| Alert | Inline error/warning/success/info |
| EmptyState | Empty state with icon, title, message, action |
| LoadingState | Spinner with message |
| ErrorState | Error display with retry |
| Skeleton | Shimmer loading placeholder |

### Patterns (`src/ui/patterns/`)
Domain-specific display components (presentation only).

| Component | Description |
|---|---|
| PriceDisplay | Currency amount with period |
| BookingCard | Booking summary card |
| FacilityCard | Facility/venue card |
| EventCard | Event listing card |
| DiningCard | Dining outlet card |

---

## 4. Supported Variants

### Button Variants
- `primary` — Filled brand color
- `secondary` — Outlined, subtle background
- `danger` — Filled danger color
- `ghost` — Transparent, brand text

### Button Sizes
- `sm` — 38px height
- `md` — 48px height (default)
- `lg` — 52px height

### Card Variants
- `default` — Surface with border
- `elevated` — Surface with shadow
- `subtle` — Subtle background, no border

### Badge Variants
- `default` — Neutral
- `success` — Green
- `warning` — Amber
- `danger` — Red
- `info` — Blue
- `primary` — Brand color

### StatusBadge Mappings
- `confirmed` → success
- `pending` → warning
- `cancelled` → danger
- `active` → success
- `inactive` → default
- `in-progress` → info
- `checked-in` → info
- `completed` → success
- `payment-review` → warning

---

## 5. Example Usage

### Button
```jsx
import { Button } from './ui/primitives';

<Button variant="primary" size="md">Save</Button>
<Button variant="danger" size="sm">Delete</Button>
<Button variant="secondary" onClick={handleCancel}>Cancel</Button>
```

### Card with Badge
```jsx
import { Card, Badge } from './ui/primitives';

<Card>
  <Badge label="Active" variant="success" />
  <h3>Turf 1</h3>
  <p>Box Cricket</p>
</Card>
```

### Form Field
```jsx
import { Input, Select } from './ui/primitives';

<Input label="Name" required error={errors.name} />
<Select label="Facility" options={facilities} />
```

### Modal
```jsx
import { Modal } from './ui/components';

<Modal isOpen={showModal} onClose={setShowModal} title="Confirm Booking">
  <p>Are you sure?</p>
  <Button variant="primary">Confirm</Button>
</Modal>
```

### Toast
```jsx
import { useToast } from './ui/feedback';

const { showToast } = useToast();
showToast('Booking confirmed!', 'success');
showToast('Error occurred', 'error');
```

### Domain Card
```jsx
import { BookingCard } from './ui/patterns';

<BookingCard
  bookingReference="BK001"
  facilityName="Turf 1"
  date="2026-10-01"
  time="10:00 AM"
  status="Confirmed"
  amount="500"
/>
```

---

## 6. Accessibility Requirements

- Minimum 44px touch targets for all interactive elements
- `aria-label` on icon-only buttons
- `role="dialog"` and `aria-modal="true"` on modals
- `role="status"` and `aria-live="polite"` on toasts
- `role="alert"` on error states
- `aria-invalid` on inputs with errors
- `aria-selected` on tab buttons
- Focus-visible outlines on all interactive elements
- Color contrast ratio minimum 4.5:1 for text

---

## 7. Touch-Target Rules

- All buttons, inputs, chips, and interactive elements: minimum 44px height
- Icon buttons: minimum 44px × 44px
- Bottom navigation items: minimum 44px height
- Form inputs: 48px height (comfortable)
- Chips: minimum 44px height

---

## 8. Responsive Rules

- Test at 360px, 375px, 390px, 412px, 430px
- Primary QA target: 390px
- Max shell width: 480px centered
- No horizontal overflow at any viewport
- Safe-area insets for all edge-to-edge layouts
- Sticky elements must not obscure content

---

## 9. Safe-Area Rules

- Use `env(safe-area-inset-top)` for top padding
- Use `env(safe-area-inset-bottom)` for bottom padding
- Use `env(safe-area-inset-left)` for left padding
- Use `env(safe-area-inset-right)` for right padding
- Apply to headers, bottom nav, sticky action bars, and modals

---

## 10. How to Add a New Component

1. Determine if it's a primitive, component, navigation, feedback, or pattern
2. Create file in appropriate directory under `src/ui/`
3. Use semantic tokens only (no hardcoded colors)
4. Support all required variants
5. Ensure 44px minimum touch targets
6. Add to `index.js` barrel export
7. Add tests in `tests/ui-kit.test.js`
8. Document in this file

---

## 11. How to Add a Variant

1. Add variant to the component's variant map
2. Use semantic tokens for all values
3. Ensure the variant is accessible
4. Add test coverage
5. Document in this file

---

## 12. Prohibited Practices

1. **Never hardcode brand colors** in page components
2. **Never invent new spacing/radius values** without adding to tokens
3. **Never use raw hex values** when a semantic token exists
4. **Never create screen-local theme state**
5. **Never use browser-native dialogs** (alert/confirm/prompt)
6. **Never render fake OS chrome** (status bar, battery, notch)
7. **Never use prototype-only wording** in production UI
8. **Never bypass component variants** with inline styles
9. **Never create parallel token systems**
10. **Never tie theme state to a single screen**
