import React from 'react';
import { type LucideIcon } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon?: LucideIcon;
    color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'indigo' | 'stone';
    badgeText?: string;
    badgeVariant?: 'success' | 'warning' | 'danger' | 'neutral';
    tooltip?: string;
}

const COLOR_STYLES = {
    emerald: {
        bg: 'bg-emerald-50 text-emerald-700',
        border: 'border-emerald-200',
        iconBg: 'bg-emerald-100 text-emerald-700',
    },
    blue: {
        bg: 'bg-blue-50 text-blue-700',
        border: 'border-blue-200',
        iconBg: 'bg-blue-100 text-blue-700',
    },
    purple: {
        bg: 'bg-purple-50 text-purple-700',
        border: 'border-purple-200',
        iconBg: 'bg-purple-100 text-purple-700',
    },
    amber: {
        bg: 'bg-amber-50 text-amber-700',
        border: 'border-amber-200',
        iconBg: 'bg-amber-100 text-amber-700',
    },
    rose: {
        bg: 'bg-rose-50 text-rose-700',
        border: 'border-rose-200',
        iconBg: 'bg-rose-100 text-rose-700',
    },
    indigo: {
        bg: 'bg-indigo-50 text-indigo-700',
        border: 'border-indigo-200',
        iconBg: 'bg-indigo-100 text-indigo-700',
    },
    stone: {
        bg: 'bg-stone-50 text-stone-700',
        border: 'border-stone-200',
        iconBg: 'bg-stone-100 text-stone-700',
    },
};

const BADGE_STYLES = {
    success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-rose-100 text-rose-800 border-rose-200',
    neutral: 'bg-stone-100 text-stone-800 border-stone-200',
};

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color = 'stone',
    badgeText,
    badgeVariant = 'neutral',
    tooltip,
}) => {
    const style = COLOR_STYLES[color] || COLOR_STYLES.stone;

    return (
        <div
            title={tooltip}
            className="bg-white rounded-xl border border-[#E1E3DB] p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-sm"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 font-sans">
                        {title}
                    </span>
                    <div className="text-2xl font-bold text-stone-900 mt-1 font-display tracking-tight">
                        {value}
                    </div>
                </div>
                {Icon && (
                    <div className={`p-2.5 rounded-lg ${style.iconBg} shrink-0`}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>

            {(subtitle || badgeText) && (
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <span>{subtitle}</span>
                    {badgeText && (
                        <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[11px] border ${
                                BADGE_STYLES[badgeVariant]
                            }`}
                        >
                            {badgeText}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};
