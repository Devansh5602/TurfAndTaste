import React from 'react';

export default function Stepper({
  steps,
  currentStep,
  className = '',
  style,
  ...props
}) {
  return (
    <div
      className={`ui-stepper ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
        gap: 'var(--space-1)',
        padding: 'var(--space-2) 0',
        ...style,
      }}
      {...props}
    >
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isActive = index === currentStep;
        return (
          <div
            key={step.id || index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-weight-bold)',
                background: isComplete || isActive ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                color: isComplete || isActive ? '#FFFFFF' : 'var(--color-text-muted)',
                border: `1px solid ${isComplete || isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {isComplete ? '✓' : index + 1}
            </div>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                textAlign: 'center',
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
