import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthRequestUser, getSessionUserId } from '../auth/request-user.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChamadosService } from './chamados.service';
import { AtualizarChamadoDto, FotoChamadoDto, NotaChamadoDto, TarefaChamadoDto } from './dto/chamado.dto';

type Requisicao = Request & { user?: AuthRequestUser };

@Controller('chamados')
@UseGuards(JwtAuthGuard)
export class ChamadosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @Get()
  listar(@Headers('x-empresa-codigo') empresa: string, @Query('origem') origem?: string) {
    return this.chamadosService.listar(empresa, { origem });
  }

  @Get('resumo/origem-30d')
  contagemOrigem(@Headers('x-empresa-codigo') empresa: string) {
    return this.chamadosService.contagemOrigem30Dias(empresa);
  }

  @Get(':id')
  detalhe(@Headers('x-empresa-codigo') empresa: string, @Param('id', ParseIntPipe) id: number) {
    return this.chamadosService.detalhe(empresa, id);
  }

  @Patch(':id')
  atualizar(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarChamadoDto,
  ) {
    return this.chamadosService.atualizarStatus(empresa, id, dto.status);
  }

  @Post(':id/notas')
  nota(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NotaChamadoDto,
  ) {
    return this.chamadosService.adicionarNota(empresa, id, dto.texto, getSessionUserId(req));
  }

  @Post(':id/tarefas')
  tarefa(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TarefaChamadoDto,
  ) {
    return this.chamadosService.criarTarefa(empresa, id, dto, getSessionUserId(req));
  }

  @Post(':id/fotos')
  foto(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FotoChamadoDto,
  ) {
    return this.chamadosService.adicionarFoto(empresa, id, dto.situacao, dto.url);
  }

  @Post(':id/anonimizar')
  anonimizar(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chamadosService.anonimizar(empresa, id, getSessionUserId(req));
  }

  @Post(':id/ordem')
  gerarOrdem(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chamadosService.gerarOrdem(empresa, id, getSessionUserId(req));
  }
}
