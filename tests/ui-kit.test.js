import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider.jsx';
import { Button } from '../src/ui/primitives/Button.jsx';
import { IconButton } from '../src/ui/primitives/IconButton.jsx';
import { Card } from '../src/ui/primitives/Card.jsx';
import { Input } from '../src/ui/primitives/Input.jsx';
import { Badge } from '../src/ui/primitives/Badge.jsx';
import { StatusBadge } from '../src/ui/primitives/StatusBadge.jsx';
import { Chip } from '../src/ui/primitives/Chip.jsx';
import { Avatar } from '../src/ui/primitives/Avatar.jsx';
import { PageHeader } from '../src/ui/components/PageHeader.jsx';
import { SectionHeader } from '../src/ui/components/SectionHeader.jsx';
import { Modal } from '../src/ui/components/Modal.jsx';
import { EmptyState } from '../src/ui/feedback/EmptyState.jsx';
import { LoadingState } from '../src/ui/feedback/LoadingState.jsx';
import { ErrorState } from '../src/ui/feedback/ErrorState.jsx';
import { Skeleton } from '../src/ui/feedback/Skeleton.jsx';
import { PriceDisplay } from '../src/ui/patterns/PriceDisplay.jsx';
import { BookingCard } from '../src/ui/patterns/BookingCard.jsx';
import { FacilityCard } from '../src/ui/patterns/FacilityCard.jsx';

// ── ThemeProvider Tests ──

test('ThemeProvider defaults to light theme', () => {
  function TestComponent() {
    const { theme } = useTheme();
    return <div data-testid="theme">{theme}</div>;
  }
  const html = renderToString(
    <ThemeProvider>
      <TestComponent />
    </ThemeProvider>
  );
  assert.ok(html.includes('light'));
});

test('ThemeProvider provides setTheme function', () => {
  function TestComponent() {
    const { setTheme } = useTheme();
    return <button onClick={() => setTheme('dark')}>Switch</button>;
  }
  const html = renderToString(
    <ThemeProvider>
      <TestComponent />
    </ThemeProvider>
  );
  assert.ok(html.includes('Switch'));
});

test('ThemeProvider provides toggleTheme function', () => {
  function TestComponent() {
    const { toggleTheme } = useTheme();
    return <button onClick={toggleTheme}>Toggle</button>;
  }
  const html = renderToString(
    <ThemeProvider>
      <TestComponent />
    </ThemeProvider>
  );
  assert.ok(html.includes('Toggle'));
});

// ── Button Tests ──

test('Button renders with primary variant by default', () => {
  const html = renderToString(<Button>Click</Button>);
  assert.ok(html.includes('Click'));
  assert.ok(html.includes('button'));
});

test('Button renders with secondary variant', () => {
  const html = renderToString(<Button variant="secondary">Click</Button>);
  assert.ok(html.includes('Click'));
});

test('Button renders with danger variant', () => {
  const html = renderToString(<Button variant="danger">Delete</Button>);
  assert.ok(html.includes('Delete'));
});

test('Button is disabled when disabled prop is true', () => {
  const html = renderToString(<Button disabled>Click</Button>);
  assert.ok(html.includes('disabled'));
});

// ── IconButton Tests ──

test('IconButton renders with label', () => {
  const html = renderToString(<IconButton label="Close">×</IconButton>);
  assert.ok(html.includes('Close'));
  assert.ok(html.includes('aria-label'));
});

// ── Card Tests ──

test('Card renders children', () => {
  const html = renderToString(<Card>Card content</Card>);
  assert.ok(html.includes('Card content'));
});

test('Card supports elevated variant', () => {
  const html = renderToString(<Card variant="elevated">Elevated</Card>);
  assert.ok(html.includes('Elevated'));
});

// ── Input Tests ──

test('Input renders with label', () => {
  const html = renderToString(<Input label="Name" />);
  assert.ok(html.includes('Name'));
  assert.ok(html.includes('label'));
});

test('Input shows error message', () => {
  const html = renderToString(<Input label="Name" error="Required" />);
  assert.ok(html.includes('Required'));
});

// ── Badge Tests ──

test('Badge renders label', () => {
  const html = renderToString(<Badge label="New" />);
  assert.ok(html.includes('New'));
});

test('Badge supports success variant', () => {
  const html = renderToString(<Badge label="Active" variant="success" />);
  assert.ok(html.includes('Active'));
});

// ── StatusBadge Tests ──

test('StatusBadge renders status text', () => {
  const html = renderToString(<StatusBadge status="Confirmed" />);
  assert.ok(html.includes('Confirmed'));
});

