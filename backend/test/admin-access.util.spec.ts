import { isAdministradoresGroup, resolveIsAdmin } from '../src/auth/admin-access.util'

describe('admin-access.util', () => {
  it('reconhece grupo Administradores por name e label', () => {
    expect(isAdministradoresGroup({ name: 'administradores', label: 'Administradores' })).toBe(true)
    expect(isAdministradoresGroup({ name: 'Administradores', label: 'x' })).toBe(true)
    expect(isAdministradoresGroup({ name: 'x', label: 'Administradores' })).toBe(true)
    expect(isAdministradoresGroup({ name: 'funcionarios', label: 'Funcionários' })).toBe(false)
  })

  it('resolve isAdmin pela flag ou pelo grupo', () => {
    expect(resolveIsAdmin({ isAdmin: true })).toBe(true)
    expect(resolveIsAdmin({ isAdmin: false, grupoUsuario: { name: 'administradores', label: 'Administradores' } })).toBe(true)
    expect(resolveIsAdmin({ isAdmin: false, grupoUsuario: { name: 'funcionarios', label: 'Funcionários' } })).toBe(false)
  })
})
