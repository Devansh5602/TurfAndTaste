import React from 'react';

export default function CourtBackground() {
  return (
    <div className="court-bg-pattern" aria-hidden="true">
      <div 
        className="ambient-glow-olive animate-pulse-subtle" 
        style={{ top: '10%', left: '5%' }} 
      />
      <div 
        className="ambient-glow-orange animate-float" 
        style={{ bottom: '15%', right: '8%' }} 
      />
    </div>
  );
}
