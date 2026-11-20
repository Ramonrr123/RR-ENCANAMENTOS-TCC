import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ScreensService } from './screens.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('screens')
@UseGuards(JwtAuthGuard)
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Get()
  findAll() {
    return this.screensService.findAll();
  }

  @Post('sync')
  sync(@Body() screensData: any[]) {
    return this.screensService.sync(screensData);
  }
}
