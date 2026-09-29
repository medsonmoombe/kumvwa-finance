import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ALL_PERMISSIONS } from '@kumvwa/core';

import { PasswordService } from '../../common/crypto/password.service';
import { ENV, type Env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../infra/prisma.module';
import { CreateRoleDto, CreateStaffDto, UpdateRoleDto, UpdateStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  listStaff(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, role: { in: ['tenant_owner', 'tenant_staff'] } },
      select: {
        id: true, displayName: true, email: true, phone: true, role: true,
        status: true, roleId: true, createdAt: true,
        staffRole: { select: { id: true, name: true, permissions: true } },
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });
  }

  listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true, isSystem: true, permissions: true, createdAt: true, updatedAt: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async createStaff(tenantId: string, actorId: string, dto: CreateStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const role = await this.tenantRole(tenantId, dto.roleId);
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { phone: dto.phone.trim() }] } });
    if (existing) throw new BadRequestException('A user already exists with this email or phone number');
    const user = await this.prisma.user.create({
      data: {
        tenantId, role: 'tenant_staff', roleId: role.id, displayName: dto.displayName.trim(),
        email, phone: dto.phone.trim(), passwordHash: await this.passwords.hash(dto.password), status: 'active',
      },
      select: { id: true, displayName: true, email: true, phone: true, status: true, roleId: true },
    });
    await this.queueStaffAccessEmail(tenantId, user.email!, user.displayName, role.name);
    await this.audit.record({ actorId, action: 'staff.created', description: `New staff member "${user.displayName}" added with role ${role.name}`, entity: 'User', entityId: user.id, tenantId, diff: { roleId: role.id } });
    return user;
  }

  async resendStaffAccessEmail(tenantId: string, actorId: string, staffId: string) {
    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, tenantId, role: 'tenant_staff', status: 'active' },
      select: { id: true, displayName: true, email: true, staffRole: { select: { name: true } } },
    });
    if (!staff?.email) throw new NotFoundException('Active staff member not found');
    await this.queueStaffAccessEmail(tenantId, staff.email, staff.displayName, staff.staffRole?.name ?? 'Staff');
    await this.audit.record({ actorId, action: 'staff.access_email_resent', description: `Console access email resent to staff member "${staff.displayName}"`, entity: 'User', entityId: staff.id, tenantId });
    return { ok: true };
  }

  async updateStaff(tenantId: string, actorId: string, staffId: string, dto: UpdateStaffDto) {
    const user = await this.prisma.user.findFirst({ where: { id: staffId, tenantId, role: 'tenant_staff' } });
    if (!user) throw new NotFoundException('Staff member not found');
    const roleId = dto.roleId ? (await this.tenantRole(tenantId, dto.roleId)).id : undefined;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { roleId, ...(dto.active === undefined ? {} : { status: dto.active ? 'active' : 'disabled' }) },
      select: { id: true, displayName: true, email: true, status: true, roleId: true },
    });
    if (dto.active === false) {
      await this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({ actorId, action: 'staff.updated', description: `Staff member account updated${dto.active === false ? ' — access disabled' : ''}`, entity: 'User', entityId: user.id, tenantId, diff: dto });
    return updated;
  }

  async removeStaff(tenantId: string, actorId: string, staffId: string) {
    return this.updateStaff(tenantId, actorId, staffId, { active: false });
  }

  async createRole(tenantId: string, actorId: string, dto: CreateRoleDto) {
    this.assertPermissions(dto.permissions);
    const role = await this.prisma.role.create({ data: { tenantId, name: dto.name.trim(), permissions: dto.permissions } });
    await this.audit.record({ actorId, action: 'role.created', description: `New staff role "${role.name}" created with ${dto.permissions.length} permission(s)`, entity: 'Role', entityId: role.id, tenantId, diff: { permissions: dto.permissions } });
    return role;
  }

  async updateRole(tenantId: string, actorId: string, roleId: string, dto: UpdateRoleDto) {
    this.assertPermissions(dto.permissions);
    const role = await this.tenantRole(tenantId, roleId);
    if (role.isSystem) throw new BadRequestException('System roles cannot be edited');
    const updated = await this.prisma.role.update({ where: { id: role.id }, data: { name: dto.name.trim(), permissions: dto.permissions } });
    await this.audit.record({ actorId, action: 'role.updated', description: `Staff role "${role.name}" permissions updated`, entity: 'Role', entityId: role.id, tenantId, diff: { permissions: dto.permissions } });
    return updated;
  }

  async removeRole(tenantId: string, actorId: string, roleId: string) {
    const role = await this.tenantRole(tenantId, roleId);
    if (role.isSystem) throw new BadRequestException('System roles cannot be deleted');
    const staffCount = await this.prisma.user.count({ where: { roleId: role.id } });
    if (staffCount) throw new BadRequestException('Move staff to another role before deleting this role');
    await this.prisma.role.delete({ where: { id: role.id } });
    await this.audit.record({ actorId, action: 'role.deleted', description: `Staff role "${role.name}" permanently deleted`, entity: 'Role', entityId: role.id, tenantId });
    return { ok: true };
  }

  private async tenantRole(tenantId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async queueStaffAccessEmail(tenantId: string, email: string, displayName: string, roleName: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    await this.prisma.emailOutbox.create({
      data: {
        to: email,
        subject: `Your ${tenant?.name ?? 'Kumvwa'} console access`,
        body: [
          `Hi ${displayName},`,
          '',
          `You have been added as ${roleName} at ${tenant?.name ?? 'a Kumvwa lender'}.`,
          '',
          `Sign in at ${this.env.APP_BASE_URL}/login using this email and the temporary password provided by your administrator.`,
          'You will receive a one-time sign-in code by email on a new device.',
          '',
          'For security, your temporary password is not included in this email.',
        ].join('\n'),
        purpose: 'staff_access',
      },
    });
  }

  private assertPermissions(permissions: string[]) {
    const invalid = permissions.filter((permission) => !ALL_PERMISSIONS.includes(permission));
    if (invalid.length) throw new BadRequestException(`Unknown permission: ${invalid[0]}`);
  }
}
