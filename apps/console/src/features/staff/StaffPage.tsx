import { useCallback, useEffect, useState } from 'react';
import { FiMail, FiPlus } from 'react-icons/fi';

import { Avatar, Badge, ErrorBox, Spinner, inputCls } from '../../components/ui';
import {
  AppTable, Drawer, Field, PageActionBar, PageTabs, Pill, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { ALL_PERMISSIONS, PERMISSION_CATALOG } from '@kumvwa/core';

interface StaffUser {
  id: string; displayName: string; phone: string; email: string | null;
  role: string; roleId: string | null; status: string;
  staffRole: { id: string; name: string } | null;
}

interface Role {
  id: string; name: string; isSystem: boolean; permissions: string[];
}

export function StaffPage() {
  const [tab, setTab] = useState('staff');
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api.get<StaffUser[]>('/staff'), api.get<Role[]>('/roles')])
      .then(([u, r]) => { setUsers(u.data); setRoles(r.data); })
      .catch(() => setError('Could not load staff and roles'));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageActionBar
        title="Staff and Roles"
        sub="Least-privilege access. Every change is audited."
      />
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <PageTabs
        tabs={[
          { id: 'staff', label: 'Staff accounts' },
          { id: 'roles', label: 'Roles and permissions' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === 'staff' ? (
          <StaffTab users={users} roles={roles ?? []} reload={load} onError={setError} />
        ) : (
          <RolesTab roles={roles} reload={load} onError={setError} />
        )}
      </div>
    </div>
  );
}

// ── Staff tab ─────────────────────────────────────────────────────────────────

