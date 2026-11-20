import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getSessionUserId } from '../auth/request-user.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Query() query?: any) {
    const queryString = new URLSearchParams(query).toString();
    const result = await this.usersService.findAll(queryString);
    return result && typeof result === 'object' && 'data' in result
      ? result
      : { data: [], total: 0, hasMore: false, skip: 0, take: 16 };
  }

  @Get('me')
  async findMe(@Request() req: any) {
    const userId = getSessionUserId(req);
    if (!userId) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.usersService.findMe(userId);
  }

  @Get('preferences')
  async getPreferences(@Request() req: any) {
    const userId = getSessionUserId(req);
    if (!userId) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.usersService.getPreferences(userId);
  }

  @Get('me/pdf-sections-prefs')
  async getPdfSectionsPrefs(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }
    return await this.usersService.getPdfSectionsPrefs(Number(userId));
  }

  @Put('me/pdf-sections-prefs')
  async savePdfSectionsPrefs(@Request() req: any, @Body() body: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }
    return await this.usersService.savePdfSectionsPrefs(Number(userId), body);
  }

  @Delete('me/pdf-sections-prefs')
  async resetPdfSectionsPrefs(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }
    return await this.usersService.resetPdfSectionsPrefs(Number(userId));
  }

  @Get('me/email-contacts')
  listEmailContacts(@Request() req: any) {
    const userId = getSessionUserId(req) ?? req.user?.userId ?? req.user?.sub ?? req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.usersService.listEmailContacts(Number(userId));
  }

  @Post('me/email-contacts')
  createEmailContact(@Request() req: any, @Body() body: { email?: string; tag?: string }) {
    const userId = getSessionUserId(req) ?? req.user?.userId ?? req.user?.sub ?? req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.usersService.createEmailContact(Number(userId), body || {});
  }

  @Patch('me/email-contacts/:contactId')
  updateEmailContact(
    @Request() req: any,
    @Param('contactId') contactId: string,
    @Body() body: { email?: string; tag?: string },
  ) {
    const userId = getSessionUserId(req) ?? req.user?.userId ?? req.user?.sub ?? req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.usersService.updateEmailContact(Number(userId), parseInt(contactId, 10), body || {});
  }

  @Delete('me/email-contacts/:contactId')
  deleteEmailContact(@Request() req: any, @Param('contactId') contactId: string) {
    const userId = getSessionUserId(req) ?? req.user?.userId ?? req.user?.sub ?? req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.usersService.deleteEmailContact(Number(userId), parseInt(contactId, 10));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(parseInt(id, 10));
  }

  @Post()
  create(@Request() req: any, @Body() createUserDto: any) {
    return this.usersService.create(createUserDto, getSessionUserId(req));
  }

  @Patch('me')
  updateMe(@Request() req: any, @Body() updateUserDto: any) {
    const userId = getSessionUserId(req) ?? req.user?.userId ?? req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new Error('Usuário não autenticado');
    }
    return this.usersService.update(Number(userId), updateUserDto, Number(userId));
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() updateUserDto: any) {
    return this.usersService.update(
      parseInt(id, 10),
      updateUserDto,
      getSessionUserId(req),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(parseInt(id, 10));
  }

  @Post('delete-many')
  deleteMany(@Body() body: { ids: number[] }) {
    return this.usersService.deleteMany(body.ids);
  }
}
