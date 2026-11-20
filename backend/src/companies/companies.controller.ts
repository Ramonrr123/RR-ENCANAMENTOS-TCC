import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.companiesService.findByUser(parseInt(userId, 10));
  }

  @Post('user/:userId/company/:companyId')
  addCompanyToUser(
    @Param('userId') userId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.companiesService.addCompanyToUser(
      parseInt(userId, 10),
      parseInt(companyId, 10),
    );
  }

  @Delete('user/:userId/company/:companyId')
  removeCompanyFromUser(
    @Param('userId') userId: string,
    @Param('companyId') companyId: string,
  ) {
    return this.companiesService.removeCompanyFromUser(
      parseInt(userId, 10),
      parseInt(companyId, 10),
    );
  }

  @Post('user/:userId/companies')
  replaceUserCompanies(
    @Param('userId') userId: string,
    @Body() body: { companyIds?: number[] },
  ) {
    return this.companiesService.replaceUserCompanies(parseInt(userId, 10), body?.companyIds || []);
  }

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.companiesService.findAll(includeInactive === 'true');
  }

  @Post()
  create(@Body() body: { codigo?: string; nome?: string; ativo?: boolean }) {
    return this.companiesService.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { codigo?: string; nome?: string; ativo?: boolean },
  ) {
    return this.companiesService.update(parseInt(id, 10), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(parseInt(id, 10));
  }
}
