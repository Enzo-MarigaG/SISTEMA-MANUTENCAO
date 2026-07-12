import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Edição de um trecho de viagem. O modal envia o trecho completo, então os
 * campos seguem obrigatórios (espelha o padrão de UpdateOrderPartDto).
 */
export class UpdateTravelLegDto {
  @IsString()
  @IsNotEmpty({ message: 'Data é obrigatória' })
  date!: string;

  @Matches(TIME_REGEX, { message: 'Hora de saída inválida (use HH:mm)' })
  departureTime!: string;

  @Matches(TIME_REGEX, { message: 'Hora de chegada inválida (use HH:mm)' })
  arrivalTime!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  km!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
