import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AtividadesInterceptor } from './atividades/atividades.interceptor';
import { AtividadesModule } from './atividades/atividades.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { ScreensModule } from './screens/screens.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { ProdutosModule } from './produtos/produtos.module';
import { EstoqueModule } from './estoque/estoque.module';
import { OrdensModule } from './ordens/ordens.module';
import { AgendaModule } from './agenda/agenda.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { TarefasModule } from './tarefas/tarefas.module';
import { PrivacidadeModule } from './privacidade/privacidade.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PermissionsModule,
    CompaniesModule,
    UsersModule,
    GroupsModule,
    ScreensModule,
    FinanceiroModule,
    ProdutosModule,
    EstoqueModule,
    OrdensModule,
    AgendaModule,
    AtividadesModule,
    RelatoriosModule,
    TarefasModule,
    PrivacidadeModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AtividadesInterceptor }],
})
export class AppModule {}
