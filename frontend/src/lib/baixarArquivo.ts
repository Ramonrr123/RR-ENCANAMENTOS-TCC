/** Helpers para download e links externos que funcionam melhor no celular. */

export function ehDispositivoMovel() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function ehIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Baixa um blob. No mobile tenta Web Share (salva/compartilha) e,
 * se não der, abre o arquivo para o usuário salvar manualmente.
 */
export async function baixarArquivo(blob: Blob, nome: string): Promise<'shared' | 'downloaded' | 'aborted'> {
  const tipo = blob.type || 'application/octet-stream'
  const arquivo = new File([blob], nome, { type: tipo })

  try {
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: nome })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'aborted'
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  // iOS ignora o atributo download: abre o PDF para o usuário usar Salvar/Compartilhar.
  if (ehIOS()) {
    const aberta = window.open(url, '_blank')
    if (!aberta) window.location.assign(url)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } else {
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
  }

  return 'downloaded'
}

/**
 * Abre WhatsApp/URL externa. Depois de await, window.open é bloqueado no mobile —
 * no celular navega direto (abre o app); no desktop tenta nova aba.
 */
export function abrirUrlExterna(url: string) {
  if (ehDispositivoMovel()) {
    window.location.assign(url)
    return
  }
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function compartilharArquivoComTexto(
  blob: Blob,
  nome: string,
  texto: string,
): Promise<'shared' | 'fallback' | 'aborted'> {
  const arquivo = new File([blob], nome, { type: blob.type || 'application/pdf' })
  try {
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: texto, title: nome })
      return 'shared'
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      // Sem arquivo, ainda oferece o texto (usuário anexa o PDF depois).
      await baixarArquivo(blob, nome)
      await navigator.share({ text: texto, title: nome })
      return 'shared'
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'aborted'
  }
  return 'fallback'
}
