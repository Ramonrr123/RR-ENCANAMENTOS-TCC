import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    
    // Configurar connection pooling para múltiplos usuários
    // Adicionar parâmetros de pool se não estiverem na URL
    let finalUrl = databaseUrl || '';
    if (finalUrl && !finalUrl.includes('connection_limit')) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      const limit = finalUrl.includes('pgbouncer=true') ? 1 : 20;
      finalUrl = `${finalUrl}${separator}connection_limit=${limit}&pool_timeout=10`;
    }
    
    super({
      datasources: {
        db: {
          url: finalUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    // Tentar conectar com retry logic
    let retries = 10; // Aumentar retries para dar mais tempo
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to database');
        return;
      } catch (error: any) {
        retries--;
        const dbUrl = this.configService.get<string>('DATABASE_URL');
        const host = dbUrl?.match(/@([^:]+):/)?.[1] || 'unknown';
        this.logger.warn(`Failed to connect to database at ${host}. Retries left: ${retries}`);
        
        if (retries === 0) {
          this.logger.error('Failed to connect to database after all retries');
          this.logger.error(`Current DATABASE_URL host: ${host}`);
          this.logger.error('Please check if the database service name is correct in Coolify');
          // Não lançar erro para permitir que a aplicação inicie mesmo sem banco
          // A conexão será tentada novamente quando necessário
          return;
        }
        // Aguardar 3 segundos antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