test('StatusBadge handles cancelled status', () => {
  const html = renderToString(<StatusBadge status="Cancelled" />);
  assert.ok(html.includes('Cancelled'));
});

// ── Chip Tests ──

test('Chip renders label', () => {
  const html = renderToString(<Chip label="Filter" />);
  assert.ok(html.includes('Filter'));
});

test('Chip supports selected state', () => {
  const html = renderToString(<Chip label="Filter" selected />);
  assert.ok(html.includes('Filter'));
});

// ── Avatar Tests ──

test('Avatar renders initial from name', () => {
  const html = renderToString(<Avatar name="John" />);
  assert.ok(html.includes('J'));
});

// ── PageHeader Tests ──

test('PageHeader renders title', () => {
  const html = renderToString(<PageHeader title="Dashboard" />);
  assert.ok(html.includes('Dashboard'));
});

test('PageHeader renders subtitle', () => {
  const html = renderToString(<PageHeader title="Dashboard" subtitle="Overview" />);
  assert.ok(html.includes('Overview'));
});

// ── SectionHeader Tests ──

test('SectionHeader renders title', () => {
  const html = renderToString(<SectionHeader title="Section" />);
  assert.ok(html.includes('Section'));
});

// ── Modal Tests ──

test('Modal renders when open', () => {
  const html = renderToString(
    <Modal isOpen title="Test Modal">
      <p>Modal content</p>
    </Modal>
  );
  assert.ok(html.includes('Test Modal'));
  assert.ok(html.includes('Modal content'));
});

test('Modal does not render when closed', () => {
  const html = renderToString(
    <Modal isOpen={false} title="Test Modal">
      <p>Modal content</p>
    </Modal>
  );
  assert.ok(!html.includes('Test Modal'));
});

// ── Feedback Component Tests ──

test('EmptyState renders title and message', () => {
  const html = renderToString(
    <EmptyState title="No data" message="Nothing to show" />
  );
  assert.ok(html.includes('No data'));
  assert.ok(html.includes('Nothing to show'));
});

test('LoadingState renders loading message', () => {
  const html = renderToString(<LoadingState message="Loading..." />);
  assert.ok(html.includes('Loading...'));
});

test('ErrorState renders error message', () => {
  const html = renderToString(
    <ErrorState title="Error" message="Something went wrong" />
  );
  assert.ok(html.includes('Error'));
  assert.ok(html.includes('Something went wrong'));
});

test('Skeleton renders without content', () => {
  const html = renderToString(<Skeleton />);
  assert.ok(html.includes('ui-skeleton'));
});

// ── Domain Display Component Tests ──

test('PriceDisplay renders amount with currency', () => {
  const html = renderToString(<PriceDisplay amount="500" />);
  assert.ok(html.includes('₹500'));
});

test('PriceDisplay renders with period', () => {
  const html = renderToString(<PriceDisplay amount="500" period="/hr" />);
  assert.ok(html.includes('/hr'));
});

test('BookingCard renders booking details', () => {
  const html = renderToString(
    <BookingCard
      bookingReference="BK001"
      facilityName="Turf 1"
      date="2026-10-01"
      time="10:00 AM"
      status="Confirmed"
      amount="500"
    />
  );
  assert.ok(html.includes('BK001'));
  assert.ok(html.includes('Turf 1'));
  assert.ok(html.includes('Confirmed'));
});

test('FacilityCard renders facility details', () => {
  const html = renderToString(
    <FacilityCard
      name="Turf 1"
      type="Box Cricket"
      rating="4.8"
      reviewCount="100"
    />
  );
  assert.ok(html.includes('Turf 1'));
  assert.ok(html.includes('Box Cricket'));
});

// ── Architecture Guard Tests ──

test('ThemeProvider wraps children', () => {
  function TestComponent() {
    const { theme } = useTheme();
    return <div>{theme}</div>;
  }
  const html = renderToString(
    <ThemeProvider>
      <TestComponent />
    </ThemeProvider>
  );
  assert.ok(html.includes('light') || html.includes('dark'));
});

test('Button uses semantic tokens not hardcoded colors', () => {
  const html = renderToString(<Button>Test</Button>);
  assert.ok(html.includes('var(--color-primary)'));
});

test('Card uses semantic tokens', () => {
  const html = renderToString(<Card>Test</Card>);
  assert.ok(html.includes('var(--color-surface)'));
});

test('Input uses semantic tokens', () => {
  const html = renderToString(<Input label="Test" />);
  assert.ok(html.includes('var(--color-border)'));
});
