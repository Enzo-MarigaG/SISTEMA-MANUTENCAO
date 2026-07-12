import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Taxas de viagem/deslocamento da OS.
 * O total é calculado como travelKm * travelKmRate + travelHours * travelHourRate,
 * onde travelKm e travelHours são derivados dos trechos (TravelLeg). Aqui só se
 * ajustam as taxas (padrão R$ 1,50/km e R$ 100/h).
 */
export class SaveTravelDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  travelKmRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  travelHourRate?: number;
}
