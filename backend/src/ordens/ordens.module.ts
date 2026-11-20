import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChamadosController } from './chamados.controller';
import { ChamadosPublicosController } from './chamados-publicos.controller';
import { ChamadosService } from './chamados.service';
import { OrdensController } from './ordens.controller';
import { OrdensService } from './ordens.service';

@Module({
  imports: [PrismaModule, EstoqueModule],
  controllers: [OrdensController, ChamadosPublicosController, ChamadosController],
  providers: [OrdensService, ChamadosService],
})
export class OrdensModule {}
