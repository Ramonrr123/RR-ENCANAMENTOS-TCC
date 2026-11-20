import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthRequestUser, getSessionUserId } from '../auth/request-user.util';
import { AjusteEstoqueDto, CreateMovimentoDto, DeleteMovimentosDto, TransferirEstoqueDto, UpdateMovimentoDto } from './dto/movimento.dto';
import { EstoqueService } from './estoque.service';

type Requisicao = Request & { user?: AuthRequestUser };

@Controller('estoque/movimentos')
@UseGuards(JwtAuthGuard)
export class EstoqueController {
  constructor(private readonly estoqueService: EstoqueService) {}

  @Get()
  findAll(@Headers('x-empresa-codigo') empresa: string) {
    return this.estoqueService.findAll(empresa);
  }

  @Get('saldos')
  saldos(@Headers('x-empresa-codigo') empresa: string, @Query('local') local?: string) {
    return this.estoqueService.saldos(empresa, local);
  }

  @Get('alertas')
  alertas(@Headers('x-empresa-codigo') empresa: string) {
    return this.estoqueService.alertas(empresa);
  }

  @Post()
  create(@Req() req: Requisicao, @Headers('x-empresa-codigo') empresa: string, @Body() dto: CreateMovimentoDto) {
    return this.estoqueService.create(empresa, dto, getSessionUserId(req));
  }

  @Post('transferir')
  transferir(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Body() dto: TransferirEstoqueDto,
  ) {
    return this.estoqueService.transferir(empresa, dto, getSessionUserId(req));
  }

  @Post('ajuste')
  ajuste(
    @Req() req: Requisicao,
    @Headers('x-empresa-codigo') empresa: string,
    @Body() dto: AjusteEstoqueDto,
  ) {
    return this.estoqueService.ajuste(empresa, dto, getSessionUserId(req));
  }

  @Post('delete-many')
  removeMany(@Headers('x-empresa-codigo') empresa: string, @Body() dto: DeleteMovimentosDto) {
    return this.estoqueService.removeMany(empresa, dto.ids || []);
  }

  @Patch(':id')
  update(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovimentoDto,
  ) {
    return this.estoqueService.update(empresa, id, dto);
  }
}
