import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AtividadesService } from './atividades.service';

@Controller('atividades')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AtividadesController {
  constructor(private readonly atividadesService: AtividadesService) {}

  @Get()
  listar(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('acao') acao?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.atividadesService.listar(empresa, { usuarioId, acao, de, ate });
  }
}
