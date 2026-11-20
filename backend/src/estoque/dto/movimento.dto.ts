import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class TransferirEstoqueDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  produtoId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  deLocalId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  paraLocalId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantidade!: number;

  @IsString()
  @MinLength(2)
  motivo!: string;
}

export class AjusteEstoqueDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  produtoId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  localId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantidadeContada!: number;

  @IsString()
  @MinLength(2)
  motivo!: string;
}

export class CreateMovimentoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  produtoId!: number;

  @IsIn(['ENTRADA', 'SAIDA'])
  tipo!: 'ENTRADA' | 'SAIDA';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantidade!: number;

  @IsDateString()
  data!: string;

  @IsString()
  @MinLength(2)
  motivo!: string;

  @IsOptional()
  @IsIn(['VEICULO', 'DEPOSITO'])
  localCodigo?: 'VEICULO' | 'DEPOSITO';

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class UpdateMovimentoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  produtoId?: number;

  @IsOptional()
  @IsIn(['ENTRADA', 'SAIDA'])
  tipo?: 'ENTRADA' | 'SAIDA';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantidade?: number;

  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  motivo?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class DeleteMovimentosDto {
  @IsArray()
  @IsInt({ each: true })
  ids!: number[];
}
