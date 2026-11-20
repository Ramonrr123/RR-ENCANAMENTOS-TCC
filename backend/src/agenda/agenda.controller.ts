import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthRequestUser, getSessionUserId, isSessionAdmin } from '../auth/request-user.util';
import { AgendaService } from './agenda.service';
import { AgendamentoDto } from './dto/agendamento.dto';

type Requisicao = Request & { user?: AuthRequestUser };

@Controller('agenda')
@UseGuards(JwtAuthGuard)
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get('painel')
  painel(@Req() req: Requisicao, @Headers('x-empresa-codigo') empresa: string) {
    return this.agenda.painel(empresa, isSessionAdmin(req), getSessionUserId(req));
  }

  @Get()
  listar(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de: string,
    @Query('ate') ate: string,
    @Query('funcionarioId') funcionarioId?: string,
  ) {
    const filtro = funcionarioId ? Number(funcionarioId) : undefined;
    return this.agenda.listar(empresa, de, ate, filtro, isSessionAdmin(req), getSessionUserId(req));
  }

  @Post()
  criar(@Headers('x-empresa-codigo') empresa: string, @Body() dto: AgendamentoDto) {
    return this.agenda.criar(empresa, dto);
  }

  @Patch(':id')
  atualizar(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AgendamentoDto,
  ) {
    return this.agenda.atualizar(empresa, id, dto);
  }

  @Delete(':id')
  remover(@Headers('x-empresa-codigo') empresa: string, @Param('id', ParseIntPipe) id: number) {
    return this.agenda.remover(empresa, id);
  }
}
