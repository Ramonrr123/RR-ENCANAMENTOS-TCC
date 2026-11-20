import { useEffect, useState } from 'react'

/** Campo de data com exibição dd/mm/aaaa (RNF02), valor interno yyyy-mm-dd. */
export function CampoDataBr({
  value,
  onChange,
  'aria-label': ariaLabel,
  className = '',
  disabled,
}: {
  value: string
  onChange: (iso: string) => void
  'aria-label'?: string
  className?: string
  disabled?: boolean
}) {
  const [texto, setTexto] = useState(isoParaBr(value))

  useEffect(() => {
    setTexto(isoParaBr(value))
  }, [value])

  function aoDigitar(bruto: string) {
    const soDigitos = bruto.replace(/\D/g, '').slice(0, 8)
    let mascara = soDigitos
    if (soDigitos.length > 4) mascara = `${soDigitos.slice(0, 2)}/${soDigitos.slice(2, 4)}/${soDigitos.slice(4)}`
    else if (soDigitos.length > 2) mascara = `${soDigitos.slice(0, 2)}/${soDigitos.slice(2)}`
    setTexto(mascara)
    if (!soDigitos) {
      onChange('')
      return
    }
    const iso = brParaIso(mascara)
    if (iso) onChange(iso)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      aria-label={ariaLabel}
      disabled={disabled}
      value={texto}
      onChange={(e) => aoDigitar(e.target.value)}
      className={className || 'h-10 rounded-md border bg-background px-2 text-sm'}
    />
  )
}

function isoParaBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

function brParaIso(br: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(br || '').trim())
  if (!m) return ''
  const dia = Number(m[1])
  const mes = Number(m[2])
  const ano = Number(m[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return ''
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}
