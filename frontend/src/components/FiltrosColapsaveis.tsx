import { useState, type ReactNode } from 'react'
import { HiChevronDown } from 'react-icons/hi'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

type FiltrosColapsaveisProps = {
  children: ReactNode
  /** No mobile começa aberto. No desktop os filtros ficam sempre visíveis. */
  defaultAberto?: boolean
  titulo?: string
  className?: string
  conteudoClassName?: string
}

export function FiltrosColapsaveis({
  children,
  defaultAberto = false,
  titulo = 'Filtros',
  className,
  conteudoClassName,
}: FiltrosColapsaveisProps) {
  const isMobile = useIsMobile()
  const [aberto, setAberto] = useState(defaultAberto)

  if (!isMobile) {
    return <div className={cn(conteudoClassName)}>{children}</div>
  }

  return (
    <div className={cn('rounded-md border border-[#ddd] bg-white', className)}>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        className="flex h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm font-medium text-[#333]"
      >
        <span>{titulo}</span>
        <HiChevronDown
          className={cn('h-5 w-5 shrink-0 text-[#666] transition-transform', aberto && 'rotate-180')}
        />
      </button>
      {aberto ? (
        <div className={cn('border-t border-[#eee] px-3 py-3', conteudoClassName || 'space-y-2')}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
