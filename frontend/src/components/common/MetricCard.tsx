import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon: LucideIcon;
  colorVariant?: 'teal' | 'blue' | 'purple' | 'amber' | 'rose';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  colorVariant = 'teal'
}) => {
  const colorMap = {
    teal: 'from-teal-500/20 to-teal-500/5 border-teal-500/30 text-teal-400',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400',
    rose: 'from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400',
  };

  return (
    <div className={`p-4 rounded-2xl glass-panel bg-gradient-to-br border ${colorMap[colorVariant]} transition-all hover:scale-[1.01]`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl bg-slate-900/60 border border-slate-700/60 ${colorMap[colorVariant]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="font-heading text-2xl font-bold text-slate-100 tracking-tight">{value}</span>
        {trend && (
          <span className={`flex items-center text-xs font-semibold ${trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend.isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>}
    </div>
  );
};
