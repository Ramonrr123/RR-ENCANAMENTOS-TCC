import { useState, useEffect } from 'react'
import { HiClock } from 'react-icons/hi'
import { Button } from '@/components/ui/button'

interface SessionTimeoutModalProps {
  isOpen: boolean
  onReconnect: () => void
  onLogout: () => void
  countdown?: number // Tempo em segundos para logout automático (opcional)
}

export function SessionTimeoutModal({ 
  isOpen, 
  onReconnect, 
  onLogout,
  countdown 
}: SessionTimeoutModalProps) {
  const [remainingTime, setRemainingTime] = useState(countdown || 0)

  useEffect(() => {
    if (!isOpen || !countdown) {
      setRemainingTime(countdown || 0)
      return
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, countdown, onLogout])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-4">
          <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-3">
            <HiClock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
        
        <h2 className="text-xl font-semibold text-center mb-2">
          Sessão Expirada
        </h2>
        
        <p className="text-sm text-muted-foreground text-center mb-6">
          Você ficou inativo por muito tempo. Por segurança, é necessário reconectar sua sessão.
        </p>

        {countdown && remainingTime > 0 && (
          <div className="mb-6 text-center">
            <p className="text-sm text-muted-foreground">
              Fazendo logout automático em:
            </p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {remainingTime}s
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={onReconnect}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            Reconectar
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
            className="flex-1"
          >
            Fazer Logout
          </Button>
        </div>
      </div>
    </div>
  )
}

