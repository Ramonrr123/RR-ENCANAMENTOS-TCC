import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

export const TIPOS_SOLICITACAO = [
  'ACESSO',
  'CORRECAO',
  'ANONIMIZACAO',
  'ELIMINACAO',
  'INFORMACAO',
  'RETIRADA_CONSENTIMENTO',
  'OUTRO',
] as const

export const CANAIS_SOLICITACAO = ['WHATSAPP', 'SITE', 'PRESENCIAL', 'OUTRO'] as const
export const STATUS_SOLICITACAO = ['ABERTA', 'EM_ANALISE', 'ATENDIDA', 'RECUSADA'] as const

export class CriarSolicitacaoDto {
  @IsIn(TIPOS_SOLICITACAO)
  tipo!: (typeof TIPOS_SOLICITACAO)[number]

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  solicitanteNome!: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  solicitanteTelefone?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chamadoNumero?: number

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  descricao!: string

  @IsIn(CANAIS_SOLICITACAO)
  canal!: (typeof CANAIS_SOLICITACAO)[number]
}

export class AtualizarSolicitacaoDto {
  @IsOptional()
  @IsIn(STATUS_SOLICITACAO)
  status?: (typeof STATUS_SOLICITACAO)[number]

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resposta?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  responsavelId?: number
}

export class BuscarTitularDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chamadoNumero?: number
}

export class AnonimizarTitularDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  solicitacaoId?: number

  @IsString()
  @MinLength(3)
  confirmacao!: string
}
