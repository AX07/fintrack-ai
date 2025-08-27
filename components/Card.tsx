
import React, { forwardRef } from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className = '' }, ref) => {
  return (
    <div ref={ref} className={`bg-surface rounded-lg border border-secondary p-6 ${className}`}>
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;
