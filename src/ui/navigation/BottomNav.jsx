import React from 'react';

export default function BottomNav({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  style,
  ...props
}) {
  return (
    <nav
      className={`ui-bottom-nav ${className}`}
      aria-label="Primary navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--bottom-nav-height)',
        paddingBottom: 'var(--safe-bottom)',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        alignItems: 'center',
        zIndex: 'var(--z-nav)',
        ...style,
      }}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-selected={isActive}
            role="tab"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              minHeight: 'var(--touch-target-min)',
              border: 'none',
              background: 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              transition: 'color var(--transition-fast)',
            }}
          >
            {Icon && <Icon size={20} />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
