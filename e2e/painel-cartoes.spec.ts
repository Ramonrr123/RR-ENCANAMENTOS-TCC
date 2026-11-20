import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

function lerCaptura() {
  const texto = fs.readFileSync(path.resolve('.env.captura'), 'utf8')
  const map: Record<string, string> = {}
  for (const line of texto.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    map[t.slice(0, eq).trim()] = v
  }
  return map
}

async function entrar(page: import('@playwright/test').Page, email: string, senha: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('form', { timeout: 20000 })
  await page.getByPlaceholder(/Usuário ou E-mail/i).first().fill(email)
  await page.locator('input[type="password"]').first().fill(senha)
  await page.getByRole('button', { name: /ENTRAR|Entrar/i }).first().click()
  const escolha = page.getByText('Selecione a empresa que deseja acessar.')
  const sidebar = page.locator('[data-sidebar="sidebar"]')
  await escolha.or(sidebar).first().waitFor({ state: 'visible', timeout: 60000 })
  if (await escolha.isVisible().catch(() => false)) {
    await page.locator('button').filter({ hasText: /.+/ }).first().click()
  }
  await sidebar.first().waitFor({ state: 'visible', timeout: 30000 })
}

test.describe('painel cartão = lista', () => {
  test('garantias, preventivas, chamados e recebíveis', async ({ page }) => {
    const cred = lerCaptura()
    await entrar(page, cred.CAPTURA_ADMIN_EMAIL, cred.CAPTURA_ADMIN_SENHA)
    await page.getByText('Início', { exact: true }).first().click().catch(() => {})
    await page.waitForSelector('[data-painel-card="garantias"] [data-painel-valor]', { timeout: 20000 })

    async function comparar(cardId: string, contar: () => Promise<number>) {
      await page.getByText('Início', { exact: true }).first().click().catch(() => {})
      await page.waitForSelector(`[data-painel-card="${cardId}"] [data-painel-valor]`, { timeout: 15000 })
      await page.waitForTimeout(500)
      const nCard = Number((await page.locator(`[data-painel-card="${cardId}"] [data-painel-valor]`).innerText()).trim())
      expect(nCard).toBeGreaterThan(0)
      await page.locator(`[data-painel-card="${cardId}"]`).click()
      await page.waitForTimeout(1200)
      const nLista = await contar()
      expect(nLista).toBe(nCard)
    }

    await comparar('garantias', async () =>
      page.locator('tbody tr').filter({ hasNotText: 'Nenhuma garantia' }).filter({ hasNotText: 'Carregando' }).count(),
    )
    await comparar('prev-vencer', async () =>
      page.locator('tbody tr').filter({ hasNotText: 'Nenhuma preventiva' }).filter({ hasNotText: 'Carregando' }).count(),
    )
    await comparar('prev-vencidas', async () =>
      page.locator('tbody tr').filter({ hasNotText: 'Nenhuma preventiva' }).filter({ hasNotText: 'Carregando' }).count(),
    )
    await comparar('chamados-novos', async () => page.locator('button[aria-label="Abrir chamado"]').count())
    await comparar('receber', async () =>
      page.locator('tbody tr').filter({ hasNotText: 'Nenhum' }).filter({ hasNotText: 'Carregando' }).count(),
    )
  })
})
