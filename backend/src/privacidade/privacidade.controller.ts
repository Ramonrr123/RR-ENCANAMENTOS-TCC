import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { getSessionUserId, AuthRequestUser } from '../auth/request-user.util'
import { AnonimizarTitularDto, AtualizarSolicitacaoDto, CriarSolicitacaoDto } from './dto/privacidade.dto'
import { PrivacidadeService } from './privacidade.service'

type Requisicao = { user?: AuthRequestUser & { login?: string; username?: string } }

@Controller('privacidade')
export class PrivacidadeController {
  constructor(private readonly service: PrivacidadeService) {}

  @Get('politica')
  politica() {
    return this.service.politicaPublica()
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('alertas')
  alertas(@Headers('x-empresa-codigo') empresa: string) {
    return this.service.alertasPainel(empresa)
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('solicitacoes')
  listarSolicitacoes(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('status') status?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.service.listarSolicitacoes(empresa, { status, tipo })
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('solicitacoes')
  criarSolicitacao(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Body() dto: CriarSolicitacaoDto,
  ) {
    return this.service.criarSolicitacao(
      empresa,
      dto,
      getSessionUserId(req),
      req.user?.login || req.user?.username,
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('solicitacoes/:id')
  atualizarSolicitacao(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarSolicitacaoDto,
  ) {
    return this.service.atualizarSolicitacao(
      empresa,
      id,
      dto,
      getSessionUserId(req),
      req.user?.login || req.user?.username,
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('titular')
  buscarTitular(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('q') q?: string,
    @Query('chamadoNumero') chamadoNumero?: string,
  ) {
    return this.service.buscarTitular(
      empresa,
      q,
      chamadoNumero ? Number(chamadoNumero) : undefined,
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('titular/exportar')
  exportar(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Query('q') q?: string,
    @Query('chamadoNumero') chamadoNumero?: string,
  ) {
    const uid = getSessionUserId(req)
    if (!uid) throw new Error('Usuário obrigatório')
    return this.service.exportarTitular(
      empresa,
      uid,
      q,
      chamadoNumero ? Number(chamadoNumero) : undefined,
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('titular/:clienteId/anonimizar')
  anonimizar(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() dto: AnonimizarTitularDto,
  ) {
    return this.service.anonimizarTitular(
      empresa,
      clienteId,
      dto,
      getSessionUserId(req),
      req.user?.login || req.user?.username,
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('mapa')
  mapa() {
    return this.service.mapaDados()
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('consentimentos')
  consentimentos(@Headers('x-empresa-codigo') empresa: string) {
    return this.service.consentimentos(empresa)
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('retencao')
  retencao(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('simular') simular?: string,
  ) {
    return this.service.listarRetencaoVencidos(empresa, simular !== '0')
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('retencao/anonimizar')
  anonimizarRetencao(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
  ) {
    return this.service.anonimizarVencidos(
      empresa,
      getSessionUserId(req),
      req.user?.login || req.user?.username,
    )
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('funcionarios/:id/relatorio-desligamento')
  relatorioDesligamento(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.relatorioFuncionarioDesligado(empresa, id)
  }
}
