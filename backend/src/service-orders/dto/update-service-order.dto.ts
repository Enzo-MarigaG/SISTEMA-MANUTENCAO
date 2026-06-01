import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateServiceOrderDto {
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsString()
  equipment?: string;

  @IsOptional()
  @IsString()
  problemReported?: string;

  @IsOptional()
  @IsString()
  serviceDone?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  estimatedDate?: string;

  @IsOptional()
  @IsDateString()
  exitDate?: string;
}
