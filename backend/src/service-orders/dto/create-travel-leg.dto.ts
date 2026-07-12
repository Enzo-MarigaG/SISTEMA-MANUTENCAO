import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// "HH:mm" 24h — 00:00 a 23:59
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Um trecho de viagem/deslocamento da OS.
 * Ex.: "Ida — Cidade X", saiu 07:00, chegou 09:00, 120 km.
 * A duração (horas) é derivada de arrivalTime - departureTime no serviço.
 */
export class CreateTravelLegDto {
  @IsString()
  @IsNotEmpty({ message: 'Data é obrigatória' })
  date!: string; // YYYY-MM-DD ou ISO

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
