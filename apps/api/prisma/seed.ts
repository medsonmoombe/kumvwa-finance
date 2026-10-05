/**
 * Seed: platform admin account + platform legal documents (v1).
 * Run: pnpm prisma:seed
 *
 * Safe to re-run — all upserts are idempotent.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

// The copy lives with the service so the runtime bootstrap and this seed can
// never ship different text.
import {
  DEFAULT_LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_KINDS,
} from '../src/modules/terms/legal-documents';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@kumvwa.co.zm';
const ADMIN_PHONE = '+260000000000';
const ADMIN_PASSWORD = 'Admin@1234'; // change after first login

async function main() {
  // 1. Platform legal documents v1 — Terms of Service and Privacy Policy.
  //    `update: {}` is deliberate: re-seeding must not rewrite a version that
  //    users may already have accepted.
  for (const kind of LEGAL_DOCUMENT_KINDS) {
    await prisma.platformTerms.upsert({
      where: { kind_version: { kind, version: 1 } },
      create: { kind, version: 1, body: DEFAULT_LEGAL_DOCUMENTS[kind] },
      update: {},
    });
    console.log(`✓ Platform ${kind} v1 seeded`);
  }

  // 2. Default billing plan — the free floor every lender starts on.
  //    3 clients included; each additional client is K100 / month.
  await prisma.billingPlan.upsert({
    where: { key: 'free' },
    create: {
      key: 'free',
      name: 'Free',
      includedClients: 3,
      pricePerExtraClientMinor: 10_000n, // K100.00
      interval: 'monthly',
      isDefault: true,
      active: true,
    },
    update: { isDefault: true },
  });
  console.log('✓ Default billing plan (3 free clients, K100/extra) seeded');

  // 2. Platform admin user
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    const passwordHash = await hash(ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        phone: ADMIN_PHONE,
        email: ADMIN_EMAIL,
        passwordHash,
        displayName: 'Platform Admin',
        role: 'platform_admin',
        twoFactorEnabled: false, // disable 2FA for dev convenience
      },
    });
    console.log(`✓ Admin created  →  ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  } else {
    console.log(`✓ Admin already exists  →  ${ADMIN_EMAIL}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
