import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ChamadosService } from './chamados.service';
import { AbrirChamadoDto, ConsultarChamadoDto } from './dto/chamado-publico.dto';

export function ipCliente(req: Request) {
  const ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim();
  return ip.slice(0, 64) || 'desconhecido';
}

@Controller('chamados')
export class ChamadosPublicosController {
  constructor(private readonly chamadosService: ChamadosService) {}

  @Post()
  abrir(@Body() dto: AbrirChamadoDto, @Req() req: Request) {
    return this.chamadosService.abrirPublico(dto, ipCliente(req));
  }

  @Post('consulta')
  consultar(@Body() dto: ConsultarChamadoDto, @Req() req: Request) {
    return this.chamadosService.consultarPublico(dto.numero, dto.senha, ipCliente(req));
  }
}
