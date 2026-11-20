import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

const PRIORIDADES = ['baixa', 'media', 'alta'] as const;
const STATUS = ['pendente', 'andamento', 'concluida'] as const;

export class CreateTarefaDto {
  @IsString()
  @MinLength(2)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @IsIn(PRIORIDADES)
  prioridade!: (typeof PRIORIDADES)[number];

  @IsIn(STATUS)
  status!: (typeof STATUS)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  responsaveis!: string[];
}

export class UpdateTarefaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string | null;

  @IsOptional()
  @IsIn(PRIORIDADES)
  prioridade?: (typeof PRIORIDADES)[number];

  @IsOptional()
  @IsIn(STATUS)
  status?: (typeof STATUS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  responsaveis?: string[];
}

export class DeleteTarefasDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
