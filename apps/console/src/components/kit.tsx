import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiMoreVertical, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiX } from 'react-icons/fi';

/**
 * Column counts are declared as literal class strings (never interpolated) so
 * Tailwind's scanner can see them. Below `sm` every band collapses to two
 * columns so the figures stay readable on a phone.
 */
const BAND_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  7: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7',
  8: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8',
};
const bandGrid = (cols: number) => BAND_GRID[cols] ?? 'grid-cols-2 sm:grid-cols-3';

/** Figures band — headline numbers. */
export function StatBand({ items, cols = 6 }: {
  items: Array<{ label: string; value: string; color?: string }>;
  cols?: number;
}) {
  return (
    <div className={`ms mb-3.5 ${bandGrid(cols)}`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <div className="k">{it.label}</div>
          <div className="v tabular-nums" style={it.color ? { color: it.color } : undefined}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chart panel — band header + fixed-height canvas container. */
export function ChartCard({ title, right, height = 250, children }: {
  title: string; right?: ReactNode; height?: number; children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
      <div className="band">
        <span className="t">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      <div style={{ height, padding: 14 }}>{children}</div>
    </div>
  );
}

export const CHART_COLORS = {
  action: '#1A4FBF', positive: '#2ECC71', risk: '#C62828',
  warn: '#F5A623', deep: '#E64A19', muted: '#94A3B8',
};

export function baseBarOpts(yMoney = true) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, align: 'end' as const,
        labels: { boxWidth: 9, boxHeight: 9, color: '#3A4050' } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#888' } },
      y: { grid: { color: '#ECECEC' }, border: { display: false },
        ticks: { color: '#888', callback: (v: string | number) =>
          yMoney ? `K${(Number(v) / 1000).toFixed(0)}k` : v } },
    },
  };
}

// ─── Skeleton + empty-state primitives ───────────────────────────────────────

/** Single shimmer block. */
export function Sk({ w = 'w-full', h = 'h-3', className = '' }: { w?: string; h?: string; className?: string }) {
  return <div className={`animate-pulse rounded-[2px] bg-[#E9ECF1] ${w} ${h} ${className}`} />;
}

