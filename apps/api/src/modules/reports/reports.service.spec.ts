import { asPrisma } from '../../testing/mocks';
import { ReportsService } from './reports.service';

function summarySetup(
  grouped: unknown[] = [
    {
      status: 'active',
      _count: { _all: 3 },
      _sum: { principal: 100_000n, totalDue: 120_000n, paidAmount: 40_000n },
    },
    {
      status: 'overdue',
      _count: { _all: 1 },
      _sum: { principal: 50_000n, totalDue: 60_000n, paidAmount: 10_000n },
    },
    {
      status: 'cleared',
      _count: { _all: 2 },
      _sum: { principal: 30_000n, totalDue: 36_000n, paidAmount: 36_000n },
    },
  ],
) {
  const prisma = {
    loan: {
      groupBy: jest.fn().mockResolvedValue(grouped),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'L1',
          principal: 25_000n,
          status: 'active',
          createdAt: new Date('2026-09-10T00:00:00Z'),
          client: { firstName: 'Mwansa', lastName: 'Bwalya' },
        },
      ]),
    },
    clientLenderLink: { count: jest.fn().mockResolvedValue(7) },
    installment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 25_000n } }),
    },
    repayment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 12_000n } }),
    },
  };
  return { service: new ReportsService(asPrisma(prisma)), prisma };
}

describe('ReportsService.summary', () => {
  it('derives outstanding from active + overdue only', async () => {
    const { service } = summarySetup();

    const res = await service.summary('t1');

    // (120000-40000) + (60000-10000) = 130000 ngwee
    expect(res.outstandingMinor).toBe('130000');
    expect(res.outstanding).toBe(1300);
  });

  it('counts loans by status', async () => {
    const { service } = summarySetup();

    const res = await service.summary('t1');

    expect(res.counts).toEqual({ active: 3, overdue: 1, cleared: 2 });
  });

  it('sums disbursed across every status', async () => {
    const { service } = summarySetup();

    const res = await service.summary('t1');

    // 100000 + 50000 + 30000
    expect(res.disbursedMinor).toBe('180000');
  });

  it('reports this month from aggregates, not the whole book', async () => {
    const { service } = summarySetup();

    const res = await service.summary('t1');

    expect(res.dueThisMonthMinor).toBe('25000');
    expect(res.collectedThisMonthMinor).toBe('12000');
    expect(res.clientsCount).toBe(7);
  });

  it('maps recent loans with a display name', async () => {
    const { service } = summarySetup();

    const res = await service.summary('t1');

    expect(res.recentLoans).toEqual([
      {
        id: 'L1',
        clientName: 'Mwansa Bwalya',
        principal: 250,
        principalMinor: '25000',
        status: 'active',
        createdAt: new Date('2026-09-10T00:00:00Z'),
      },
    ]);
  });

  it('returns zeros for a brand-new tenant with no loans', async () => {
    const { service } = summarySetup([]);

    const res = await service.summary('t1');

    expect(res.counts).toEqual({ active: 0, overdue: 0, cleared: 0 });
    expect(res.outstandingMinor).toBe('0');
    expect(res.disbursedMinor).toBe('0');
  });
});

describe('ReportsService.monthly', () => {
  const monthKey = (back: number): string => {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1),
    )
      .toISOString()
      .slice(0, 7);
  };

  it('always returns six months, filling gaps with zeros', async () => {
    const thisMonth = monthKey(0);
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ month: thisMonth, total: 5_000n }])
        .mockResolvedValueOnce([{ month: thisMonth, total: 2_000n }]),
    };

    const res = await new ReportsService(asPrisma(prisma)).monthly('t1');

    expect(res).toHaveLength(6);
    expect(res.at(-1)?.month).toBe(thisMonth);
    expect(res.at(-1)?.disbursedMinor).toBe('5000');
    expect(res.at(-1)?.collectedMinor).toBe('2000');
    // No rows for five months back → explicit zero, not a missing key.
    expect(res[0]?.disbursedMinor).toBe('0');
    expect(res[0]?.collectedMinor).toBe('0');
  });

  it('places a row in the correct bucket', async () => {
    const thisMonth = monthKey(0);
    const twoAgo = monthKey(2);
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ month: twoAgo, total: 9_000n }])
        .mockResolvedValueOnce([]),
    };

    const res = await new ReportsService(asPrisma(prisma)).monthly('t1');

    const bucket = res.find((m) => m.month === twoAgo);
    expect(bucket?.disbursedMinor).toBe('9000');
    expect(res.find((m) => m.month === thisMonth)?.disbursedMinor).toBe('0');
  });
});

describe('ReportsService.loansCsv', () => {
  it('emits a header plus one row per loan, escaping quotes', async () => {
    const prisma = {
      loan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'L1',
            principal: 10_000n,
            totalDue: 12_000n,
            paidAmount: 0n,
            status: 'active',
            createdAt: new Date('2026-09-01T00:00:00Z'),
            client: { firstName: 'Mwansa', lastName: 'Bwalya' },
          },
          {
            id: 'L2',
            principal: 10_000n,
            totalDue: 12_000n,
            paidAmount: 12_000n,
            status: 'cleared',
            createdAt: new Date('2026-09-02T00:00:00Z'),
            client: { firstName: 'Grace', lastName: 'Lungu "G"' },
          },
        ]),
      },
    };

    const csv = await new ReportsService(asPrisma(prisma)).loansCsv('t1');
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      'loan_id,client,principal_kwacha,total_kwacha,paid_kwacha,outstanding_kwacha,status,created_at',
    );
    expect(lines[1]).toBe(
      'L1,"Mwansa Bwalya",100.00,120.00,0.00,120.00,active,2026-09-01T00:00:00.000Z',
    );
    // Embedded quotes are doubled, per RFC 4180.
    expect(lines[2]).toContain('"Grace Lungu ""G"""');
  });
});
