import { IsString, IsNumber, IsOptional, IsUUID, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddOrderPartDto {
  @IsOptional()
  @IsUUID()
  partId?: string;

  @IsNotEmpty({ message: 'Nome da peça é obrigatório' })
  @IsString()
  partName!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;
}
