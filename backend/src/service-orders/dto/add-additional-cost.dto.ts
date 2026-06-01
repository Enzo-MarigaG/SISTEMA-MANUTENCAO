import { IsString, IsNumber, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddAdditionalCostDto {
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount!: number;
}
