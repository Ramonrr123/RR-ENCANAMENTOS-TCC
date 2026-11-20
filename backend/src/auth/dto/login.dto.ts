import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'Email ou login deve ser uma string' })
  @IsNotEmpty({ message: 'Email ou login é obrigatório' })
  email: string; // Aceita email ou login

  @IsString({ message: 'Senha deve ser uma string' })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres' })
  password: string;
}
