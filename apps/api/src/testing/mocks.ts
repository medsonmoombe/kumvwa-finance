import type { PrismaService } from '../infra/prisma.module';
import type { AuditService } from '../modules/audit/audit.service';
import type { NotificationsService } from '../modules/notifications/notifications.service';
import type { NrcCryptoService } from '../common/crypto/nrc-crypto.service';
import type { FilesService } from '../modules/files/files.service';

/**
 * Service unit tests inject hand-rolled stubs instead of a real Prisma client,
 * so the business logic runs with no database. The casts live here to keep the
 * `as unknown as` noise out of every spec.
 */
export function asPrisma(stub: Record<string, unknown>): PrismaService {
  return stub as unknown as PrismaService;
}

export function asAudit(stub: Record<string, unknown>): AuditService {
  return stub as unknown as AuditService;
}

export function asNotify(stub: Record<string, unknown>): NotificationsService {
  return stub as unknown as NotificationsService;
}

export function asNrc(stub: Record<string, unknown>): NrcCryptoService {
  return stub as unknown as NrcCryptoService;
}

export function asFiles(stub: Record<string, unknown>): FilesService {
  return stub as unknown as FilesService;
}

export function auditMock() {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

export function notifyMock() {
  return { create: jest.fn().mockResolvedValue(undefined) };
}

/** Presigned GET is deterministic so branding assertions can name the URL. */
export function filesMock() {
  return {
    presignGet: jest
      .fn()
      .mockImplementation((key: string) =>
        Promise.resolve(`https://storage.test/${key}`),
      ),
  };
}

/** Deterministic crypto so assertions can name the output. */
export function nrcMock() {
  return {
    encrypt: jest.fn((v: string) => `enc(${v})`),
    decrypt: jest.fn((v: string) => v.replace(/^enc\(/, '').replace(/\)$/, '')),
    hash: jest.fn((v: string) => `hash(${v})`),
  };
}

/**
 * jest.Mock's `calls` is `any[][]`, which trips the type-aware lint rules on
 * every assertion. Reading through these helpers narrows to `unknown` first, so
 * specs stay rule-clean without sprinkling `as any` around.
 */
interface CallCapturingMock {
  mock: { calls: unknown[] };
}

/** Argument `argIndex` of call `callIndex`, typed by the caller. */
export function callArg<T = unknown>(
  m: CallCapturingMock,
  callIndex = 0,
  argIndex = 0,
): T | undefined {
  const call = m.mock.calls[callIndex] as unknown[] | undefined;
  return call?.[argIndex] as T | undefined;
}

/** The `data` payload of a Prisma-style write call, e.g. `update({ data })`. */
export function callData(
  m: CallCapturingMock,
  callIndex = 0,
): Record<string, unknown> {
  const body = callArg<{ data?: Record<string, unknown> }>(m, callIndex, 0);
  return body?.data ?? {};
}
