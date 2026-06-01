import { IsNumber, IsOptional, IsString, IsEnum, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class AddPaymentDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amountPaid!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
