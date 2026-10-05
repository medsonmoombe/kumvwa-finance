/** Single permission source shared by API enforcement and console role editing. */
export const PERMISSION_CATALOG = {
  Clients: [
    { key: 'clients.read', label: 'View clients' },
    { key: 'clients.invite', label: 'Invite clients' },
    { key: 'clients.override', label: 'Set credit-limit overrides' },
  ],
  Loans: [
    { key: 'loans.read', label: 'View loans' },
    { key: 'loans.issue', label: 'Issue loans' },
    { key: 'loans.approve', label: 'Approve loan requests' },
    { key: 'loans.reject', label: 'Decline loan requests' },
    { key: 'loans.repayment', label: 'Record repayments' },
    { key: 'loans.rollover', label: 'Approve extensions' },
  ],
  Payments: [
    { key: 'payments.read', label: 'View payments' },
    { key: 'payments.charge', label: 'Take payments (MoMo / card)' },
    { key: 'payments.disburse', label: 'Disburse loan funds' },
  ],
  Billing: [
    { key: 'billing.read', label: 'View billing and usage' },
    { key: 'billing.manage', label: 'Buy client slots / manage billing' },
  ],
  Configuration: [
    { key: 'products.manage', label: 'Manage loan products' },
    { key: 'policy.manage', label: 'Manage lending rules' },
    { key: 'terms.manage', label: 'Publish lending terms' },
    { key: 'branding.manage', label: 'Manage app branding' },
  ],
  Administration: [
    { key: 'reports.view', label: 'View reports' },
    { key: 'audit.view', label: 'View audit log' },
    { key: 'staff.manage', label: 'Manage staff and roles' },
  ],
} as const;

export type PermissionKey =
  (typeof PERMISSION_CATALOG)[keyof typeof PERMISSION_CATALOG][number]['key'];

export const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_CATALOG)
  .flat()
  .map((permission) => permission.key);

export const SYSTEM_ROLES: Array<{ name: string; permissions: string[] }> = [
  {
    name: 'Manager',
    permissions: ALL_PERMISSIONS.filter((permission) => permission !== 'staff.manage'),
  },
  {
    name: 'Loan Officer',
    permissions: [
      'clients.read',
      'clients.invite',
      'loans.read',
      'loans.approve',
      'loans.reject',
      'loans.repayment',
      'reports.view',
    ],
  },
  { name: 'Teller', permissions: ['loans.read', 'loans.repayment'] },
];
