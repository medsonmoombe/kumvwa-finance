/**
 * Seed: platform admin account + platform terms v1.
 * Run: pnpm prisma:seed
 *
 * Safe to re-run — all upserts are idempotent.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@kumvwa.co.zm';
const ADMIN_PHONE = '+260000000000';
const ADMIN_PASSWORD = 'Admin@1234'; // change after first login

const PLATFORM_TERMS_V1 = `KUMVWA FINANCE — PLATFORM TERMS OF SERVICE (v1 · DRAFT)

1. WHAT KUMVWA IS
Kumvwa Finance is a software platform providing loan management tools to
verified lending businesses ("Lenders"). Kumvwa is NOT a lender and does not
provide credit.

2. LENDING DECISIONS ARE YOURS
Each Lender is solely responsible for assessing borrowers, setting loan terms,
approving or declining loans, and collecting repayments. Kumvwa does not assess
credit risk on any borrower's behalf, and any risk indicator shown in the
platform is informational only.

3. NO LIABILITY FOR LENDING OUTCOMES
To the maximum extent permitted by law, Kumvwa is not liable for any loss
arising from lending decisions, borrower default, repayment behaviour, or the
use of information provided through the platform.

4. LENDER ELIGIBILITY
Lender accounts are available only to businesses holding a valid Bank of Zambia
registration, which must be maintained in good standing. Kumvwa may suspend
accounts whose registration lapses.

5. DATA AND PRIVACY
Personal data is processed per the Privacy Policy and the Zambia Data
Protection Act, 2021. Lenders are independently responsible for their lawful
basis for processing borrower data they enter into the platform.

[FULL TEXT PENDING LEGAL REVIEW — v1 placeholder]`;

async function main() {
  // 1. Platform terms v1
  await prisma.platformTerms.upsert({
    where: { version: 1 },
    create: { version: 1, body: PLATFORM_TERMS_V1 },
    update: {},
  });
  console.log('✓ Platform terms v1 seeded');

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