function StaffTab({
  users, roles, reload, onError,
}: {
  users: StaffUser[] | null; roles: Role[];
  reload: () => void; onError: (m: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState('');

  async function resendAccess(user: StaffUser) {
    try {
      await api.post(`/staff/${user.id}/resend-access`);
      setNotice(`Sign-in email queued for ${user.email ?? user.displayName}.`);
    } catch (e) { onError(apiError(e)); }
  }

  const roleName = (u: StaffUser) =>
    u.staffRole?.name ?? roles.find((r) => r.id === u.roleId)?.name ?? 'Owner';

  const columns: Array<Column<StaffUser>> = [
    {
      key: 'who', header: 'Staff member', width: '34%',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={u.displayName} size={30} tone={u.status === 'active' ? 'brand' : 'red'} />
          <div>
            <b className="block font-semibold">{u.displayName}</b>
            <span className="text-[10.5px] text-ink-muted">{u.email ?? u.phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'login', header: 'Login',
      render: (u) => <span className="text-[11px] text-ink-muted">{u.email ?? u.phone}</span>,
    },
    {
      key: 'role', header: 'Role',
      render: (u) => (
        <Badge color="blue">{u.role === 'tenant_owner' ? 'Owner' : roleName(u)}</Badge>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (u) => <Badge color={u.status === 'active' ? 'green' : 'grey'} dot>{u.status}</Badge>,
    },
  ];

  return (
    <>
      <AppTable
        columns={columns}
        rows={users}
        searchKeys={['displayName', 'email', 'phone', 'role', 'status']}
        onRefresh={reload}
        actions={(user) => user.role === 'tenant_staff' && user.status === 'active' ? [{
          label: 'Resend sign-in email', icon: <FiMail size={12} />, onClick: (row) => void resendAccess(row),
        }] : []}
        toolbarRight={
          <Pill onClick={() => setAddOpen(true)}><FiPlus size={11} /> Add Staff Member</Pill>
        }
        empty="No staff yet. Add your first team member."
      />
      {notice && <p className="mt-2 text-[11.5px] font-semibold text-accent-700">{notice}</p>}

      <Drawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Staff Member"
        sub="They sign in with email + password, verified by an emailed code each time."
      >
        <AddStaffForm
          roles={roles}
          existing={users ?? []}
          onDone={() => { setAddOpen(false); reload(); }}
          onError={onError}
        />
      </Drawer>
    </>
  );
}

function AddStaffForm({
  roles, existing, onDone, onError,
}: {
  roles: Role[];
  existing: StaffUser[];
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    displayName: '', phone: '', email: '', password: '', roleId: roles[0]?.id ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // field-level duplicate checks against current staff list
  const phoneTaken = form.phone.length >= 9 &&
    existing.some((u) => u.phone.replace(/\D/g, '') === form.phone.replace(/\D/g, ''));
  const emailTaken = form.email.length > 3 &&
    existing.some((u) => u.email?.toLowerCase() === form.email.toLowerCase());

  const canSubmit =
    !busy &&
    form.displayName.trim().length >= 2 &&
    form.email.includes('@') &&
    form.phone.replace(/\D/g, '').length >= 9 &&
    form.password.length >= 8 &&
    form.roleId &&
    !phoneTaken &&
    !emailTaken;

  async function create() {
    if (!canSubmit) return;
    setBusy(true); setError('');
    try {
      await api.post('/staff', {
        ...form,
        phone: form.phone.replace(/\D/g, ''),
      });
      onDone();
    } catch (e) {
      const msg = apiError(e);
      // surface API-level duplicate errors inline too
      setError(msg); onError(msg); setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Full name" required>
        <input
          className={inputCls}
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="e.g. Chanda Mutale"
          autoFocus
        />
      </Field>

      <Field label="Email (their login)" required>
        <input
          className={`${inputCls} ${emailTaken ? 'border-red-400 focus:border-red-500' : ''}`}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="staff@yourbusiness.zm"
        />
        {emailTaken && (
          <p className="mt-1 text-[10.5px] font-semibold text-red-600">
            This email is already registered to a staff member.
          </p>
        )}
      </Field>

      <Field label="Phone number" required>
        <input
          className={`${inputCls} tabular-nums ${phoneTaken ? 'border-red-400 focus:border-red-500' : ''}`}
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
          placeholder="0971234567"
        />
        {phoneTaken && (
          <p className="mt-1 text-[10.5px] font-semibold text-red-600">
            This phone number is already registered to a staff member.
          </p>
        )}
      </Field>

      <Field label="Temporary password" required>
        <input
          className={inputCls}
          type="text"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Min 8 characters"
        />
        {form.password.length > 0 && form.password.length < 8 && (
          <p className="mt-1 text-[10.5px] font-semibold text-amber-600">
            Password must be at least 8 characters.
          </p>
        )}
      </Field>

      <Field label="Role" required>
        <select
          className={inputCls}
          value={form.roleId}
          onChange={(e) => setForm({ ...form, roleId: e.target.value })}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.permissions.length} permissions)
            </option>
          ))}
        </select>
      </Field>

      {error && <ErrorBox message={error} />}

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Pill disabled={!canSubmit} onClick={create}>
          {busy ? <Spinner className="border-white" /> : 'Create Account'}
        </Pill>
      </div>
    </div>
  );
}

// ── Roles tab ─────────────────────────────────────────────────────────────────

function RolesTab({
  roles, reload, onError,
}: {
  roles: Role[] | null; reload: () => void; onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Role | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function createRole() {
    setSaving(true);
    try {
      await api.post('/roles', { name, permissions: ['loans.read'] });
      setCreateOpen(false); setName(''); reload();
    } catch (e) { onError(apiError(e)); }
    finally { setSaving(false); }
  }

  async function savePermissions() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/roles/${editing.id}`, { name: editing.name, permissions: editing.permissions });
      setEditing(null); reload();
    } catch (e) { onError(apiError(e)); }
    finally { setSaving(false); }
  }

  function toggle(role: Role, perm: string) {
    const has = role.permissions.includes(perm);
    setEditing({
      ...role,
      permissions: has ? role.permissions.filter((p) => p !== perm) : [...role.permissions, perm],
    });
  }

  const columns: Array<Column<Role>> = [
    {
      key: 'name', header: 'Role',
      render: (r) => (
        <b className="font-semibold">
          {r.name}
          {r.isSystem && <span className="ml-2 text-[10px] font-normal text-ink-muted">system</span>}
        </b>
      ),
    },
    {
      key: 'perms', header: 'Permissions',
      render: (r) => <Badge color="blue">{r.permissions.length} of {ALL_PERMISSIONS.length}</Badge>,
    },
    {
      key: 'edit', header: '',
      render: (r) => r.isSystem
        ? <span className="text-[10.5px] text-ink-muted">locked</span>
        : <span className="text-[11px] font-bold text-brand-600">Edit</span>,
    },
  ];

  return (
    <>
      <AppTable
        columns={columns}
        rows={roles}
        searchKeys={['name', 'permissions']}
        onRefresh={reload}
        onRowClick={(r) => { if (!r.isSystem) setEditing({ ...r, permissions: [...r.permissions] }); }}
        toolbarRight={
          <Pill onClick={() => setCreateOpen(true)}><FiPlus size={11} /> Create Role</Pill>
        }
        empty="No roles"
      />

      {/* Create role drawer */}
      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Role"
        sub="Start from a single permission, then grant the rest in the matrix."
      >
        <div className="space-y-3">
          <Field label="Role name" required>
            <input className={inputCls} value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Branch Supervisor" />
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Pill tone="ghost" onClick={() => setCreateOpen(false)}>Cancel</Pill>
            <Pill disabled={saving || name.trim().length < 2} onClick={createRole}>
              {saving ? 'Creating…' : 'Create Role'}
            </Pill>
          </div>
        </div>
      </Drawer>

      {/* Permission matrix drawer */}
      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Permissions · ${editing.name}` : ''}
        sub="Changes apply within 15 minutes (next token refresh)."
        width={460}
      >
        {editing && (
          <div>
            {(Object.entries(PERMISSION_CATALOG) as Array<[string, ReadonlyArray<{ readonly key: string; readonly label: string }>]>).map(([group, perms]) => (
              <div key={group} className="mb-4">
                <div className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
                  {group}
                </div>
                {perms.map((p) => {
                  const on = editing.permissions.includes(p.key);
                  return (
                    <label key={p.key}
                      className={`mb-1 flex cursor-pointer items-center justify-between rounded-[3px] border px-3 py-2 text-[12px] transition-colors ${
                        on ? 'border-brand-100 bg-brand-50' : 'border-line bg-white hover:bg-surface'
                      }`}>
                      <span className={on ? 'font-semibold text-ink' : 'text-ink-2'}>{p.label}</span>
                      <input type="checkbox" checked={on}
                        onChange={() => toggle(editing, p.key)}
                        className="accent-brand-600" />
                    </label>
                  );
                })}
              </div>
            ))}
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Pill tone="ghost" onClick={() => setEditing(null)}>Cancel</Pill>
              <Pill onClick={savePermissions} disabled={saving}>
                {saving ? 'Saving…' : 'Save Permissions'}
              </Pill>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
