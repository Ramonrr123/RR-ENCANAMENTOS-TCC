import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get('ordens')
  ordens(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('situacao') situacao?: string,
    @Query('format') format?: string,
  ) {
    return this.relatoriosService.ordens(empresa, { de, ate, situacao, format });
  }

  @Get('estoque')
  estoque(@Headers('x-empresa-codigo') empresa: string, @Query('format') format?: string) {
    return this.relatoriosService.estoque(empresa, format);
  }

  @Get('fluxo-caixa')
  fluxoCaixa(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de: string,
    @Query('ate') ate: string,
    @Query('format') format?: string,
  ) {
    return this.relatoriosService.fluxoCaixa(empresa, de, ate, format);
  }
}
