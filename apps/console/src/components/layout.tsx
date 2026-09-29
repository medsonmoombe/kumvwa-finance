import { useEffect, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiBarChart2,
  FiBell,
  FiFileText,
  FiGrid,
  FiInbox,
  FiLogOut,
  FiMail,
  FiMenu,
  FiPackage,
  FiSearch,
  FiSettings,
  FiShield,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

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
      { to: '/invites',   label: 'Invites',    icon: FiMail,     roles: ['tenant_owner', 'tenant_staff'] },
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
      { to: '/admin/borrowers', label: 'Borrowers',    icon: FiUsers,    roles: ['platform_admin'] },
      { to: '/admin/audit',     label: 'Audit Log',    icon: FiActivity, roles: ['platform_admin'] },
    ],
  },
  {
    cap: 'Compliance',
    items: [
      { to: '/audit', label: 'Audit Log', icon: FiActivity, roles: ['tenant_owner', 'tenant_staff'] },
    ],
  },
];

/** The wordmark + grouped navigation, shared by the desktop rail and the mobile overlay. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, tenant, logout } = useAuth();
  const [pending, setPending] = useState(0);
  const loc = useLocation();

  useEffect(() => {
    if (user?.role === 'tenant_owner' || user?.role === 'tenant_staff') {
      api.get('/loan-requests/inbox', { params: { status: 'pending' } })
        .then((r) => setPending(r.data.items.length)).catch(() => {});
    }
  }, [loc.pathname, user?.role]);

  return (
    <>
      {/* wordmark */}
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 border-b border-[#E7EAF1] px-4 py-[14px]">
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
      <nav className="min-h-0 flex-1 overflow-y-auto py-2">
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
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 px-4 py-[9px] text-[12px] font-semibold transition-colors ${
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
                        size={15}
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
      <div className="space-y-1 border-t border-[#E7EAF1] p-3">
        {tenant && (
          <div className="flex items-center gap-2 rounded-[3px] border border-[#E7EAF1] bg-[#F5F6F8] px-2.5 py-2">
            <Avatar name={tenant.name} size={24} />
            <div className="min-w-0 flex-1">
              <b className="block truncate text-[10.5px] font-semibold text-[#0F1115]">
                {tenant.name}
              </b>
              <span className="flex items-center gap-1 text-[9px] font-bold text-accent-700">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
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
    </>
  );
}

export function Shell() {
  const { user, tenant } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'tenant_owner' || user?.role === 'tenant_staff') {
      api.get('/notifications', { params: { limit: 1 } })
        .then((r) => setUnread(r.data.unread ?? 0)).catch(() => {});
    }
  }, [loc.pathname, user?.role]);

  // Navigating always dismisses the mobile overlay.
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  // Lock the page behind the overlay while it is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  // derive a readable page title from the path
  const seg = loc.pathname.split('/').filter(Boolean);
  const lastSeg = seg[seg.length - 1] ?? 'dashboard';
  const pageTitle = lastSeg.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // A tenant owner may authenticate to submit or resubmit verification, but
  // no operational navigation is shown until the business is approved.
  if (tenant && tenant.status !== 'active') {
    return (
      <main className="min-h-[100dvh] bg-[#F5F6F8] p-3 sm:p-5">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#F5F6F8]">

      {/* ── desktop sidebar ── */}
      <aside
        className="hidden h-full w-[200px] shrink-0 flex-col border-r border-[#E7EAF1] bg-white lg:flex"
        style={{ boxShadow: '1px 0 0 #E7EAF1' }}
      >
        <SidebarContent />
      </aside>

      {/* ── mobile nav overlay ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[#0D1426]/40 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[260px] max-w-[82vw] flex-col bg-white shadow-[8px_0_32px_rgba(15,17,21,0.16)]"
            style={{ boxShadow: '1px 0 0 #E7EAF1' }}
          >
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── main column ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* topbar */}
        <header className="flex h-[46px] shrink-0 items-center gap-2 border-b border-[#E7EAF1] bg-white px-3 sm:gap-3 sm:px-5">
          {/* mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[3px] border border-[#E7EAF1] bg-white text-[#7A8194] hover:bg-[#F5F6F8] lg:hidden"
          >
            <FiMenu size={14} />
          </button>

          {/* breadcrumb */}
          <span className="truncate text-[11.5px] font-bold text-[#0F1115]">{pageTitle}</span>
          <span className="hidden text-[#D1D5DB] sm:inline">·</span>
          <span className="hidden text-[11px] text-[#9AA3B2] md:inline">
            {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>

          {/* search */}
          <div className="ml-auto hidden w-full max-w-[360px] items-center gap-2 rounded-[3px] border border-[#E7EAF1] bg-[#F5F6F8] px-3 py-1.5 md:flex">
            <FiSearch size={12} className="shrink-0 text-[#9AA3B2]" />
            <span className="flex-1 truncate text-[11.5px] text-[#9AA3B2]">Search clients, loans, NRC…</span>
            <kbd className="rounded-[2px] border border-[#E7EAF1] bg-white px-1.5 py-px text-[9px] font-bold text-[#9AA3B2]">
              ⌘K
            </kbd>
          </div>

          {/* notification bell */}
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => { nav('/notifications'); setUnread(0); }}
            className="relative ml-auto flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[3px] border border-[#E7EAF1] bg-white text-[#7A8194] hover:bg-[#F5F6F8] md:ml-0"
          >
            <FiBell size={13} />
            {unread > 0 && (
              <em className="absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full border border-white bg-danger-500 px-1 text-[8px] font-extrabold not-italic text-white">
                {unread}
              </em>
            )}
          </button>

          {/* user chip */}
          <div className="flex min-w-0 items-center gap-2 rounded-[3px] border border-[#E7EAF1] bg-[#F5F6F8] py-1 pl-1.5 pr-2 sm:px-2.5">
            <Avatar name={user?.displayName ?? '?'} tone="brand" size={20} />
            <div className="hidden min-w-0 sm:block">
              <b className="block truncate text-[11px] leading-tight text-[#0F1115]">{user?.displayName}</b>
              <span className="block truncate text-[9px] capitalize text-[#9AA3B2]">
                {user?.role.replaceAll('_', ' ')}
              </span>
            </div>
          </div>
        </header>

        {/* page content */}
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
