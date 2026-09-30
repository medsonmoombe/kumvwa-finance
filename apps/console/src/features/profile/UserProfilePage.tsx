import { useRef, useState } from 'react';

import { Avatar, ErrorBox } from '../../components/ui';
import { PageActionBar, Pill } from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function UserProfilePage() {
  const { user, refreshSession } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a PNG or JPEG image smaller than 5 MB.');
      return;
    }
    setBusy(true); setError('');
    try {
      const created = await api.post<{ fileId: string; uploadUrl: string }>('/files/platform/upload-url', {
        kind: 'profile_image', mime: file.type, size: file.size,
      });
      const put = await fetch(created.data.uploadUrl, {
        method: 'PUT', headers: { 'Content-Type': file.type }, body: file,
      });
      if (!put.ok) throw new Error('Image upload failed');
      await api.post('/files/platform/' + created.data.fileId + '/confirm');
      await api.post('/files/platform/profile-image/' + created.data.fileId);
      await refreshSession();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  if (!user) return null;
  return <div>
    <PageActionBar title="My profile" sub="Your photo appears across platform administration." />
    {error && <div className="mb-3"><ErrorBox message={error} /></div>}
    <div className="max-w-[540px] border border-line bg-white p-5">
      <div className="flex items-center gap-4">
        <Avatar name={user.displayName} imageUrl={user.profileImageUrl} size={72} />
        <div><b className="block text-[15px]">{user.displayName}</b><span className="text-[12px] text-ink-muted">Platform administrator</span></div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => {
        const file = e.currentTarget.files?.[0]; if (file) void upload(file); e.currentTarget.value = '';
      }} />
      <div className="mt-5"><Pill onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Uploading...' : 'Update profile photo'}</Pill></div>
    </div>
  </div>;
}
