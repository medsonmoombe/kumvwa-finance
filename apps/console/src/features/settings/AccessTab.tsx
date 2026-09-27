import { useEffect, useState, type ReactNode } from 'react';
import { FiPlus, FiUserMinus, FiUsers } from 'react-icons/fi';

import { Card, Empty, ErrorBox, Spinner, inputCls, labelCls } from '../../components/ui';
import { api, apiError } from '../../lib/api';

type Role = { id: string; name: string; isSystem: boolean; permissions: string[] };
type Staff = { id: string; displayName: string; email: string | null; phone: string; status: string; staffRole: Role | null };

export function AccessTab() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({ displayName: '', email: '', phone: '', password: '', roleId: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [people, roleRows] = await Promise.all([api.get<Staff[]>('/staff'), api.get<Role[]>('/roles')]);
      setStaff(people.data);
      setRoles(roleRows.data);
      setForm((value) => ({ ...value, roleId: value.roleId || roleRows.data[0]?.id || '' }));
    } catch (e) { setError(apiError(e)); }
  }
  useEffect(() => { void load(); }, []);

  async function addStaff() {
    setBusy(true); setError('');
    try {
      await api.post('/staff', form);
      setForm({ displayName: '', email: '', phone: '', password: '', roleId: roles[0]?.id || '' });
      await load();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }
  async function disable(id: string) {
    try { await api.delete(`/staff/${id}`); await load(); } catch (e) { setError(apiError(e)); }
  }

  return <div className="space-y-4">
    {error && <ErrorBox message={error} />}
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2"><FiPlus className="text-brand-600" /><b className="text-[14px]">Add staff member</b></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full name"><input className={inputCls} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
        <Field label="Work email"><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone number"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Temporary password"><input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Role"><select className={inputCls} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
      </div>
      <button disabled={busy || !form.displayName || !form.email || !form.phone || !form.password || !form.roleId} onClick={addStaff} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-btn bg-brand-600 px-4 text-[12px] font-bold text-white disabled:opacity-40">{busy ? <Spinner className="border-white" /> : <><FiPlus /> Add staff</>}</button>
    </Card>
    <Card>
      <div className="border-b border-line px-5 py-3"><b className="text-[14px]">Team access</b></div>
      {staff.length === 0 ? <Empty icon={<FiUsers />} title="No staff members yet" /> : staff.map((person) => <div key={person.id} className="flex items-center justify-between border-b border-line-2 px-5 py-3 last:border-0"><div><div className="text-[13px] font-bold">{person.displayName}</div><div className="text-[11.5px] text-ink-muted">{person.email} · {person.staffRole?.name ?? 'Owner'}</div></div>{person.staffRole && person.status === 'active' && <button onClick={() => disable(person.id)} className="rounded-lg p-2 text-danger-500 hover:bg-danger-50" title="Disable staff member"><FiUserMinus /></button>}</div>)}
    </Card>
    <Card className="p-5"><b className="text-[14px]">Roles</b><div className="mt-3 space-y-2">{roles.map((role) => <div key={role.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2"><span className="text-[12.5px] font-bold">{role.name}</span><span className="text-[11px] text-ink-muted">{role.permissions.length} permissions</span></div>)}</div></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className={labelCls}>{label}</span>{children}</label>; }
