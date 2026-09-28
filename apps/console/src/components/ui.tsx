import type { ReactNode } from 'react';
import { FiAlertTriangle, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';

const badgeStyles: Record<string, string> = {
  green: 'bg-accent-50 text-accent-700',
  amber: 'bg-warn-50 text-warn-500',
  red: 'bg-danger-50 text-danger-500',
  blue: 'bg-brand-50 text-brand-600',
  grey: 'bg-gray-100 text-ink-muted',
};

const dotStyles: Record<string, string> = {
  green: 'bg-accent-500',
  amber: 'bg-amber-500',
  red: 'bg-danger-500',
  blue: 'bg-brand-500',
  grey: 'bg-gray-400',
};

export type BadgeColor = keyof typeof badgeStyles;

export function Badge({
  color,
  children,
  dot = false,
}: {
  color: BadgeColor;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${badgeStyles[color]}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[color]}`} />
      )}
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-line bg-white shadow-c1 ${className}`}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  right,
}: {
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-2 px-4 py-3">
      <b className="text-[13px] text-ink">{title}</b>
      {right}
    </div>
  );
}

export function Avatar({
  name,
  tone = 'brand',
  size = 34,
}: {
  name: string;
  tone?: 'brand' | 'green' | 'amber' | 'red';
  size?: number;
}) {
  const bg = {
    brand: 'from-brand-500 to-brand-900',
    green: 'from-accent-500 to-accent-700',
    amber: 'from-amber-500 to-amber-700',
    red: 'from-danger-500 to-red-800',
  }[tone];
  const p = name.trim().split(/\s+/);
  const init = ((p[0]?.[0] ?? '') + (p.at(-1)?.[0] ?? '')).toUpperCase();
  return (
    <div
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${bg} font-bold text-white`}
    >
      <span style={{ fontSize: size * 0.32 }}>{init}</span>
    </div>
  );
}

export function ProgressBar({
  pct,
  danger = false,
}: {
  pct: number;
  danger?: boolean;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full ${
          danger
            ? 'bg-gradient-to-r from-danger-500 to-amber-500'
            : 'bg-gradient-to-r from-accent-500 to-brand-500'
        }`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function Sparkline({ points, stroke }: { points: number[]; stroke: string }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points);
  const range = max - min || 1;
  const coords = points
    .map(
      (v, i) =>
        `${(i / (points.length - 1)) * 70},${24 - ((v - min) / range) * 20}`,
    )
    .join(' ');
  return (
    <svg width="70" height="26" className="absolute bottom-3 right-3.5">
      <polyline
        points={coords}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  tone = 'ink',
  trend,
  spark,
}: {
  label: string;
  value: string;
  tone?: 'ink' | 'green' | 'red';
  trend?: { up: boolean; label: string };
  spark?: number[];
}) {
  const c =
    tone === 'green'
      ? 'text-accent-700'
      : tone === 'red'
        ? 'text-danger-500'
        : 'text-ink';
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-white p-4 shadow-c1">
      <div className="text-[10.5px] font-semibold text-ink-muted">{label}</div>
      <div
        className={`mt-1 font-display text-[21px] font-bold tracking-tight tabular-nums ${c}`}
      >
        {value}
      </div>
      {trend && (
        <span
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold ${
            trend.up
              ? 'bg-accent-50 text-accent-700'
              : 'bg-danger-50 text-danger-500'
          }`}
        >
          {trend.up ? <FiTrendingUp size={10} /> : <FiTrendingDown size={10} />}
          {trend.label}
        </span>
      )}
      {spark && spark.length > 1 && (
        <Sparkline
          points={spark}
          stroke={tone === 'red' ? '#C03538' : tone === 'green' ? '#2ECC71' : '#2E63E6'}
        />
      )}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent ${className}`}
    />
  );
}

export function CenteredSpinner({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <div className="flex justify-center py-16 sm:py-24">
      <Spinner className={className} />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[3px] border border-red-200 bg-danger-50 px-3.5 py-2.5 text-[12px] text-danger-500">
      <FiAlertTriangle size={13} className="shrink-0" /> {message}
    </div>
  );
}

export function Empty({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="px-4 py-12 text-center sm:py-16">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl text-ink-muted">
        {icon}
      </div>
      <div className="mt-3 text-[13.5px] font-semibold">{title}</div>
      {hint && <div className="mt-1 text-[12px] text-ink-muted">{hint}</div>}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[18px] font-bold tracking-tight text-ink">
          {title}
        </h1>
        {sub && <p className="mt-0.5 text-[11.5px] text-ink-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const inputCls =
  'w-full rounded-[3px] border-[1.5px] border-line bg-white px-3.5 py-2 text-[13px] text-ink outline-none placeholder:text-gray-400 focus:border-brand-500 focus:shadow-[0_0_0_2px_rgba(26,79,191,0.10)] transition-shadow';

export const labelCls = 'mb-1 block text-[11px] font-semibold text-ink-2';

/** Status → badge mapping used across tables. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeColor> = {
    active: 'green',
    cleared: 'blue',
    overdue: 'red',
    defaulted: 'grey',
    approved: 'green',
    pending: 'amber',
    pending_verification: 'amber',
    rejected: 'red',
    completed: 'green',
    expired: 'grey',
    suspended: 'red',
  };
  return (
    <Badge color={map[status] ?? 'grey'} dot>
      {status.replaceAll('_', ' ')}
    </Badge>
  );
}
