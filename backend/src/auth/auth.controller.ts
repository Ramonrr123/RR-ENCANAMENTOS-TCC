import { Controller, Post, Body, Get, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SessaoMeta } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { getSessionUserId } from './request-user.util';

function sessaoMeta(req: Request): SessaoMeta {
  const forwarded = req.headers['x-forwarded-for'];
  const bruto = typeof forwarded === 'string'
    ? forwarded.split(',')[0]
    : Array.isArray(forwarded)
      ? forwarded[0]
      : '';
  const ip = (bruto || req.ip || '').trim().slice(0, 64);
  const empresa = req.headers['x-empresa-codigo'];
  const empresaCodigo = typeof empresa === 'string' ? empresa.trim() : '';
  const agente = req.headers['user-agent'];
  return {
    ip,
    userAgent: (typeof agente === 'string' ? agente : '').slice(0, 300),
    empresaCodigo: empresaCodigo || null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  test() {
    return { message: 'Auth controller is working', timestamp: new Date().toISOString() };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto.email, loginDto.password, sessaoMeta(req));
  }

  @Post('heartbeat')
  @UseGuards(JwtAuthGuard)
  heartbeat(@Req() req: Request & { user?: { sid?: string | null } }) {
    const userId = getSessionUserId(req);
    if (!userId) throw new UnauthorizedException('Sessão inválida');
    return this.authService.heartbeat(userId, req.user?.sid, sessaoMeta(req));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request & { user?: { sid?: string | null } }) {
    const userId = getSessionUserId(req);
    if (!userId) throw new UnauthorizedException('Sessão inválida');
    return this.authService.encerrarPropria(userId, req.user?.sid);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listarSessoes(
    @Req() req: Request & { user?: { userId?: number; id?: number; sub?: number; sid?: string | null } },
    @Query('busca') busca?: string,
    @Query('situacao') situacao?: string,
  ) {
    const userId = getSessionUserId(req);
    if (!userId) throw new UnauthorizedException('Sessão inválida');
    return this.authService.listarSessoes(userId, busca, situacao);
  }

  @Post('sessions/encerrar')
  @UseGuards(JwtAuthGuard)
  encerrarSessoes(@Req() req: Request & { user?: { userId?: number; id?: number; sub?: number; sid?: string | null } }, @Body() body: { ids?: string[] }) {
    const userId = getSessionUserId(req);
    if (!userId) throw new UnauthorizedException('Sessão inválida');
    return this.authService.encerrarSessoes(userId, Array.isArray(body?.ids) ? body.ids : []);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: Request,
    @Body() body: { senhaAtual?: string; novaSenha?: string },
  ) {
    const userId = getSessionUserId(req as { user?: { userId?: number } });
    if (!userId) throw new UnauthorizedException('Sessão inválida');
    return this.authService.changePassword(userId, body?.senhaAtual ?? '', body?.novaSenha ?? '');
  }
}
