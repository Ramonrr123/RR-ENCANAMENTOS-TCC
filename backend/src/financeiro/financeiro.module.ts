import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinanceiroController, FinanceiroFluxoController } from './financeiro.controller';
import { FinanceiroService } from './financeiro.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceiroController, FinanceiroFluxoController],
  providers: [FinanceiroService],
  exports: [FinanceiroService],
})
export class FinanceiroModule {}
