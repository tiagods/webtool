import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface RadioCardProps {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export default function RadioCard({ title, description, selected, onClick, className }: RadioCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl p-5 cursor-pointer transition-all w-full flex flex-col justify-start items-start text-left",
        selected
          ? "border-2 border-accent bg-accent/5"
          : "border border-border bg-warm hover:border-accent/40",
        className
      )}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <span className={cn("font-display font-semibold text-sm", selected ? "text-accent" : "text-text")}>
          {title}
        </span>
        <div className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
          selected ? "border-accent bg-accent" : "border-muted bg-white"
        )}>
          {selected && <Check className="w-3 h-3 text-white stroke-[3]" />}
        </div>
      </div>
      {description && (
        <p className="text-muted text-xs leading-relaxed max-w-[90%]">
          {description}
        </p>
      )}
    </div>
  );
}
