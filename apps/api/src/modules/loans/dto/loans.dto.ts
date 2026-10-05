import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export const REPAYMENT_METHODS = [
  'cash',
  'mobile_money',
  'bank',
  'in_app',
] as const;
export type RepaymentMethodName = (typeof REPAYMENT_METHODS)[number];

export class RecordRepaymentDto {
  /** Kwacha, as entered by the lender — converted to ngwee server-side. */
  @IsNumber()
  @IsPositive({ message: 'Amount must be greater than zero' })
  amount!: number;

  @IsIn([...REPAYMENT_METHODS])
  method!: RepaymentMethodName;

  /** Mobile-money / bank reference, for reconciliation. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class RolloverDto {
  /** How the extension fee was paid. */
  @IsIn([...REPAYMENT_METHODS])
  method!: RepaymentMethodName;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
