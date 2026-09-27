export {
  kwachaToMinor,
  minorToKwacha,
  minorToKwachaString,
  formatMinor,
  bpsOf,
} from './money';
export type { Ngwee } from './money';

export {
  buildSchedule,
  totalDueMinor,
  addMonthsUtc,
  addFrequency,
  firstDueDateFrom,
} from './loans/schedule';
export type {
  Schedule,
  ScheduleInput,
  ScheduleInstallment,
  Frequency,
  Structure,
} from './loans/schedule';

export {
  businessNow,
  businessDate,
  startOfBusinessDay,
  endOfBusinessDay,
  startOfBusinessMonth,
  startOfNextBusinessMonth,
  startOfBusinessMonthsAgo,
  businessMonthBounds,
  businessMonthLabels,
  daysBetween,
  BUSINESS_TIME_ZONE,
  BUSINESS_UTC_OFFSET_MINUTES,
} from './time/clock';

export { allocateRepayment } from './loans/allocation';
export type {
  AllocationChange,
  AllocationResult,
  AllocatableInstallment,
  InstallmentState,
} from './loans/allocation';

export { originationFee } from './loans/fees';
export type { FeePlan, FeeTreatment } from './loans/fees';

export {
  dailyPenalty,
  penaltyCap,
  nextPenalty,
} from './loans/penalties';
export type { PenaltyTerms } from './loans/penalties';

export { rolloverPlan, rolloverBulletPlan } from './loans/rollover';
export type {
  RolloverPlan,
  RolloverInput,
  RolloverInstallment,
  BulletRolloverPlan,
} from './loans/rollover';

export { resolveCreditLimit, DEFAULT_CREDIT_POLICY } from './policy';
export type {
  BorrowerStats,
  CreditPolicy,
  CreditPolicyRules,
  CreditResolution,
  CreditTier,
  LimitOverride,
} from './policy';

export {
  internalScore,
  bandFromScore,
  creditLimitKwacha,
  SCORE_MIN,
  SCORE_MAX,
} from './risk/score';
export type { RepaymentHistory, RiskBand } from './risk/score';

export {
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  SYSTEM_ROLES,
} from './permissions';
export type { PermissionKey } from './permissions';
