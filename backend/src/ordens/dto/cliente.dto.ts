import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

export class EnderecoClienteDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @IsOptional()
  @IsString()
  apelido?: string;

  @IsString()
  @MinLength(1)
  logradouro!: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  uf?: string;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;
}

export class CreateClienteDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsIn(['FISICA', 'JURIDICA'])
  tipoPessoa?: 'FISICA' | 'JURIDICA';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnderecoClienteDto)
  enderecos?: EnderecoClienteDto[];
}

export class UpdateClienteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsIn(['FISICA', 'JURIDICA'])
  tipoPessoa?: 'FISICA' | 'JURIDICA';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnderecoClienteDto)
  enderecos?: EnderecoClienteDto[];
}

export class DeleteClientesDto {
  @IsArray()
  @IsInt({ each: true })
  ids!: number[];
}
