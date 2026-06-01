import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateServiceOrderDto {
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsString()
  equipment?: string;

  @IsNotEmpty({ message: 'Problema relatado é obrigatório' })
  @IsString()
  problemReported!: string;

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

  @IsOptional()
  @IsDateString()
  estimatedDate?: string;

  @IsOptional()
  @IsDateString()
  exitDate?: string;
}
