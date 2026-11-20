import 'reflect-metadata'
import { normalizarOrigemChamado, ORIGENS_CHAMADO } from '../src/ordens/dto/chamado-publico.dto'

describe('ordens / origem do chamado', () => {
  it('aceita as 5 origens oficiais', () => {
    expect(ORIGENS_CHAMADO).toEqual(['site', 'whatsapp', 'telefone', 'indicacao', 'outro'])
    for (const origem of ORIGENS_CHAMADO) {
      expect(normalizarOrigemChamado(origem)).toBe(origem)
    }
  })

  it('normaliza caixa e espaços', () => {
    expect(normalizarOrigemChamado(' WhatsApp ')).toBe('whatsapp')
    expect(normalizarOrigemChamado('TELEFONE')).toBe('telefone')
  })

  it('valor inválido vira site', () => {
    expect(normalizarOrigemChamado('<script>')).toBe('site')
    expect(normalizarOrigemChamado('')).toBe('site')
    expect(normalizarOrigemChamado(null)).toBe('site')
  })
})

describe('ordens / garantia +90 dias', () => {
  function garantiaAte(encerramento: Date) {
    const d = new Date(Date.UTC(encerramento.getUTCFullYear(), encerramento.getUTCMonth(), encerramento.getUTCDate()))
    d.setUTCDate(d.getUTCDate() + 90)
    return d
  }

  it('OS 0007: encerramento 13/10/2026 => garantia 11/01/2027', () => {
    const enc = new Date(Date.UTC(2026, 9, 13))
    const g = garantiaAte(enc)
    expect(g.toISOString().slice(0, 10)).toBe('2027-01-11')
  })
})
