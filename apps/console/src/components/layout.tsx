import { useEffect, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FiBarChart2,
  FiBell,
  FiFileText,
  FiGrid,
  FiInbox,
  FiLogOut,
  FiPackage,
  FiSearch,
  FiSettings,
  FiShield,
  FiUserPlus,
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
      { to: '/dashboard', label: 'Dashboard',  icon: FiGrid,     roles: ['tenant_owner', 'tenant_staff'] },
      { to: '/clients',   label: 'Clients',    icon: FiUsers,    roles: ['tenant_owner', 'tenant_staff'] },
      { to: '/requests',  label: 'Requests',   icon: FiInbox,    roles: ['tenant_owner', 'tenant_staff'], badge: true },
      { to: '/loans',     label: 'Loans',      icon: FiFileText, roles: ['tenant_owner', 'tenant_staff'] },
      { to: '/products',  label: 'Products',   icon: FiPackage,  roles: ['tenant_owner', 'tenant_staff'] },
    ],
  },
  {
    cap: 'Insights',
    items: [
      { to: '/reports',  label: 'Reports',  icon: FiBarChart2, roles: ['tenant_owner', 'tenant_staff'] },
      { to: '/staff',    label: 'Staff',    icon: FiUserPlus,  roles: ['tenant_owner'] },
      { to: '/settings', label: 'Settings', icon: FiSettings,  roles: ['tenant_owner', 'tenant_staff'] },
    ],
  },
  {
    cap: 'Platform',
    items: [
      { to: '/admin',           label: 'Overview',     icon: FiGrid,   roles: ['platform_admin'] },
      { to: '/admin/queue',     label: 'Verification', icon: FiShield, roles: ['platform_admin'] },
      { to: '/admin/borrowers', label: 'Borrowers',    icon: FiUsers,  roles: ['platform_admin'] },
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
      api.get('/notifications', { params: { limit: 1 } })
        .then((r) => setUnread(r.data.unread ?? 0)).catch(() => {});
      api.get('/loan-requests/inbox', { params: { status: 'pending' } })
        .then((r) => setPending(r.data.items.length)).catch(() => {});
    }
  }, [loc.pathname, user?.role]);

  // derive a readable page title from the path
  const seg = loc.pathname.split('/').filter(Boolean);
  const lastSeg = seg[seg.length - 1] ?? 'dashboard';
  const pageTitle = lastSeg.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // A tenant owner may authenticate to submit or resubmit verification, but
  // no operational navigation is shown until the business is approved.
  if (tenant && tenant.status !== 'active') {
    return (
      <main className="min-h-screen bg-[#F5F6F8] p-5">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6F8]">

      {/* ── sidebar ── */}
      <aside
        className="flex h-full w-[200px] shrink-0 flex-col overflow-y-auto border-r border-[#E7EAF1] bg-white"
        style={{ boxShadow: '1px 0 0 #E7EAF1' }}
      >
        {/* wordmark */}
        <Link to="/" className="flex items-center gap-2.5 px-4 py-[14px] border-b border-[#E7EAF1]">
          <div
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] font-display text-[13px] font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg,#2E63E6,#0D2C6E)' }}
          >
            K
          </div>
          <div>
            <b className="block font-display text-[12.5px] leading-tight tracking-tight text-[#0F1115]">
              Kumvwa
            </b>
            <span className="text-[7.5px] font-extrabold tracking-[0.22em] text-[#1A4FBF]">
              FINANCE
            </span>
          </div>
        </Link>

        {/* nav groups */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map((g) => {
            const items = g.items.filter((i) => user && i.roles.includes(user.role));
            if (items.length === 0) return null;
            return (
              <div key={g.cap} className="mb-1">
                <div className="px-4 pb-1 pt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-[#9AA3B2]">
                  {g.cap}
                </div>
                {items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/admin'}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 px-4 py-[7px] text-[12px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#EEF3FD] text-[#1A4FBF]'
                          : 'text-[#4A5568] hover:bg-[#F5F6F8] hover:text-[#0F1115]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-[3px] bottom-[3px] w-[3px] rounded-r-full bg-[#1A4FBF]" />
                        )}
                        <Icon
                          size={14}
                          className={isActive ? 'text-[#1A4FBF]' : 'text-[#9AA3B2]'}
                        />
                        <span className="flex-1">{label}</span>
                        {badge && pending > 0 && (
                          <span className="rounded-[3px] bg-danger-500 px-1.5 py-px text-[9px] font-extrabold text-white">
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

        {/* tenant chip + logout */}
        <div className="border-t border-[#E7EAF1] p-3 space-y-1">
          {tenant && (
            <div className="flex items-center gap-2 rounded-[3px] border border-[#E7EAF1] bg-[#F5F6F8] px-2.5 py-2">
              <Avatar name={tenant.name} size={24} />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[10.5px] font-semibold text-[#0F1115]">
                  {tenant.name}
                </b>
                <span className="flex items-center gap-1 text-[9px] font-bold text-accent-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                  {tenant.status === 'active' ? 'Verified' : tenant.status.replaceAll('_', ' ')}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={async () => { await logout(); window.location.href = '/login'; }}
            className="flex w-full items-center gap-2.5 rounded-[3px] px-2.5 py-2 text-[11.5px] font-semibold text-[#7A8194] hover:bg-[#F5F6F8] hover:text-[#0F1115]"
          >
            <FiLogOut size={13} /> Log out
          </button>
        </div>
      </aside>

      {/* ── main column ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* topbar */}
        <header className="flex h-[46px] shrink-0 items-center gap-3 border-b border-[#E7EAF1] bg-white px-5">
          {/* breadcrumb */}
          <span className="text-[11.5px] font-bold text-[#0F1115]">{pageTitle}</span>
          <span className="text-[#D1D5DB]">·</span>
          <span className="text-[11px] text-[#9AA3B2]">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>

          {/* search */}
          <div className="mx-auto flex w-full max-w-[360px] items-center gap-2 rounded-[3px] border border-[#E7EAF1] bg-[#F5F6F8] px-3 py-1.5">
            <FiSearch size={12} className="shrink-0 text-[#9AA3B2]" />
            <span className="flex-1 text-[11.5px] text-[#9AA3B2]">Search clients, loans, NRC…</span>
            <kbd className="rounded-[2px] border border-[#E7EAF1] bg-white px-1.5 py-px text-[9px] font-bold text-[#9AA3B2]">
              ⌘K
            </kbd>
          </div>

          {/* notification bell */}
          <button
            type="button"
            className="relative flex h-[30px] w-[30px] items-center justify-center rounded-[3px] border border-[#E7EAF1] bg-white text-[#7A8194] hover:bg-[#F5F6F8]"
          >
            <FiBell size={13} />
            {unread > 0 && (
              <em className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full border border-white bg-danger-500 px-1 text-[8px] font-extrabold not-italic text-white">
                {unread}
              </em>
            )}
          </button>

          {/* user chip */}
          <div className="flex items-center gap-2 rounded-[3px] border border-[#E7EAF1] bg-[#F5F6F8] px-2.5 py-1.5">
            <Avatar name={user?.displayName ?? '?'} tone="brand" size={20} />
            <div>
              <b className="block text-[11px] leading-tight text-[#0F1115]">{user?.displayName}</b>
              <span className="text-[9px] capitalize text-[#9AA3B2]">
                {user?.role.replaceAll('_', ' ')}
              </span>
            </div>
          </div>
        </header>

        {/* page content */}
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
