import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddWorkHourDto {
  @IsNumber()
  @Min(0.25)
  @Type(() => Number)
  hours!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hourlyRate!: number;

  @IsDateString()
  workedDate!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
