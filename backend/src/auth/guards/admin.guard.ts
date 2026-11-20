import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isSessionAdmin } from '../request-user.util';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!isSessionAdmin(req)) {
      throw new ForbiddenException('Somente o administrador pode consultar ou lançar títulos.');
    }
    return true;
  }
}
