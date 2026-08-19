import React from 'react';
import { cn } from '@/lib/utils';

export interface RadioChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export default function RadioChip({ label, selected, onClick, className }: RadioChipProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-lg flex items-center justify-center text-sm transition-colors cursor-pointer shrink-0",
        selected
          ? "border-2 border-accent text-accent font-semibold"
          : "border border-border bg-warm text-muted hover:border-accent/40 font-medium",
        className
      )}
    >
      {label}
    </div>
  );
}
