import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTituloDto, DeleteTitulosDto, UpdateTituloDto } from './dto/titulo.dto';
import { FinanceiroService } from './financeiro.service';

@Controller('financeiro')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FinanceiroFluxoController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  @Get('devedores')
  devedores(@Headers('x-empresa-codigo') empresa: string) {
    return this.financeiroService.devedores(empresa);
  }

  @Get('fluxo-caixa')
  fluxoCaixa(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de: string,
    @Query('ate') ate: string,
  ) {
    return this.financeiroService.fluxoCaixa(empresa, de, ate);
  }

  @Get('controle-recebimentos')
  controleRecebimentos(
    @Headers('x-empresa-codigo') empresa: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('situacao') situacao?: string,
  ) {
    return this.financeiroService.controleRecebimentos(empresa, { de, ate, situacao });
  }
}

@Controller('financeiro/titulos')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FinanceiroController {
  constructor(private readonly financeiroService: FinanceiroService) {}

  @Get()
  findAll(@Headers('x-empresa-codigo') empresa: string, @Query('tipo') tipo: string) {
    return this.financeiroService.findAll(empresa, tipo);
  }

  @Post()
  create(@Headers('x-empresa-codigo') empresa: string, @Body() dto: CreateTituloDto) {
    return this.financeiroService.create(empresa, dto);
  }

  @Post('delete-many')
  removeMany(@Headers('x-empresa-codigo') empresa: string, @Body() dto: DeleteTitulosDto) {
    return this.financeiroService.removeMany(empresa, dto.ids || []);
  }

  @Patch(':id')
  update(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTituloDto,
  ) {
    return this.financeiroService.update(empresa, id, dto);
  }
}
