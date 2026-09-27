import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS, permissions);
