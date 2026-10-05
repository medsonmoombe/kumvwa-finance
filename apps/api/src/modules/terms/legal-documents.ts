/**
 * Kumvwa's own legal documents.
 *
 * This lives here rather than inline in the service or the seed so the two can
 * never disagree: `TermsService.onModuleInit` publishes a version when a
 * database has none, and `prisma/seed.ts` seeds a fresh one. When the copy is
 * updated here, both paths pick it up.
 *
 * Publishing is versioned, never in-place — `TermsAcceptance` rows point at the
 * exact version a user agreed to, so amending the text means publishing a new
 * version, which the console forces users to re-accept. That is why this file
 * describes v1 and editing it only affects installations that have never
 * published their own v1.
 *
 * IMPORTANT: this is drafting-quality copy written for the product, not legal
 * advice. It has been written against the Data Protection Act, No. 3 of 2021
 * and Bank of Zambia expectations. A Zambian lawyer should review it before
 * Kumvwa takes real money from real borrowers.
 */

export type LegalDocumentKind = 'terms' | 'privacy';

export const LEGAL_DOCUMENT_KINDS: readonly LegalDocumentKind[] = [
  'terms',
  'privacy',
];

export const LEGAL_DOCUMENT_TITLES: Record<LegalDocumentKind, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
};

export function isLegalDocumentKind(v: string): v is LegalDocumentKind {
  return (LEGAL_DOCUMENT_KINDS as readonly string[]).includes(v);
}

const TERMS_V1 = `KUMVWA FINANCE — PLATFORM TERMS OF SERVICE
Version 1

These terms govern your use of Kumvwa Finance, a software platform operated by
Kumvwa. By creating an account or using the platform you accept them.

1. WHAT KUMVWA IS
Kumvwa Finance is software that helps registered lending businesses manage
clients, loans, repayments and records. Kumvwa is a software provider. Kumvwa is
not a lender, does not extend credit, and does not hold client funds.

2. LENDING DECISIONS ARE THE LENDER'S
Each Lender is solely responsible for assessing applicants, deciding whether to
lend, setting interest and fees, and collecting repayment. Kumvwa does not
approve, decline, or recommend any loan, and any risk indicator, score or
indicator shown in the platform is informational only. A score is not a credit
decision and must not be presented as one.

3. YOUR ACCOUNT
You must give accurate registration details and keep them current. You are
responsible for activity under your account, including activity by staff you
have given access to. Tell us promptly if you suspect unauthorised access.

4. ELIGIBILITY AND REGISTRATION
Lender accounts are available to businesses holding a valid Bank of Zambia
registration and any licences their lending activity requires, and must be kept
in good standing. We may suspend or close an account whose registration lapses,
whose details are false, or that is used to lend outside the law.

5. REPAYMENT, PENALTIES AND DEFAULT
Repayment obligations are between you and the borrower. The lender sets the
schedule and any penalty, and must disclose the cost of borrowing in the manner
required by the Credit Agreements Act, 2021 before a borrower commits. Kumvwa
records repayments and can apply penalties configured by the lender, but the
lender is responsible for the accuracy and fairness of its own policy and for
any collection action.

6. AVAILABILITY AND CHANGE
We aim for high availability but do not guarantee uninterrupted service. We may
suspend the platform for maintenance, security, or legal reasons. We may change
these terms; the new version takes effect when published, and we will ask you
to accept it before you continue using the platform.

7. DATA PROTECTION
How we handle personal data is set out in the Kumvwa Finance Privacy Policy,
which forms part of these terms. Data is processed under the Data Protection
Act, No. 3 of 2021. Each lender is independently responsible for the lawful
basis on which it processes borrower data it enters into the platform.

8. LIABILITY
To the extent permitted by law, Kumvwa is not liable for any loss arising from a
lender's lending decision, a borrower's default or repayment behaviour, or the
lender's use of information from the platform. Nothing in these terms excludes
liability that cannot lawfully be excluded.

9. TERMINATION
You may stop using the platform at any time. We may suspend or terminate for
breach of these terms, unlawful use, or non-payment of subscription fees. On
termination you must export the records you are required to keep; we may
retain them as required by law.

10. CHANGES TO THESE TERMS
We may update these terms. Material changes are announced in the app and take
effect on the published date. Your continued use after that date means you accept
the new version.

11. GOVERNING LAW
These terms are governed by the laws of the Republic of Zambia, and the courts
of Zambia have jurisdiction, subject to the Zambia Data Protection Act and the
Tribunal established under it.

12. CONTACT
Kumvwa Finance, Lusaka, Zambia. Support is available in the platform or at
support@kumvwa.co.zm.`;

