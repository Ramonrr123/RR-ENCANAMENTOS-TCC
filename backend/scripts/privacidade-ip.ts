/**
 * Anula ipOrigem antigo (chamados) e IP/userAgent de sessões após 90 dias.
 * Limpa acesso_bloqueios expirados há mais de 7 dias.
 *
 * Uso:
 *   npx ts-node scripts/privacidade-ip.ts --dry-run
 *   npx ts-node scripts/privacidade-ip.ts
 */
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { PrivacidadeService } from '../src/privacidade/privacidade.service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  const service = app.get(PrivacidadeService)
  const resultado = await service.anularIps({ dryRun })
  console.log(JSON.stringify(resultado, null, 2))
  await app.close()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
