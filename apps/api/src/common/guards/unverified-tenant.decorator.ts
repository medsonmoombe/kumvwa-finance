import { SetMetadata } from '@nestjs/common';

/** Routes available to a lender while its business is under review. */
export const ALLOW_UNVERIFIED_TENANT = 'allow_unverified_tenant';
export const AllowUnverifiedTenant = () =>
  SetMetadata(ALLOW_UNVERIFIED_TENANT, true);