/** Skeleton for the StatBand — N shimmer tiles. */
export function StatBandSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <div className={`ms mb-3.5 ${bandGrid(cols)}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i}>
          <Sk w="w-16" h="h-2" className="mb-2" />
          <Sk w="w-24" h="h-5" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a ChartCard — mimics the band + canvas area. */
export function ChartCardSkeleton({ height = 250, title = '' }: { height?: number; title?: string }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
      <div className="band">
        <Sk w="w-40" h="h-2.5" />
        {title && <span className="ml-auto"><Sk w="w-16" h="h-2.5" /></span>}
      </div>
      <div style={{ height, padding: 14 }} className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-[#C8CDD8]">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <rect x="2" y="18" width="6" height="18" rx="1" fill="currentColor" opacity=".25" />
            <rect x="11" y="10" width="6" height="26" rx="1" fill="currentColor" opacity=".35" />
            <rect x="20" y="14" width="6" height="22" rx="1" fill="currentColor" opacity=".25" />
            <rect x="29" y="6" width="6" height="30" rx="1" fill="currentColor" opacity=".35" />
          </svg>
          <div className="animate-pulse space-y-1.5">
            <Sk w="w-28" h="h-2" />
            <Sk w="w-20" h="h-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a DataGrid — N shimmer rows. */
export function DataGridSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr className="bg-[#FAFBFD]">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="border-b border-line px-3 py-2">
                <Sk w="w-16" h="h-2" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-line-2">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-3 py-3">
                  <Sk w={c === 0 ? 'w-32' : 'w-20'} h="h-2.5" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** No-data placeholder shown inside a ChartCard when data is empty. */
export function ChartEmpty({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-[#C8CDD8]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F2F5] text-[#B0B8C8]">
        {icon}
      </div>
      <span className="text-[11px] font-semibold text-[#B0B8C8]">{label}</span>
    </div>
  );
}

/** Skeleton for the PageActionBar / PageHead — title, sub and the action slot. */
export function PageHeadSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <div className="min-w-0">
        <Sk w="w-40" h="h-4" className="mb-2" />
        <Sk w="w-56" h="h-2" />
      </div>
      {action && <Sk w="w-28" h="h-[30px]" className="shrink-0" />}
    </div>
  );
}

/** Skeleton for any card that carries a `.band` header. */
export function BandCardSkeleton({
  title = 'w-32',
  right = false,
  children,
}: {
  title?: string;
  right?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
      <div className="band">
        <Sk w={title} h="h-2.5" />
        {right && <span className="ml-auto"><Sk w="w-16" h="h-2.5" /></span>}
      </div>
      {children}
    </div>
  );
}

/** Skeleton for a stacked list panel — optional leading avatar, two lines per row. */
export function ListSkeleton({
  rows = 3,
  avatar = false,
  trailing = false,
  pad = 'p-3.5',
}: {
  rows?: number;
  avatar?: boolean;
  trailing?: boolean;
  pad?: string;
}) {
  return (
    <div className={`space-y-2 ${pad}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 border-b border-line-2 pb-2 last:border-none">
          {avatar && <div className="h-[26px] w-[26px] shrink-0 animate-pulse rounded-full bg-[#E9ECF1]" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Sk w="w-32" h="h-2.5" />
            <Sk w="w-20" h="h-2" />
          </div>
          {trailing && <Sk w="w-16" h="h-2.5" className="shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a grid of small stat tiles. */
export function StatTilesSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid gap-3 ${bandGrid(cols)}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="border border-line bg-white p-3">
          <Sk w="w-16" h="h-2" className="mb-2" />
          <Sk w="w-20" h="h-4" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a FormGrid of labelled inputs. */
export function FormSkeleton({ fields = 6, cols = 3 }: { fields?: number; cols?: number }) {
  return (
    <div className={`grid gap-x-5 gap-y-3.5 ${bandGrid(cols)}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="min-w-0">
          <Sk w="w-24" h="h-2" className="mb-1.5" />
          <Sk w="w-full" h="h-[38px]" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a textarea document editor. */
export function TextAreaSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="space-y-2.5" style={{ height }}>
      {Array.from({ length: Math.max(4, Math.round(height / 34)) }).map((_, i) => (
        <Sk key={i} w={i % 3 === 2 ? 'w-3/5' : i % 2 === 1 ? 'w-4/5' : 'w-full'} h="h-2.5" />
      ))}
    </div>
  );
}

/** Full-page skeleton for table-driven list pages (clients, loans, requests, products…). */
export function TablePageSkeleton({
  cols = 4,
  rows = 6,
  tableCols = 5,
  tableTitle = 'w-32',
  head = true,
}: {
  cols?: number;
  rows?: number;
  tableCols?: number;
  tableTitle?: string;
  head?: boolean;
}) {
  return (
    <div>
      {head && <PageHeadSkeleton />}
      <StatBandSkeleton cols={cols} />
      <BandCardSkeleton title={tableTitle}>
        <DataGridSkeleton rows={rows} cols={tableCols} />
      </BandCardSkeleton>
    </div>
  );
}

/** Full-page skeleton for detail/form pages (client, loan, request, tenant…). */
export function DetailPageSkeleton({
  cols = 4,
  fields = 6,
  formCols = 3,
  back = true,
}: {
  cols?: number;
  fields?: number;
  formCols?: number;
  back?: boolean;
}) {
  return (
    <div>
      {back && <Sk w="w-28" h="h-2.5" className="mb-3" />}
      <PageHeadSkeleton />
      <StatBandSkeleton cols={cols} />
      <BandCardSkeleton title="w-40">
        <div className="p-3.5">
          <FormSkeleton fields={fields} cols={formCols} />
        </div>
      </BandCardSkeleton>
    </div>
  );
}

/** Dense, collapsible configuration band used by the console rebuild. */
export function FormSection({ title, children, defaultOpen = false, actions }: { title: string; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div className="border-t border-line first:border-t-0">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAFBFD] px-3 py-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-left text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-ink-2">
        {open ? <FiChevronDown size={12} /> : <FiPlus size={12} className="text-brand-500" />}{title}
      </button>
      {actions}
    </div>
    {open && <div className="p-3.5">{children}</div>}
  </div>;
}

/**
 * Field spans are applied from `sm` (two-column grid) or `lg` (three/four-column
 * grid) upwards only, so a `span={3}` never asks for more tracks than the
 * current breakpoint actually has.
 */
const FIELD_SPAN: Record<number, string> = {
  1: '',
  2: 'sm:col-span-2',
  3: 'lg:col-span-3',
};

export function Field({ label, required, children, span = 1 }: { label: string; required?: boolean; children: ReactNode; span?: 1 | 2 | 3 }) {
  return <div className={`min-w-0 ${FIELD_SPAN[span] ?? ''}`}><label className="mb-1 block text-[11px] font-semibold text-ink-2">{label} {required && <span className="text-danger-500">*</span>}</label>{children}</div>;
}

const FORM_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function FormGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={`grid gap-x-5 gap-y-3.5 ${FORM_GRID[cols] ?? FORM_GRID[3]}`}>{children}</div>;
}

export function Toolbar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-line bg-[#FAFBFD] px-3 py-2">{children}{right && <div className="ml-auto flex items-center gap-2">{right}</div>}</div>;
}

/** Small action chip — the system's primary inline action button. */
export function Pill({ children, onClick, disabled, tone = 'primary' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const cls =
    tone === 'ghost'
      ? 'border border-line bg-white text-ink-2 hover:bg-surface'
      : tone === 'danger'
        ? 'border border-red-600 bg-red-600 text-white hover:bg-red-700'
        : 'border border-brand-600 bg-brand-600 text-white hover:bg-brand-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wide disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

/** Page-level action bar — title + sub + right-side action pills. */
export function PageActionBar({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[17px] font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>}
      </div>
      {actions && <div className="-mx-1 flex flex-wrap items-center gap-2 px-1">{actions}</div>}
    </div>
  );
}

export function KitButton({ children, tone = 'create', onClick, disabled }: { children: ReactNode; tone?: 'create' | 'delete' | 'neutral'; onClick?: () => void; disabled?: boolean }) {
  const styles = tone === 'neutral' ? 'border border-line bg-white text-ink-2 hover:bg-surface' : 'bg-brand-500 text-white hover:bg-brand-600';
  return <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide disabled:opacity-40 ${styles}`}>{tone === 'delete' && <FiTrash2 size={11} />}{children}</button>;
}

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; width?: string; }
export function DataGrid<T extends { id: string }>({ columns, rows, onRowClick, empty, skeletonRows = 5 }: { columns: Array<Column<T>>; rows: T[] | null; onRowClick?: (row: T) => void; empty?: string; skeletonRows?: number }) {
  if (!rows) return <DataGridSkeleton rows={skeletonRows} cols={columns.length} />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead><tr className="bg-[#FAFBFD] text-left text-[9.5px] font-extrabold uppercase tracking-wider text-ink-muted">{columns.map((column) => <th key={column.key} className="border-b border-line px-3 py-2 whitespace-nowrap" style={column.width ? { width: column.width } : undefined}>{column.header}</th>)}</tr></thead><tbody>{rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-[12px] text-ink-muted">{empty ?? 'No records'}</td></tr>}{rows.map((row) => <tr key={row.id} onClick={() => onRowClick?.(row)} className={`border-b border-line-2 text-[12px] transition-colors ${onRowClick ? 'cursor-pointer hover:bg-[#F5F8FE]' : ''}`}>{columns.map((column) => <td key={column.key} className="px-3 py-2.5">{column.render(row)}</td>)}</tr>)}</tbody></table></div>;
}

// ─── AppTable — the universal page-level table ────────────────────────────────

export interface TableAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (row: T) => void;
  danger?: boolean;
}

export interface FilterOption { value: string; label: string; }

/**
 * Case-insensitive match of `q` against the given row keys.
 *
 * Handles the shapes that actually show up in these tables: strings, numbers,
 * booleans, `null` (never matches), arrays (e.g. a client's `lenders`), and
 * nested objects (serialised, so `status: 'active'` and friends are findable).
 */
export function rowMatches<T>(row: T, keys: readonly string[], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const rec = row as Record<string, unknown>;
  return keys.some((key) => {
    const v = rec[key];
    if (v == null) return false;
    if (Array.isArray(v)) return v.some((i) => String(i).toLowerCase().includes(needle));
    if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(needle);
    return String(v).toLowerCase().includes(needle);
  });
}

/** The console's single search control — AppTable's toolbar and hand-rolled
 *  list pages both use this so the field looks and behaves the same. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <FiSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[26px] w-full min-w-0 rounded-[3px] border border-line bg-white pl-7 pr-3 text-[11px] outline-none transition-all sm:w-[180px] sm:focus:w-[220px]"
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
          <FiX size={10} />
        </button>
      )}
    </div>
  );
}

export interface AppTableProps<T extends { id: string }> {
  columns: Array<Column<T>>;
  rows: T[] | null;
  /** Called when the search query or active filter changes. */
  onSearch?: (q: string) => void;
  /**
   * Row keys to match the search box against in the browser.
   *
   * Supply this for lists that are already fully loaded and have no server-side
   * `q` parameter — the table then filters the rows it holds. When the endpoint
   * supports `?q=`, use `onSearch` instead and the server does the matching.
   */
  searchKeys?: readonly string[];
  /** Filter chip options — first item should be { value: '', label: 'All' }. */
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (v: string) => void;
  /** Called when the refresh button is clicked. */
  onRefresh?: () => void;
  /** Per-row action menu items. */
  actions?: (row: T) => Array<TableAction<T>>;
  /** Clicking a row navigates / opens detail — shown as "View details" in menu. */
  onRowClick?: (row: T) => void;
  empty?: string;
  pageSize?: number;
  /** Extra toolbar content rendered on the right of the search bar. */
  toolbarRight?: ReactNode;
}

function RowMenu<T extends { id: string }>({
  row, actions, onRowClick,
}: { row: T; actions?: (row: T) => Array<TableAction<T>>; onRowClick?: (row: T) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    function close(e: MouseEvent) {
      const menu = document.getElementById('row-menu-portal');
      if (menu && menu.contains(e.target as Node)) return;
      setPos(null);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pos]);

  const items = actions?.(row) ?? [];
  const hasDetail = !!onRowClick;
  if (!hasDetail && items.length === 0) return null;

  function open(e: React.MouseEvent) {
    e.stopPropagation();
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = (hasDetail ? 1 : 0 + items.length) * 36 + 8;
    const top = r.bottom + menuH > window.innerHeight ? r.top - menuH : r.bottom + 4;
    setPos({ top, left: r.right });
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={open}
        className="flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-muted hover:bg-[#ECEEF2] hover:text-ink"
      >
        <FiMoreVertical size={13} />
      </button>
      {pos && createPortal(
        <div
          id="row-menu-portal"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
          className="min-w-[160px] overflow-hidden rounded-[4px] border border-line bg-white shadow-[0_4px_20px_rgba(0,0,0,0.14)]"
        >
          {hasDetail && (
            <button
              onClick={() => { setPos(null); onRowClick!(row); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-ink hover:bg-[#F5F8FE]"
            >
              View details
            </button>
          )}
          {hasDetail && items.length > 0 && <div className="border-t border-line" />}
          {items.map((a, i) => (
            <button key={i}
              onClick={() => { setPos(null); a.onClick(row); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[#F5F8FE] ${
                a.danger ? 'font-semibold text-red-600' : 'text-ink-2'
              }`}
            >
              {a.icon && <span className="shrink-0">{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function AppTable<T extends { id: string }>({
  columns, rows, onSearch, searchKeys, filters, activeFilter, onFilterChange,
  onRefresh, actions, onRowClick, empty, pageSize = 20, toolbarRight,
}: AppTableProps<T>) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // reset page when rows change
  useEffect(() => { setPage(1); }, [rows]);

  function handleSearch(v: string) {
    setQ(v);
    setPage(1);
    onSearch?.(v);
  }

  // Client-side search: only when the page supplied keys. Otherwise the query
  // belongs to the server (onSearch), and filtering here would filter an
  // already-sliced result set a second time.
  const searched = searchKeys?.length ? (rows ?? null)?.filter((row) => rowMatches(row, searchKeys, q)) ?? null : rows;

  // client-side pagination (server-side: pass already-sliced rows)
  const total = searched?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const slice = searched?.slice((page - 1) * pageSize, page * pageSize) ?? null;
  const hasChips = !!filters && filters.length > 1;
  const showSearch = !!onSearch || !!searchKeys?.length;

  const allCols = [
    ...columns,
    // actions column — always last
    ...(actions || onRowClick
      ? [{ key: '__actions', header: '', width: '36px',
          render: (row: T) => <RowMenu row={row} actions={actions} onRowClick={onRowClick} /> }]
      : []),
  ];

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
      {/* ── toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#FAFBFD] px-3 py-2">
        {/* filter chips */}
        {hasChips && (
          <div className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto px-1">
            {filters!.map((f) => (
              <button key={f.value}
                onClick={() => { onFilterChange?.(f.value); setPage(1); }}
                className={`shrink-0 whitespace-nowrap rounded-[3px] px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                  activeFilter === f.value
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-white text-ink-2 hover:text-ink'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        {/* search — full width on a phone unless the chips already took the row.
            Only rendered when the page actually wired a search, so the toolbar
            never shows a field that cannot do anything. */}
        {showSearch && (
          <SearchInput
            value={q}
            onChange={handleSearch}
            className={`sm:ml-auto sm:w-auto ${hasChips ? 'w-full' : 'w-full flex-1 sm:flex-none'}`}
          />
        )}
        {toolbarRight}
        {onRefresh && (
          <button onClick={onRefresh} aria-label="Refresh"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border border-line bg-white text-ink-muted hover:text-ink">
            <FiRefreshCw size={11} />
          </button>
        )}
      </div>

      {/* ── table ── */}
      {!slice ? (
        <DataGridSkeleton rows={Math.min(6, pageSize)} cols={allCols.length} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-[#FAFBFD] text-left text-[9.5px] font-extrabold uppercase tracking-wider text-ink-muted">
                {allCols.map((col) => (
                  <th key={col.key} className="border-b border-line px-3 py-2 whitespace-nowrap"
                    style={col.width ? { width: col.width } : undefined}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={allCols.length} className="px-3 py-10 text-center text-[12px] text-ink-muted">
                    {q.trim() ? 'No records match your search' : empty ?? 'No records'}
                  </td>
                </tr>
              ) : (
                slice.map((row) => (
                  <tr key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-line-2 text-[12px] transition-colors last:border-none ${
                      onRowClick ? 'cursor-pointer hover:bg-[#F5F8FE]' : ''
                    }`}>
                    {allCols.map((col) => (
                      <td key={col.key} className="px-3 py-2.5">{col.render(row)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── pagination ── */}
      {total > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10.5px] text-ink-muted">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line bg-white text-ink-muted disabled:opacity-40 hover:text-ink">
              <FiChevronLeft size={12} />
            </button>
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
              const n = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-[3px] px-1 text-[10.5px] font-bold ${
                    n === page ? 'bg-brand-600 text-white' : 'border border-line bg-white text-ink-2 hover:text-ink'
                  }`}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line bg-white text-ink-muted disabled:opacity-40 hover:text-ink">
              <FiChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drawer — smooth slide-over for lightweight info ─────────────────────────

export function Drawer({ open, onClose, title, sub, children, width = 420 }: {
  open: boolean; onClose: () => void;
  title: string; sub?: string;
  children: ReactNode; width?: number;
}) {
  // trap body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#0D1426]/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* panel */}
      <aside
        style={{ width, maxWidth: '100vw' }}
        className={`fixed right-0 top-0 z-50 flex h-full flex-col border-l border-line bg-white shadow-[-20px_0_48px_rgba(15,17,21,0.10)] transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* header */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-bold leading-tight text-ink">{title}</h3>
            {sub && <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-line text-ink-muted hover:bg-surface hover:text-ink"
          >
            <FiX size={13} />
          </button>
        </div>
        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </aside>
    </>
  );
}

export function PageTabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="flex w-max gap-5 border-b border-line">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[12.5px] font-semibold transition-colors ${active === tab.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ConfirmDialog — destructive action gate ───────────────────────────────

export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger = false, busy = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; body: string; confirmLabel?: string; danger?: boolean; busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0D1426]/40 p-4 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-[4px] border border-line bg-white shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="band">
          <span className="t">{title}</span>
          <button onClick={onClose} className="ml-auto text-ink-muted hover:text-ink"><FiX size={13} /></button>
        </div>
        <div className="px-4 py-4">
          <p className="text-[12.5px] leading-relaxed text-ink-2">{body}</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Pill tone="ghost" onClick={onClose}>Cancel</Pill>
            <Pill tone={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
              {busy ? 'Working…' : confirmLabel}
            </Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Auth primitives ───────────────────────────

/**
 * Full-page split auth layout.
 * Left = brand banner, Right = form panel.
 */
export function AuthLayout({
  banner,
  children,
  footer,
}: {
  banner: { heading: ReactNode; sub: string; footerLabel: string; footerBody: string };
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#171C28] lg:flex-row">
      {/* ── left brand panel ── */}
      <div
        className="relative hidden flex-[1.05] flex-col justify-between overflow-hidden p-[38px] lg:flex"
        style={{ background: 'linear-gradient(155deg,#1E45A8 0%,#0D2C6E 55%,#071838 100%)' }}
      >
        {/* glow orbs */}
        <div className="pointer-events-none absolute -right-[110px] -top-[130px] h-[420px] w-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(46,204,113,.18),transparent 62%)' }} />
        <div className="pointer-events-none absolute -bottom-[110px] -left-[80px] h-[340px] w-[340px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(46,99,230,.4),transparent 65%)' }} />
        {/* logo mark */}
        <div className="relative z-10 flex h-[46px] w-[46px] items-center justify-center rounded-[9px] font-display text-[21px] font-extrabold text-white shadow-[0_12px_30px_rgba(0,0,0,.35)]"
          style={{ background: 'linear-gradient(135deg,#2E63E6,#2ECC71)' }}>K</div>
        {/* headline */}
        <div className="relative z-10">
          <h3 className="font-display text-[22px] font-bold leading-[1.34] tracking-tight text-white">
            {banner.heading}
          </h3>
          <p className="mt-3 max-w-[290px] text-[12px] leading-[1.68] text-[#A9BEE8]">{banner.sub}</p>
        </div>
        {/* footer note */}
        <div className="relative z-10 border-t border-white/10 pt-3 text-[10.5px] leading-[1.65] text-[#8FA6D6]">
          <b className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#C7D6F2]">{banner.footerLabel}</b>
          {banner.footerBody}
        </div>
      </div>

      {/* ── right form panel ── */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {/* mini logo — fixed top */}
        <div className="flex shrink-0 items-center gap-2 px-5 pb-3 pt-[22px] sm:px-[34px]">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-gradient-to-br from-[#2E63E6] to-[#0D2C6E] text-[10px] font-extrabold text-white">K</div>
          <div>
            <b className="block text-[12px] leading-tight text-ink">Kumvwa</b>
            <span className="text-[6.5px] font-extrabold tracking-[0.2em] text-[#1A4FBF]">FINANCE</span>
          </div>
          <span className="ml-auto rounded-[3px] border border-[#D9DDE3] px-[7px] py-[2px] text-[9px] font-bold text-[#888]">PRODUCTION</span>
        </div>
        {/* scrollable form area */}
        <div className="flex-1 overflow-y-auto px-5 pb-[48px] sm:px-[34px]">{children}</div>
        {/* sticky footer */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between border-t border-[#ECECEC] bg-white px-5 py-2.5 text-[9px] text-[#B4BAC8] sm:px-[34px]">
          <b className="font-semibold text-[#3A4050]">Kumvwa Finance</b>
          <span>{footer ?? 'Console v1.0'}</span>
        </div>
      </div>
    </div>
  );
}

/** Horizontal gutter used by auth section headers — mirrors AuthLayout padding. */
export const AUTH_GUTTER = '-mx-5 px-5 sm:-mx-[34px] sm:px-[34px]';

/** 3-step stepper used across auth flows. */
export function AuthStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="mb-5 flex items-center gap-1.5 sm:gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && <div className={`h-0.5 min-w-[6px] flex-1 rounded-full ${done ? 'bg-[#2E7D32]' : 'bg-[#D9DDE3]'}`} />}
            <span className={`flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold ${
              done ? 'bg-[#2E7D32] text-white' : now ? 'bg-brand-600 text-white shadow-[0_0_0_3px_rgba(26,79,191,0.15)]' : 'bg-[#E4E7ED] text-[#888]'
            }`}>
              {done ? <FiCheck className="h-2.5 w-2.5" /> : i + 1}
            </span>
            <span className={`whitespace-nowrap text-[10px] font-bold ${now ? 'text-ink' : 'text-[#888]'}`}>{label}</span>
          </Fragment>
        );
      })}
    </div>
  );
}

/** 6-box OTP input — auto-advance, backspace, paste. */
export function OtpInput({ value, onChange, error = false }: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  return (
    <div className="my-3 flex gap-1.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          className={`h-[40px] w-0 min-w-0 flex-1 rounded-[3px] border bg-white text-center font-display text-[15px] font-bold text-ink outline-none transition-all ${
            error ? 'border-[#C62828]' : value[i] ? 'border-brand-500 bg-brand-50' : 'border-[#D9DDE3] focus:border-brand-500 focus:shadow-[0_0_0_2px_rgba(26,79,191,0.12)]'
          }`}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '');
            if (!d) return;
            onChange((value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6));
            if (i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus(); }}
          onPaste={(e) => {
            e.preventDefault();
            const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (t) { onChange(t); refs.current[Math.min(t.length, 5)]?.focus(); }
          }}
        />
      ))}
    </div>
  );
}
