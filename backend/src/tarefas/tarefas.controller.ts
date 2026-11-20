import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTarefaDto, DeleteTarefasDto, UpdateTarefaDto } from './dto/tarefa.dto';
import { TarefasService } from './tarefas.service';

@Controller('tarefas')
@UseGuards(JwtAuthGuard)
export class TarefasController {
  constructor(private readonly tarefasService: TarefasService) {}

  @Get()
  listar(@Headers('x-empresa-codigo') empresa: string) {
    return this.tarefasService.listar(empresa);
  }

  @Post()
  criar(@Headers('x-empresa-codigo') empresa: string, @Body() dto: CreateTarefaDto) {
    return this.tarefasService.criar(empresa, dto);
  }

  @Post('delete-many')
  remover(@Headers('x-empresa-codigo') empresa: string, @Body() dto: DeleteTarefasDto) {
    return this.tarefasService.remover(empresa, dto.ids || []);
  }

  @Patch(':id')
  atualizar(
    @Headers('x-empresa-codigo') empresa: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTarefaDto,
  ) {
    return this.tarefasService.atualizar(empresa, id, dto);
  }
}
