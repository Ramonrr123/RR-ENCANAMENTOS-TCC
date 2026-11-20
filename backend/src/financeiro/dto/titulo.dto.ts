import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTituloDto {
  @IsIn(['PAGAR', 'RECEBER'])
  tipo!: 'PAGAR' | 'RECEBER';

  @IsString()
  @MinLength(2)
  pessoa!: string;

  @IsString()
  @MinLength(2)
  tipoDocumento!: string;

  @IsString()
  @MinLength(2)
  planoContas!: string;

  @IsString()
  @MinLength(2)
  formaPagamento!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor!: number;

  @IsDateString()
  dataVencimento!: string;

  @IsOptional()
  @IsString()
  numeroDocumento?: string;

  @IsOptional()
  @IsDateString()
  dataEmissao?: string;

  @IsOptional()
  @IsDateString()
  dataCompetencia?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  parcelas?: number;

  @IsOptional()
  @IsString()
  contaBancaria?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  desconto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  juros?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  multa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorBaixado?: number;

  @IsOptional()
  @IsDateString()
  dataBaixa?: string;

  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsIn(['ABERTO', 'PAGO_PARCIAL', 'PAGO', 'CANCELADO'])
  status?: 'ABERTO' | 'PAGO_PARCIAL' | 'PAGO' | 'CANCELADO';
}

export class UpdateTituloDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  pessoa?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  tipoDocumento?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  planoContas?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  formaPagamento?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor?: number;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  numeroDocumento?: string;

  @IsOptional()
  @IsDateString()
  dataEmissao?: string;

  @IsOptional()
  @IsDateString()
  dataCompetencia?: string;

  @IsOptional()
  @IsString()
  parcela?: string;

  @IsOptional()
  @IsString()
  contaBancaria?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  desconto?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  juros?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  multa?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorBaixado?: number;

  @IsOptional()
  @IsDateString()
  dataBaixa?: string;

  @IsOptional()
  @IsString()
  codigoBarras?: string;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsIn(['ABERTO', 'PAGO_PARCIAL', 'PAGO', 'CANCELADO'])
  status?: 'ABERTO' | 'PAGO_PARCIAL' | 'PAGO' | 'CANCELADO';
}

export class DeleteTitulosDto {
  @IsArray()
  @IsInt({ each: true })
  ids!: number[];
}
