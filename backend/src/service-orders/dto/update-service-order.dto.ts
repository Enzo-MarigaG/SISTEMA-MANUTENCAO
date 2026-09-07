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
  equipment?: string | null;

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
  entryDate?: string;

  // estimatedDate/exitDate aceitam null para limpar a data já gravada.
  @IsOptional()
  @IsDateString()
  estimatedDate?: string | null;

  @IsOptional()
  @IsDateString()
  exitDate?: string | null;
}
