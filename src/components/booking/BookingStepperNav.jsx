import React from 'react';
import { Check } from 'lucide-react';

/**
 * BookingStepperNav - Multi-step booking progress bar
 * Encapsulates the visual stepper pills while preserving parent step routing
 */
export default function BookingStepperNav({ currentStep, onStepClick }) {
  const steps = [
    { num: 1, label: 'Arena' },
    { num: 2, label: 'Slot' },
    { num: 3, label: 'Details' },
    { num: 4, label: 'Summary' },
  ];

  return (
    <nav className="booking-stepper" aria-label="Booking steps progress">
      {steps.map((step, idx) => {
        const isCurrent = currentStep === step.num;
        const isCompleted = currentStep > step.num;
        const isFuture = currentStep < step.num;

        return (
          <React.Fragment key={step.num}>
            <button
              type="button"
              className={`stepper-pill ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isFuture ? 'future' : ''}`.trim()}
              onClick={() => onStepClick(step.num)}
              aria-label={`Step ${step.num}: ${step.label}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="stepper-pill-icon">
                {isCompleted ? <Check size={12} strokeWidth={3} /> : step.num}
              </span>
              <span className="stepper-pill-label">{step.label}</span>
            </button>
            {idx < steps.length - 1 && (
              <div className={`stepper-divider ${currentStep > step.num ? 'filled' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
