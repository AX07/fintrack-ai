
import React from 'react';
import Card from './Card';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => {
  return (
    <Card className="text-center py-12 flex flex-col items-center">
        <div className="bg-primary text-accent rounded-full p-3 mb-4 w-16 h-16 flex items-center justify-center">
            {icon}
        </div>
        <h3 className="text-xl font-semibold text-text-primary mb-1">{title}</h3>
        <p className="text-text-secondary max-w-md mx-auto">{message}</p>
        {action && <div className="mt-6">{action}</div>}
    </Card>
  );
};

export default EmptyState;
