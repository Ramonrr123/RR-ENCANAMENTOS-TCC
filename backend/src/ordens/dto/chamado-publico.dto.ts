import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const TIPOS_CHAMADO = ['Vazamento', 'Entupimento', 'Sem água', 'Caixa d\'água', 'Aquecedor', 'Outro'] as const;
export const ORIGENS_CHAMADO = ['site', 'whatsapp', 'telefone', 'indicacao', 'outro'] as const;
export type OrigemChamado = (typeof ORIGENS_CHAMADO)[number];

export function normalizarOrigemChamado(valor: unknown): OrigemChamado {
  const texto = String(valor || '')
    .trim()
    .toLowerCase();
  return (ORIGENS_CHAMADO as readonly string[]).includes(texto) ? (texto as OrigemChamado) : 'site';
}

const SEM_HTML = /^[^<>]*$/;
const MSG_HTML = 'O texto não pode conter tags HTML.';

export class AbrirChamadoDto {
  @IsIn(TIPOS_CHAMADO)
  tipo!: (typeof TIPOS_CHAMADO)[number];

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(SEM_HTML, { message: MSG_HTML })
  nome!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20)
  @Matches(SEM_HTML, { message: MSG_HTML })
  telefone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(9)
  @Matches(SEM_HTML, { message: MSG_HTML })
  cep!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(SEM_HTML, { message: MSG_HTML })
  logradouro!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(SEM_HTML, { message: MSG_HTML })
  numero!: string;

  @IsString()
  @MaxLength(80)
  @Matches(SEM_HTML, { message: MSG_HTML })
  bairro!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(SEM_HTML, { message: MSG_HTML })
  cidade!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Matches(/^[A-Za-z]{2}$/, { message: 'Informe a UF com 2 letras.' })
  uf!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(800)
  @Matches(SEM_HTML, { message: MSG_HTML })
  descricao!: string;

  @IsBoolean({ message: 'É preciso aceitar o aviso de privacidade.' })
  @Equals(true, { message: 'É preciso aceitar o aviso de privacidade.' })
  aceite!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9_007_199_254_740_991)
  startedAt!: number;

  /** Campo escondido. Pessoa não preenche; formulário automático costuma preencher. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  /** Canal informado pela URL (?origem=). Valores fora da lista viram site no serviço. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  origem?: string;
}

export class ConsultarChamadoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  numero!: number;

  @IsString()
  @MinLength(6)
  @MaxLength(8)
  @Matches(/^[0-9A-Za-z]+$/, { message: 'Número ou senha incorretos.' })
  senha!: string;
}
