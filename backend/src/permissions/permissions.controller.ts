import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  private assertAdmin(req: Request) {
    const user = (req as Request & { user?: { isAdmin?: boolean } }).user;
    if (!user?.isAdmin) {
      throw new HttpException(
        'Somente administradores podem alterar permissões.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMine(@Req() req: Request) {
    const userId = (req as Request & { user?: { userId?: number } }).user?.userId;
    if (!userId) {
      throw new HttpException('Sessão inválida', HttpStatus.UNAUTHORIZED);
    }
    try {
      return await this.permissionsService.listEffectiveForUser(userId);
    } catch (error) {
      console.error('Erro ao buscar permissões do usuário logado:', error);
      throw new HttpException(
        `Erro ao buscar permissões: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('group/:groupId')
  async findByGroup(@Param('groupId') groupId: string) {
    try {
      const permissions = await this.permissionsService.findByGroup(groupId);
      return permissions;
    } catch (error) {
      console.error('Erro ao buscar permissões do grupo:', error);
      throw new HttpException(
        `Erro ao buscar permissões: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    try {
      const id = Number(userId);
      if (!Number.isFinite(id)) {
        throw new HttpException('userId inválido', HttpStatus.BAD_REQUEST);
      }
      return await this.permissionsService.findByUser(id);
    } catch (error) {
      console.error('Erro ao buscar permissões do usuário:', error);
      throw new HttpException(
        `Erro ao buscar permissões: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('user')
  async updateUser(
    @Req() req: Request,
    @Body() body: { usuarioId?: number; userId?: number; permissions?: Record<string, boolean> },
  ) {
    this.assertAdmin(req);
    try {
      const usuarioId = body.usuarioId ?? body.userId;
      if (!usuarioId) {
        throw new HttpException('usuarioId é obrigatório', HttpStatus.BAD_REQUEST);
      }
      return await this.permissionsService.updateUser(
        usuarioId,
        body.permissions ?? {},
      );
    } catch (error) {
      console.error('Erro ao atualizar permissões do usuário:', error);
      throw new HttpException(
        `Erro ao atualizar permissões: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async update(@Req() req: Request, @Body() updatePermissionsDto: any) {
    this.assertAdmin(req);
    try {
      if (!updatePermissionsDto.userGroupId) {
        throw new HttpException('userGroupId é obrigatório', HttpStatus.BAD_REQUEST);
      }

      const result = await this.permissionsService.update(updatePermissionsDto);
      return result;
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      throw new HttpException(
        `Erro ao atualizar permissões: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
