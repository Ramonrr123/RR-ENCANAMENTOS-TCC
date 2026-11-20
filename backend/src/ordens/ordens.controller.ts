import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthRequestUser, isSessionAdmin } from '../auth/request-user.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateClienteDto, DeleteClientesDto, UpdateClienteDto } from './dto/cliente.dto';
import { AtualizarPreventivaDto, CancelarOrdemDto, CreateFotoDto, CreateOrdemDto, DeleteOrdensDto, EncerrarOrdemDto, UpdateOrdemDto } from './dto/ordem.dto';
import { OrdensService } from './ordens.service';

type Requisicao = Request & { user?: AuthRequestUser };

@Controller('ordens')
@UseGuards(JwtAuthGuard)
export class OrdensController {
  constructor(private readonly ordensService: OrdensService) {}

  @Get('clientes')
  findClientes(@Headers('x-empresa-codigo') empresa: string) {
    return this.ordensService.findClientes(empresa);
  }

  @Post('clientes')
  createCliente(@Headers('x-empresa-codigo') empresa: string, @Body() dto: CreateClienteDto) {
    return this.ordensService.createCliente(empresa, dto);
  }

  @Post('clientes/delete-many')
  removeClientes(@Headers('x-empresa-codigo') empresa: string, @Body() dto: DeleteClientesDto) {
    return this.ordensService.removeClientes(empresa, dto.ids || []);
  }

  @Get('clientes/:id/historico')
  historicoCliente(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('enderecoId') enderecoId?: string,
  ) {
    return this.ordensService.historicoCliente(empresa, id, enderecoId, isSessionAdmin(req));
  }

  @Patch('clientes/:id')
  updateCliente(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClienteDto,
  ) {
    return this.ordensService.updateCliente(empresa, id, dto);
  }

  @Get('funcionarios')
  findFuncionarios(@Headers('x-empresa-codigo') empresa: string) {
    return this.ordensService.findFuncionarios(empresa);
  }

  @Get()
  findAll(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Query('situacao') situacao?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('funcionarioId') funcionarioId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.ordensService.findAll(empresa, isSessionAdmin(req), { situacao, de, ate, funcionarioId, clienteId, tipo });
  }

  @Post()
  create(@Req() req: Requisicao, @Headers('x-empresa-codigo') empresa: string, @Body() dto: CreateOrdemDto) {
    return this.ordensService.create(empresa, dto, isSessionAdmin(req));
  }

  @Post('delete-many')
  removeMany(@Headers('x-empresa-codigo') empresa: string, @Body() dto: DeleteOrdensDto) {
    return this.ordensService.removeMany(empresa, dto.ids || []);
  }

  @Get('garantia')
  garantia(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('enderecoId') enderecoId?: string,
    @Query('chamadoId') chamadoId?: string,
    @Query('logradouro') logradouro?: string,
    @Query('numero') numero?: string,
    @Query('cidade') cidade?: string,
    @Query('excetoId') excetoId?: string,
  ) {
    return this.ordensService.garantiaVigente(empresa, { enderecoId, chamadoId, logradouro, numero, cidade, excetoId });
  }

  @Get('preventivas')
  preventivas(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('q') q?: string,
  ) {
    return this.ordensService.listarPreventivas(empresa, isSessionAdmin(req), { de, ate, q });
  }

  @Get('garantias')
  garantias(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('q') q?: string,
    @Query('vencidas') vencidas?: string,
  ) {
    return this.ordensService.listarGarantias(empresa, isSessionAdmin(req), {
      de,
      ate,
      q,
      vencidas: vencidas === '1' || vencidas === 'true',
    });
  }

  @Patch('preventivas/:id')
  atualizarPreventiva(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarPreventivaDto,
  ) {
    return this.ordensService.atualizarPreventivaStatus(empresa, id, dto.status, isSessionAdmin(req));
  }

  @Get(':id')
  findOne(@Req() req: Requisicao, @Headers('x-empresa-codigo') empresa: string, @Param('id', ParseIntPipe) id: number) {
    return this.ordensService.findOne(empresa, id, isSessionAdmin(req));
  }

  @Patch(':id')
  update(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrdemDto,
  ) {
    return this.ordensService.update(empresa, id, dto, isSessionAdmin(req));
  }

  @Post(':id/concluir')
  concluir(@Req() req: Requisicao, @Headers('x-empresa-codigo') empresa: string, @Param('id', ParseIntPipe) id: number) {
    return this.ordensService.concluir(empresa, id, isSessionAdmin(req));
  }

  @Post(':id/cancelar')
  cancelar(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarOrdemDto,
  ) {
    return this.ordensService.cancelar(empresa, id, dto, isSessionAdmin(req));
  }

  @Post(':id/fotos')
  adicionarFoto(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateFotoDto,
  ) {
    return this.ordensService.adicionarFoto(empresa, id, dto, isSessionAdmin(req));
  }

  @Post(':id/encerrar')
  encerrar(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncerrarOrdemDto,
  ) {
    return this.ordensService.encerrar(empresa, id, dto, isSessionAdmin(req));
  }
}
