import React from "react";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-owl-bg-secondary/50 flex items-center justify-center mb-4 text-owl-text-secondary">
        <div className="w-8 h-8">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-medium text-owl-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-owl-text-secondary max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2.5 bg-owl-accent-primary text-white text-sm font-medium rounded-lg hover:bg-owl-accent-primary/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
