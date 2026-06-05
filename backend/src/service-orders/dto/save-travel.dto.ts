import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Custos de viagem/deslocamento da OS.
 * O total é calculado como travelKm * travelKmRate + travelHours * travelHourRate.
 * As taxas têm valores padrão (R$ 1,50/km e R$ 100/h) mas podem ser ajustadas.
 */
export class SaveTravelDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  travelKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  travelHours?: number;

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
