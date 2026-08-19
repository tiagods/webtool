import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelecaoFichaCardProps {
  icon: React.ReactNode;
  iconBgClassName: string;
  accentClassName: string;
  label: string;
  title: string;
  description: string;
  footerText: string;
  ctaLabel: string;
  href: string;
  disabled?: boolean;
  badge?: string;
}

export default function SelecaoFichaCard({
  icon,
  iconBgClassName,
  accentClassName,
  label,
  title,
  description,
  footerText,
  ctaLabel,
  href,
  disabled,
  badge,
}: SelecaoFichaCardProps) {
  return (
    <div className="flex-1 flex flex-col rounded-2xl pt-8 pb-7 px-6 md:pt-10 md:pb-9 md:px-9 bg-white border-[1.5px] border-border">
      <div className={cn('flex items-center justify-center mb-7 shrink-0 rounded-xl size-12', iconBgClassName)}>
        <div className={accentClassName}>{icon}</div>
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <span className={cn('tracking-[0.08em] uppercase font-display font-semibold text-[11px] leading-[14px]', accentClassName)}>
          {label}
        </span>
        {badge && (
          <span className="text-[11px] font-medium text-sky bg-sky/10 rounded px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>

      <h3 className="mb-3 font-display font-bold text-brand text-[22px] leading-7 tracking-[-0.4px]">
        {title}
      </h3>

      <p className="grow mb-8 text-muted text-sm leading-[22px]">
        {description}
      </p>

      <div className="flex items-center justify-between pt-7 border-t border-border">
        <span className="text-[13px] text-muted/80">{footerText}</span>

        {disabled ? (
          <span
            aria-disabled="true"
            className="h-11 flex items-center rounded-lg px-6 gap-2 bg-white border-[1.5px] border-border text-muted text-sm font-semibold cursor-not-allowed"
          >
            {ctaLabel}
            <ArrowRight className="size-4" strokeWidth={1.6} />
          </span>
        ) : (
          <Link
            href={href}
            className="h-11 flex items-center rounded-lg px-6 gap-2 bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            {ctaLabel}
            <ArrowRight className="size-4" strokeWidth={1.6} />
          </Link>
        )}
      </div>
    </div>
  );
}
