import React from 'react';

export default function TabBar({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-tab-bar ${className}`}
      role="tablist"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        ...style,
      }}
      {...props}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              minHeight: 'var(--touch-target-min)',
              padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
              color: isActive ? '#FFFFFF' : 'var(--color-text-secondary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
