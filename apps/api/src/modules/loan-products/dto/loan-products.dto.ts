import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLoanProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  /** Basis points — 15% = 1500. */
  @IsInt()
  @Min(0)
  @Max(10000, { message: 'Rate cannot exceed 100%' })
  rateBps!: number;

  /** Kwacha at the API edge; stored as ngwee. */
  @IsNumber()
  @Min(1)
  minAmount!: number;

  @IsNumber()
  @Min(1)
  maxAmount!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  minTerm!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  maxTerm!: number;
}
