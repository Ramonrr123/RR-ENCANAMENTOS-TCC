import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const STATUS_CHAMADO = ['ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO'] as const;
export const PRIORIDADES_TAREFA = ['baixa', 'media', 'alta'] as const;
export const STATUS_TAREFA = ['pendente', 'andamento', 'concluida'] as const;
export const SITUACOES_FOTO = [
  'Chegada',
  'Vazamento',
  'Entupimento',
  'Sem água',
  'Caixa d\'água',
  'Aquecedor',
  'Durante o reparo',
  'Peça trocada',
  'Depois do reparo',
  'Conclusão',
] as const;

export class AtualizarChamadoDto {
  @IsIn(STATUS_CHAMADO)
  status!: (typeof STATUS_CHAMADO)[number];
}

export class NotaChamadoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(800)
  texto!: string;
}

export class TarefaChamadoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  descricao?: string;

  @IsArray()
  @IsString({ each: true })
  responsaveis!: string[];

  @IsDateString()
  prazo!: string;

  @IsIn(PRIORIDADES_TAREFA)
  prioridade!: (typeof PRIORIDADES_TAREFA)[number];

  @IsIn(STATUS_TAREFA)
  status!: (typeof STATUS_TAREFA)[number];
}

export class FotoChamadoDto {
  @IsIn(SITUACOES_FOTO)
  situacao!: (typeof SITUACOES_FOTO)[number];

  @IsString()
  @MinLength(20)
  @MaxLength(2_000_000)
  url!: string;
}

