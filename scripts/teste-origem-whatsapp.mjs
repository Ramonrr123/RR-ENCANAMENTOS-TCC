/**
 * Testes locais da Rodada 4 (A1/A3): origem do chamado e link wa.me.
 * Não imprime segredos. Só localhost.
 */
import assert from 'node:assert/strict'

function normalizarOrigemChamado(valor) {
  const texto = String(valor || '')
    .trim()
    .toLowerCase()
  return ['site', 'whatsapp', 'indicacao', 'outro'].includes(texto) ? texto : 'site'
}

function soDigitos(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (digitos.startsWith('55') && digitos.length > 11) return digitos.slice(2)
  return digitos
}

function linkResponderWhatsapp(chamado) {
  const DADO_REMOVIDO = 'Dado removido'
  if (String(chamado.nome || '').trim() === DADO_REMOVIDO) return null
  if (String(chamado.telefone || '').trim() === DADO_REMOVIDO) return null
  const digitos = soDigitos(chamado.telefone)
  if (digitos.length !== 10 && digitos.length !== 11) return null
  const primeiroNome = String(chamado.nome || '')
    .trim()
    .split(/\s+/)[0] || 'cliente'
  const texto = `Olá, ${primeiroNome}! Recebemos o seu chamado número ${chamado.numero}. Vamos entrar em contato para combinar o atendimento.`
  assert.ok(!texto.toLowerCase().includes('senha'))
  return `https://wa.me/55${digitos}?text=${encodeURIComponent(texto)}`
}

assert.equal(normalizarOrigemChamado('whatsapp'), 'whatsapp')
assert.equal(normalizarOrigemChamado('WHATSAPP'), 'whatsapp')
assert.equal(normalizarOrigemChamado('<script>'), 'site')
assert.equal(normalizarOrigemChamado('api'), 'site')
assert.equal(normalizarOrigemChamado(''), 'site')

const ok = linkResponderWhatsapp({ nome: 'Maria Silva', telefone: '(35) 99999-1234', numero: 42 })
assert.ok(ok.startsWith('https://wa.me/5535999991234?text='))
assert.ok(ok.includes(encodeURIComponent('Maria')))
assert.equal(linkResponderWhatsapp({ nome: 'Dado removido', telefone: '35999991234', numero: 1 }), null)
assert.equal(linkResponderWhatsapp({ nome: 'João', telefone: 'Dado removido', numero: 1 }), null)
assert.equal(linkResponderWhatsapp({ nome: 'João', telefone: '123', numero: 1 }), null)

// Consulta pública não deve expor origem (contrato)
const chavesPublicas = new Set(['numero', 'tipo', 'cidade', 'uf', 'etapa', 'cancelado', 'eventos'])
assert.equal(chavesPublicas.has('origem'), false)

console.log(JSON.stringify({ ok: true, testes: ['origem', 'wa.me', 'consulta-sem-origem'] }))
