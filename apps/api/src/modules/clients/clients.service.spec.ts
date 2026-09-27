import {
  evaluateRegistrationGate,
  missingRegistrationFields,
  REGISTRATION_FIELDS,
  type RegistrationField,
} from './clients.service';

const completeProfile = {
  email: 'borrower@example.com',
  employmentStatus: 'self_employed',
  incomeSource: 'Market stall at Soweto',
  educationLevel: 'degree',
  incomeBand: 'b1001_3000',
  kinName: 'Jane Tester',
  kinPhone: '0965550001',
};

describe('missingRegistrationFields', () => {
  it('is empty once every required field is on file', () => {
    expect(missingRegistrationFields(completeProfile)).toEqual([]);
  });

  it('names each field the borrower has not provided', () => {
    expect(
      missingRegistrationFields({ ...completeProfile, kinName: null }),
    ).toEqual(['kinName']);
  });

  it('treats a whitespace-only value as missing', () => {
    expect(
      missingRegistrationFields({ ...completeProfile, email: '   ' }),
    ).toEqual(['email']);
  });

  it('requires a sector from a formally employed borrower', () => {
    expect(
      missingRegistrationFields({
        ...completeProfile,
        employmentStatus: 'formal_employment',
        incomeSource: null,
      }),
    ).toEqual(['incomeSource']);
  });

  it('does not require a sector from anyone else', () => {
    expect(
      missingRegistrationFields({
        ...completeProfile,
        employmentStatus: 'farming',
        incomeSource: null,
      }),
    ).toEqual([]);
  });

  it('returns fields in the order the stepper asks for them', () => {
    const blank: Record<(typeof REGISTRATION_FIELDS)[number], string | null> =
      Object.fromEntries(REGISTRATION_FIELDS.map((f) => [f, null])) as Record<
        (typeof REGISTRATION_FIELDS)[number],
        string | null
      >;
    // A blank employment status means the sector is not yet applicable, so it
    // must not be reported alongside it.
    expect(missingRegistrationFields(blank)).toEqual([
      'email',
      'employmentStatus',
      'educationLevel',
      'incomeBand',
      'kinName',
      'kinPhone',
    ]);
  });
});

describe('evaluateRegistrationGate', () => {
  it('lets a fully registered borrower straight into the app', () => {
    const gate = evaluateRegistrationGate([], []);
    expect(gate.action).toBe('complete');
    expect(gate.openLoanCount).toBe(0);
  });

  it('binds a borrower with missing fields and no debt to the stepper', () => {
    const gate = evaluateRegistrationGate(['kinPhone'], []);
    expect(gate.action).toBe('complete_registration');
    expect(gate.missing).toEqual(['kinPhone']);
  });

  it('lets a borrower with an unpaid loan clear it before the stepper binds', () => {
    const gate = evaluateRegistrationGate(['kinPhone'], [800n]);
    expect(gate.action).toBe('clear_loan_then_register');
    expect(gate.openLoanCount).toBe(1);
    expect(gate.openTotalOutstanding).toBe(800n);
  });

  it('never withholds the app from a registered borrower in debt', () => {
    const gate = evaluateRegistrationGate([], [5000n]);
    expect(gate.action).toBe('complete');
    expect(gate.openTotalOutstanding).toBe(5000n);
  });

  it('sums every open loan', () => {
    const gate = evaluateRegistrationGate(['email'], [300n, 200n]);
    expect(gate.openLoanCount).toBe(2);
    expect(gate.openTotalOutstanding).toBe(500n);
  });

  it('copies the missing list so callers cannot mutate the input', () => {
    const missing: RegistrationField[] = ['email'];
    const gate = evaluateRegistrationGate(missing, []);
    expect(gate.missing).not.toBe(missing);
  });
});
