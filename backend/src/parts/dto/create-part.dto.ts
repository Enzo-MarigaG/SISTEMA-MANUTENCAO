import { IsString, IsNumber, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartDto {
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stockQty?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minStock?: number;
}
