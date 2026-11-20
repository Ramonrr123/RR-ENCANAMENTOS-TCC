/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/test/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/ordens/dto/chamado-publico.dto.ts',
    'src/auth/guards/admin.guard.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  forceExit: true,
  testTimeout: 60000,
}
