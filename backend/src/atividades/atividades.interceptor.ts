import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { getSessionUserId } from '../auth/request-user.util';
import { PrismaService } from '../prisma/prisma.service';

const METODOS = new Set(['POST', 'PATCH', 'DELETE']);

type Requisicao = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  user?: { userId?: number; id?: number; sub?: number; login?: unknown };
};

@Injectable()
export class AtividadesInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Requisicao>();
    const metodo = String(req.method || '').toUpperCase();
    const usuarioId = getSessionUserId(req);
    if (!METODOS.has(metodo) || !usuarioId) return next.handle();

    return next.handle().pipe(
      tap(() => {
        void this.gravar(req, metodo, usuarioId).catch(() => undefined);
      }),
    );
  }

  private async gravar(req: Requisicao, metodo: string, usuarioId: number) {
    try {
      const caminho = String(req.originalUrl || req.url || '').split('?')[0].slice(0, 300);
      const idRota = req.params?.id ? String(req.params.id).slice(0, 80) : null;
      const header = req.headers?.['x-empresa-codigo'];
      const empresaCodigo = String(Array.isArray(header) ? header[0] : header || '').trim().slice(0, 40) || '-';
      const loginBruto = req.user?.login;
      const login = typeof loginBruto === 'string' ? loginBruto.trim().slice(0, 120) : '';
      const semId = caminho.replace(/\/\d+(?=\/|$)/g, '') || caminho;
      await this.prisma.atividade.create({
        data: {
          empresaCodigo,
          usuarioId,
          login,
          acao: `${metodo} ${semId}`.slice(0, 180),
          caminho,
          metodo,
          objeto: idRota,
        },
      });
    } catch {
      // A falha do registro não pode derrubar a requisição que já foi concluída.
    }
  }
}
