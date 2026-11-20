import { useEffect, useRef } from 'react'

interface UseIdleOptions {
  timeout?: number // Tempo em milissegundos de inatividade (padrão: 2 minutos)
  events?: string[] // Eventos a serem monitorados
  onIdle?: () => void // Callback quando ficar inativo
  onActive?: () => void // Callback quando voltar a ficar ativo
  shouldReset?: () => boolean // Função para verificar se deve resetar o timer quando houver atividade
}

export function useIdle({
  timeout = 2 * 60 * 1000, // 2 minutos por padrão
  events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'],
  onIdle,
  onActive,
  shouldReset = () => true, // Por padrão, sempre reseta
}: UseIdleOptions = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isIdleRef = useRef(false)
  const onIdleRef = useRef(onIdle)
  const onActiveRef = useRef(onActive)
  const shouldResetRef = useRef(shouldReset)

  // Atualizar refs quando os callbacks mudarem
  useEffect(() => {
    onIdleRef.current = onIdle
    onActiveRef.current = onActive
    shouldResetRef.current = shouldReset
  }, [onIdle, onActive, shouldReset])

  useEffect(() => {
    const resetTimer = () => {
      // Verificar se deve resetar o timer (se o modal estiver aberto, não reseta)
      if (!shouldResetRef.current()) {
        return
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      // Se estava inativo e agora ficou ativo, chamar callback
      if (isIdleRef.current) {
        isIdleRef.current = false
        onActiveRef.current?.()
      }

      // Reiniciar timer
      timerRef.current = setTimeout(() => {
        isIdleRef.current = true
        onIdleRef.current?.()
      }, timeout)
    }

    // Iniciar o timer
    resetTimer()

    // Adicionar listeners para os eventos
    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true })
    })

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [timeout, events.join(',')]) // Usar join para criar uma dependência estável

  // Não retornar nada, já que só usamos os callbacks
  return null
}
