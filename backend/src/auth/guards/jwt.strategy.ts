import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveIsAdmin } from '../admin-access.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    try {
      const user = await this.prisma.crmUsuarios.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          login: true,
          nome: true,
          isAdmin: true,
          status: true,
          grupoUsuario: { select: { name: true, label: true } },
        },
      });

      if (!user || user.status !== 'ATIVO') {
        throw new UnauthorizedException('Usuário inativo ou não encontrado');
      }

      if (payload.sid) {
        const sessao = await this.prisma.crmSessoes.findUnique({
          where: { id: String(payload.sid) },
          select: { id: true, usuarioId: true, ativo: true, expiraEm: true },
        });
        if (!sessao || !sessao.ativo || sessao.usuarioId !== user.id || sessao.expiraEm < new Date()) {
          throw new UnauthorizedException('Sessão encerrada');
        }
      }

      return {
        userId: user.id,
        login: user.login,
        nome: user.nome,
        isAdmin: resolveIsAdmin(user),
        sid: payload.sid ? String(payload.sid) : null,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('JWT validation error:', error);
      throw new UnauthorizedException('Erro ao validar token');
    }
  }
}
