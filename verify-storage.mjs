const BASE = 'http://localhost:8080/api/v1';
const PDF = Buffer.from('%PDF-1.7\n%Fake BOZ certificate body\n%%EOF\n');

const j = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body, headers: res.headers };
};

const fail = (m) => { console.error('FAIL: ' + m); process.exitCode = 1; };

async function main() {
  // 1. Register a lender WITHOUT an otpToken (the original reported bug)
  const phone = '097' + String(Date.now()).slice(-7);
  const reg = await j(`${BASE}/auth/register/tenant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone, password: 'S3cure-Passw0rd!', email: `${phone}@example.zm`,
      businessName: 'Local Storage Lender', businessType: 'sacco',
      contactPerson: 'Storage Test', acceptedTermsVersion: 1,
    }),
  });
  if (reg.status !== 201) return fail(`register -> ${reg.status} ${JSON.stringify(reg.body)}`);
  console.log(`OK  registration without otpToken -> 201 (${phone})`);
  const auth = { authorization: `Bearer ${reg.body.accessToken}` };

  // 2. Mint a local upload URL
  const up = await j(`${BASE}/files/upload-url`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'boz_certificate', mime: 'application/pdf', size: PDF.length }),
  });
  if (!up.ok) return fail(`upload-url -> ${up.status} ${JSON.stringify(up.body)}`);
  console.log(`OK  uploadUrl = ${up.body.uploadUrl}`);
  if (!up.body.uploadUrl.includes('/files/local-storage/upload')) {
    return fail('uploadUrl is not the local-driver URL');
  }

  // 3. PUT bytes straight to storage
  const put = await fetch(up.body.uploadUrl, {
    method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: PDF,
  });
  if (!put.ok) return fail(`PUT storage -> ${put.status} ${await put.text()}`);
  console.log(`OK  PUT -> ${put.status}, etag=${put.headers.get('etag')}`);

  // 4. Confirm
  const conf = await j(`${BASE}/files/${up.body.fileId}/confirm`, { method: 'POST', headers: auth });
  if (!conf.ok) return fail(`confirm -> ${conf.status} ${JSON.stringify(conf.body)}`);
  console.log(`OK  confirm -> ${JSON.stringify(conf.body)}`);

  // 5. Download and compare bytes
  const dl = await j(`${BASE}/files/${up.body.fileId}/download-url`, { headers: auth });
  if (!dl.ok) return fail(`download-url -> ${dl.status} ${JSON.stringify(dl.body)}`);
  const got = await fetch(dl.body.downloadUrl);
  const bytes = Buffer.from(await got.arrayBuffer());
  if (got.status !== 200) return fail(`download -> ${got.status}`);
  if (!bytes.equals(PDF)) return fail('downloaded bytes differ from uploaded bytes');
  if (got.headers.get('content-type') !== 'application/pdf') {
    return fail(`content-type = ${got.headers.get('content-type')}`);
  }
  console.log(`OK  round-trip: ${bytes.length} bytes as ${got.headers.get('content-type')}`);

  // 6. Submit the certificate for review
  const ver = await j(`${BASE}/tenants/me/verification`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ fileId: up.body.fileId, ownerNrc: '245711/63/1' }),
  });
  if (!ver.ok) return fail(`verification -> ${ver.status} ${JSON.stringify(ver.body)}`);
  console.log(`OK  certificate submitted -> ${ver.status}`);

  // 7. Tampered signature must be refused
  const tampered = new URL(dl.body.downloadUrl);
  tampered.searchParams.set('sig', '0'.repeat(64));
  const bad = await fetch(tampered.toString());
  if (bad.status !== 403) return fail(`tampered sig -> ${bad.status} (expected 403)`);
  console.log('OK  tampered signature -> 403');

  // 8. Path traversal must be refused
  const trav = new URL(dl.body.downloadUrl);
  trav.searchParams.set('key', '../../../windows/win.ini');
  const bad2 = await fetch(trav.toString());
  if (![403, 404].includes(bad2.status)) return fail(`traversal -> ${bad2.status}`);
  console.log(`OK  path traversal -> ${bad2.status}`);

  console.log('ALL LOCAL STORAGE CHECKS PASSED');
  console.log(`STORAGE_KEY=${up.body.storageKey}`);
}

main().catch((e) => fail(e?.message ?? String(e)));
