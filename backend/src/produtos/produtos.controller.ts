import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isSessionAdmin, type AuthRequestUser } from '../auth/request-user.util';
import { CreateProdutoDto, DeleteProdutosDto, UpdateProdutoDto } from './dto/produto.dto';
import { ProdutosService } from './produtos.service';

type RequestComUsuario = Request & { user?: AuthRequestUser };

@Controller('produtos')
@UseGuards(JwtAuthGuard)
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get()
  findAll(@Req() req: RequestComUsuario, @Headers('x-empresa-codigo') empresa: string) {
    return this.produtosService.findAll(empresa, isSessionAdmin(req));
  }

  @Post()
  create(@Req() req: RequestComUsuario, @Headers('x-empresa-codigo') empresa: string, @Body() dto: CreateProdutoDto) {
    return this.produtosService.create(empresa, dto, isSessionAdmin(req));
  }

  @Post('delete-many')
  removeMany(@Headers('x-empresa-codigo') empresa: string, @Body() dto: DeleteProdutosDto) {
    return this.produtosService.removeMany(empresa, dto.ids || []);
  }

  @Patch(':id')
  update(
    @Req() req: RequestComUsuario,
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProdutoDto,
  ) {
    return this.produtosService.update(empresa, id, dto, isSessionAdmin(req));
  }
}
