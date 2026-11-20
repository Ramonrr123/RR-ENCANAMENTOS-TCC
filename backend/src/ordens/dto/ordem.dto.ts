import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const inteiroOuNulo = ({ value }: { value: unknown }) => {
  if (value === null || value === '') return null;
  if (value === undefined) return undefined;
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : value;
};

const SITUACOES_EDICAO = ['ABERTA', 'AGENDADA', 'EM_ANDAMENTO', 'EM_EXECUCAO'] as const;
const TIPOS = ['EMERGENCIA', 'PREVENTIVA', 'OBRA'] as const;
const ORIGENS = ['WHATSAPP', 'TELEFONE', 'INDICACAO'] as const;

export class MaterialLojaDto {
  @IsString()
  @MinLength(2)
  descricao!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantidadeRetirada!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantidadeUsada!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantidadeDevolvida!: number;
}

export class OrdemPecaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  produtoId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantidade!: number;
}

export class CreateOrdemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId!: number;

  @IsOptional()
  @Transform(inteiroOuNulo)
  @IsInt()
  @Min(1)
  enderecoId?: number | null;

  @IsOptional()
  @Transform(inteiroOuNulo)
  @IsInt()
  @Min(1)
  funcionarioId?: number | null;

  @IsIn(TIPOS)
  tipo!: (typeof TIPOS)[number];

  @IsIn(ORIGENS)
  origem!: (typeof ORIGENS)[number];

  @IsOptional()
  @IsString()
  descricaoProblema?: string;

  @IsOptional()
  @IsIn(SITUACOES_EDICAO)
  situacao?: (typeof SITUACOES_EDICAO)[number];

  @IsOptional()
  @IsString()
  vistoria?: string;

  @IsOptional()
  @IsString()
  servicos?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxaVistoria?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maoDeObra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deslocamento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  material?: number;

  @IsDateString()
  dataAbertura!: string;

  @IsOptional()
  @IsString()
  assinatura?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdemPecaDto)
  pecas?: OrdemPecaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialLojaDto)
  materiaisLoja?: MaterialLojaDto[];
}

export class UpdateOrdemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  @IsOptional()
  @Transform(inteiroOuNulo)
  @IsInt()
  @Min(1)
  enderecoId?: number | null;

  @IsOptional()
  @Transform(inteiroOuNulo)
  @IsInt()
  @Min(1)
  funcionarioId?: number | null;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: (typeof TIPOS)[number];

  @IsOptional()
  @IsIn(ORIGENS)
  origem?: (typeof ORIGENS)[number];

  @IsOptional()
  @IsString()
  descricaoProblema?: string;

  @IsOptional()
  @IsIn(SITUACOES_EDICAO)
  situacao?: (typeof SITUACOES_EDICAO)[number];

  @IsOptional()
  @IsString()
  vistoria?: string;

  @IsOptional()
  @IsString()
  servicos?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxaVistoria?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maoDeObra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deslocamento?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  material?: number;

  @IsOptional()
  @IsDateString()
  dataAbertura?: string;

  @IsOptional()
  @IsString()
  assinatura?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrdemPecaDto)
  pecas?: OrdemPecaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialLojaDto)
  materiaisLoja?: MaterialLojaDto[];
}

export class EncerrarOrdemDto {
  @IsString()
  @MinLength(2)
  formaPagamento!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  parcelas!: number;

  @IsDateString()
  dataVencimento!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  entradaValor?: number;

  @IsOptional()
  @IsBoolean()
  entradaRecebida?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  garantiaDias?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  preventivaMeses?: number;

  @IsOptional()
  @IsBoolean()
  usarQuintoDiaUtil?: boolean;
}

export class CancelarOrdemDto {
  @IsString()
  @MinLength(3)
  motivo!: string;
}

export class CreateFotoDto {
  @IsIn(['ANTES', 'DEPOIS'])
  momento!: 'ANTES' | 'DEPOIS';

  @IsString()
  @MinLength(1)
  url!: string;
}

export class DeleteOrdensDto {
  @IsArray()
  @IsInt({ each: true })
  ids!: number[];
}

export class AtualizarPreventivaDto {
  @IsIn(['a_contatar', 'contatado', 'agendada'])
  status!: 'a_contatar' | 'contatado' | 'agendada';
}

export type FiltroOrdens = {
  situacao?: string;
  de?: string;
  ate?: string;
  funcionarioId?: string;
  clienteId?: string;
  tipo?: string;
};