const PRIVACY_V1 = `KUMVWA FINANCE — PRIVACY POLICY
Version 1

This policy explains what personal data Kumvwa Finance collects, why, and what
you can do about it. It applies to clients, lenders and their staff who use the
Kumvwa platform, and to this policy's operation under the Data Protection Act,
No. 3 of 2021 (the "Act").

1. WHO IS THE DATA CONTROLLER
For data about a borrower's loan and repayment history, the controller is the
lender that holds the lending relationship with that borrower. Kumvwa acts as a
processor on that lender's instructions to run the platform. Kumvwa is the
controller for data about your own account, sign-in, and use of the platform.

2. DATA WE COLLECT
a. Identity and contact data: name, national registration or identification
   number where required, phone number, email address, business name and
   registration details, and profile photograph.
b. Account and security data: sign-in credentials (stored as a one-way hash),
   device and session information, and sign-in records.
c. Financial data: loan amounts, interest, fees, penalties, repayment amounts,
   dates, outstanding balances, and payment method references.
d. Content you upload: profile photographs, business logos, and documents.
e. Technical data: IP address, device identifiers, error and diagnostic logs,
   and the pages you use.
f. Communications: messages between lenders and borrowers made through the
   platform, and support correspondence.

We do not ask for and do not want your bank PIN or full card number. Repayment
instructions and references are shared with you by the lender directly.

3. WHY WE USE IT, AND ON WHAT BASIS
To administer the platform and the loan relationship: to open and maintain
accounts, calculate and schedule repayments, record and reconcile payments,
apply the lender's penalties, produce statements and reports, and handle
disputes. The basis is performance of a contract, or legitimate interests in
operating a secure platform, except where the Act requires consent.

To meet legal obligations: prudential, tax and record-keeping requirements of
the Bank of Zambia and the Registrar of Companies, and the Act.

For our legitimate interests: fraud prevention, security, and improving the
platform — using aggregated or de-identified information wherever possible.

To send service messages about your loan, repayments, or account. Marketing
communications are sent only where you have asked for them, and you can stop
them at any time without affecting service messages.

4. SPECIAL CATEGORY AND HIGH-RISK DATA
You can choose to record next-of-kin contact details so a lender may reach them
if a repayment is seriously overdue. These are treated with care, shown only to
the lender you are linked to, and must not be used for unrelated purposes. Do not
submit health, religious, or political data.

5. WHO WE SHARE IT WITH
The lender you are linked to, for your loan and repayment. Service providers who
host, secure, or support the platform, under contract and only as needed. A
lender's professional advisers. Authorities, where the law requires it — for
example, a lawful order of a Tribunal or court. We do not sell personal data.

6. WHERE IT IS STORED AND KEPT
Data is stored on servers located in Zambia and, where necessary, in the region,
with access restricted by role and logged. Financial records are retained for the
period required of lenders by law — commonly at least six years — and account
records for as long as needed to resolve disputes.

7. YOUR RIGHTS
Under the Act you may ask us or the relevant lender for access to your data, and
you may ask for it to be corrected or, where the grounds exist, erased or
restricted. You may object to processing based on legitimate interests, withdraw
consent, and ask for a copy in a portable format. You may complain to the
Tribunal established under the Act.

Requests go to the lender you are linked to, or to Kumvwa for your own account
data. We respond within the period the Act allows. Some rights are limited where
the law requires records to be kept, or where another party's rights would be
affected.

8. SECURITY
Access is limited by role and protected with hashed credentials, encrypted
transport, and audit logs of who did what. No system is perfectly secure; if a
breach affects your data we will notify you and any authority as the Act
requires.

9. INTERNATIONAL TRANSFERS
Data stays in Zambia and the region wherever we can. If it must be transferred
elsewhere to run the platform, we will ensure it is protected to a standard the
Act accepts, and we will say so on request.

10. CHILDREN
The platform is for businesses and adults able to enter a binding lending
relationship. We do not knowingly collect data from children. If you believe a
child's data has been submitted, contact us and we will delete it.

11. CHANGES TO THIS POLICY
We may update this policy. Material changes are announced in the app and take
effect on the published date. The version you accepted is retained.

12. CONTACT
Questions, access requests, or complaints: support@kumvwa.co.zm, or write to
Kumvwa Finance, Lusaka, Zambia. Data-protection complaints may also be brought
before the Tribunal established under the Data Protection Act.`;

export const DEFAULT_LEGAL_DOCUMENTS: Record<LegalDocumentKind, string> = {
  terms: TERMS_V1,
  privacy: PRIVACY_V1,
};