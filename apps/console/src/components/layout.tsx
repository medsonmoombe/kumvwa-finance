import { useEffect, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FiBarChart2,
  FiBell,
  FiFileText,
  FiGrid,
  FiInbox,
  FiLogOut,
  FiSearch,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  roles: readonly string[];
  badge?: boolean;
}

const NAV: { cap: string; items: NavItem[] }[] = [
  {
    cap: 'Lending',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: FiGrid,
        roles: ['tenant_owner', 'tenant_staff'],
      },
      {
        to: '/clients',
        label: 'Clients',
        icon: FiUsers,
        roles: ['tenant_owner', 'tenant_staff'],
      },
      {
        to: '/requests',
        label: 'Requests',
        icon: FiInbox,
        roles: ['tenant_owner', 'tenant_staff'],
        badge: true,
      },
      {
        to: '/loans',
        label: 'Loans',
        icon: FiFileText,
        roles: ['tenant_owner', 'tenant_staff'],
      },
    ],
  },
  {
    cap: 'Insights',
    items: [
      {
        to: '/reports',
        label: 'Reports',
        icon: FiBarChart2,
        roles: ['tenant_owner', 'tenant_staff'],
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: FiSettings,
        roles: ['tenant_owner', 'tenant_staff'],
      },
      {
        to: '/admin',
        label: 'Verification',
        icon: FiGrid,
        roles: ['platform_admin'],
      },
    ],
  },
];

export function Shell() {
  const { user, tenant, logout } = useAuth();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (user?.role === 'tenant_owner' || user?.role === 'tenant_staff') {
      api
        .get('/notifications', { params: { limit: 1 } })
        .then((r) => setUnread(r.data.unread ?? 0))
        .catch(() => {});
      api
        .get('/loan-requests/inbox', { params: { status: 'pending' } })
        .then((r) => setPending(r.data.items.length))
        .catch(() => {});
    }
  }, [loc.pathname, user?.role]);

  const crumb = loc.pathname.split('/')[1] || 'dashboard';

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex h-full w-[212px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white">
        <Link to="/" className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-900 font-display text-[15px] font-extrabold text-white shadow-c2">
            K
          </div>
          <div>
            <b className="block font-display text-[13.5px] leading-tight tracking-tight text-ink">
              Kumvwa
            </b>
            <span className="text-[8px] font-bold tracking-[0.24em] text-brand-600">
              FINANCE
            </span>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3">
          {NAV.map((g) => {
            const items = g.items.filter(
              (i) => user && i.roles.includes(user.role),
            );
            if (items.length === 0) return null;
            return (
              <div key={g.cap} className="mb-2">
                <div className="px-2.5 pb-1 pt-2.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-gray-400">
                  {g.cap}
                </div>
                {items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `relative mb-px flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] font-semibold ${
                        isActive
                          ? 'bg-brand-50 font-bold text-brand-600'
                          : 'text-ink-2 hover:bg-line-2'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-600" />
                        )}
                        <Icon size={15} className="opacity-80" />
                        {label}
                        {badge && pending > 0 && (
                          <span className="ml-auto rounded-full bg-danger-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                            {pending}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          {tenant && (
            <div className="mb-2 flex items-center gap-2.5 rounded-[10px] border border-line bg-surface p-2">
              <Avatar name={tenant.name} size={30} />
              <div className="min-w-0">
                <b className="block truncate text-[10.5px] text-ink">
                  {tenant.name}
                </b>
                <span className="flex items-center gap-1 text-[9.5px] font-bold text-accent-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                  {tenant.status === 'active'
                    ? 'Verified'
                    : tenant.status.replaceAll('_', ' ')}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={async () => {
              await logout();
              window.location.href = '/login';
            }}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] font-semibold text-ink-2 hover:bg-line-2"
          >
            <FiLogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3.5 border-b border-line bg-white px-6 py-3">
          <div className="text-[12px] capitalize text-ink-muted">
            <b className="font-semibold capitalize text-ink">{crumb}</b> ·{' '}
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </div>
          <button
            type="button"
            title="Global search — coming with mobile integration"
            className="mx-auto flex w-full max-w-[420px] items-center gap-2.5 rounded-[10px] border-[1.5px] border-line bg-surface px-3 py-2 text-left text-[12.5px] text-ink-muted"
          >
            <FiSearch size={14} />
            <span className="flex-1">Search clients, loans, NRC…</span>
            <kbd className="rounded border border-line border-b-2 bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-bold">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            title="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-white text-ink-2"
          >
            <FiBell size={15} />
            {unread > 0 && (
              <em className="absolute -right-1 -top-1 rounded-full border-2 border-white bg-danger-500 px-1 py-px text-[8.5px] font-extrabold not-italic text-white">
                {unread}
              </em>
            )}
          </button>
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.displayName ?? '?'} tone="green" />
            <div>
              <b className="block text-[12px] leading-tight text-ink">
                {user?.displayName}
              </b>
              <span className="text-[10px] capitalize text-ink-muted">
                {user?.role.replaceAll('_', ' ')}
              </span>
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
