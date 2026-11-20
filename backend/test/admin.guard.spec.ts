import { ForbiddenException } from '@nestjs/common'
import { AdminGuard } from '../src/auth/guards/admin.guard'

describe('permissions / AdminGuard', () => {
  const guard = new AdminGuard()

  function ctx(user: unknown) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any
  }

  it('permite administrador', () => {
    expect(guard.canActivate(ctx({ isAdmin: true }))).toBe(true)
  })

  it('bloqueia funcionário', () => {
    expect(() => guard.canActivate(ctx({ isAdmin: false }))).toThrow(ForbiddenException)
  })
})
