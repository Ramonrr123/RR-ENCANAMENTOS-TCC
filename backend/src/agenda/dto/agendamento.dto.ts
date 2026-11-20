import { Type } from 'class-transformer';
import { IsDateString, IsInt } from 'class-validator';

export class AgendamentoDto {
  @Type(() => Number)
  @IsInt()
  ordemId!: number;

  @Type(() => Number)
  @IsInt()
  funcionarioId!: number;

  @IsDateString()
  inicio!: string;

  @IsDateString()
  fim!: string;
}
