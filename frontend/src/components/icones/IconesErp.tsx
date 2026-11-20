import type { ReactNode, SVGProps } from 'react'

function Traco(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
  )
}

export function IconeInicio(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10.5V20h12v-9.5" />
      <path d="M10 20v-5h4v5" />
    </Traco>
  )
}

export function IconeFinanceiro(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </Traco>
  )
}

export function IconePagar(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M3 8h18" />
      <path d="M12 16v5" />
      <path d="m9.5 18.5 2.5 2.5 2.5-2.5" />
    </Traco>
  )
}

export function IconeReceber(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 8V3" />
      <path d="m9.5 5.5 2.5-2.5 2.5 2.5" />
    </Traco>
  )
}

export function IconeFluxo(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M4 16 8 11l4 3 7-8" />
      <path d="M15 6h5v5" />
    </Traco>
  )
}

export function IconeProdutos(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M3 8h8a4 4 0 0 1 4 4v7" />
      <path d="M3 5.5v5" />
      <path d="M1.5 5.5h3" />
      <path d="M15 19h5" />
      <circle cx="15" cy="19" r="1.4" />
    </Traco>
  )
}

export function IconeEstoque(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M3 8 12 4l9 4-9 4-9-4Z" />
      <path d="M3 8v8l9 4 9-4V8" />
      <path d="M12 12v8" />
    </Traco>
  )
}

export function IconeChamado(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H9l-4 4v-4.2A2.5 2.5 0 0 1 5 12.5z" />
      <path d="M8 8.5h8M8 11.5h5" />
    </Traco>
  )
}

export function IconeOrdem(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3.5h6V6H9z" />
      <path d="M8 11h8M8 15h5" />
    </Traco>
  )
}

export function IconeTarefas(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3.5 6 1.2 1.2L7 5" />
      <path d="m3.5 12 1.2 1.2L7 11" />
      <path d="m3.5 18 1.2 1.2L7 17" />
    </Traco>
  )
}

export function IconeCalendario(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2" />
    </Traco>
  )
}

export function IconeAcesso(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <circle cx="8" cy="12" r="3.25" />
      <path d="M11.2 12H21" />
      <path d="M17 12v2.5M19.5 12v2" />
    </Traco>
  )
}

export function IconeUsuarios(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.7-3 2.7-4.5 5.5-4.5s4.8 1.5 5.5 4.5" />
      <circle cx="17" cy="9" r="2.1" />
      <path d="M16 14.6c1.7.3 3.1 1.4 3.7 3.4" />
    </Traco>
  )
}

export function IconePermissoes(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M12 3 19 6v6c0 4.2-2.8 6.6-7 8.5C7.8 18.6 5 16.2 5 12V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Traco>
  )
}

export function IconePerfil(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.4" />
      <path d="M8 17c.7-2 2.1-3 4-3s3.3 1 4 3" />
    </Traco>
  )
}

export function IconeEmpresas(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M4 20V7l6-3v16" />
      <path d="M10 20V9h9v11" />
      <path d="M3 20h18" />
      <path d="M13 13h2M13 16h2M7 11h1M7 14h1" />
    </Traco>
  )
}

export function IconeSessoes(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Traco>
  )
}

export function IconeAtividades(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M3 12h4l2.2-6 4.2 12L16 12h5" />
    </Traco>
  )
}

export function IconeAssinatura(props: SVGProps<SVGSVGElement>) {
  return (
    <Traco {...props}>
      <path d="M4 18c2-4 3.5-6 5-6 1.2 0 1.5 2 3 2s2-3 3.5-3 2.2 2 4.5 1" />
      <path d="M14 5.5 16.5 3 21 7.5 18.5 10" />
      <path d="M13 6.5 17.5 11" />
    </Traco>
  )
}

export function CabecalhoModal({
  icone: Icone,
  titulo,
  descricao,
  onFechar,
  acoes,
}: {
  icone: (props: SVGProps<SVGSVGElement>) => ReactNode
  titulo: string
  descricao?: string
  onFechar?: () => void
  acoes?: ReactNode
}) {
  return (
    <div className="relative mb-4">
      <div className="flex min-w-0 items-start gap-3 pr-10">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight">{titulo}</h3>
          {descricao ? <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{descricao}</p> : null}
        </div>
      </div>
      {onFechar ? (
        <button type="button" onClick={onFechar} className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Fechar">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
      {acoes ? <div className="mt-3 flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  )
}

export function CabecalhoModulo({
  icone: Icone,
  titulo,
  descricao,
  acoes,
}: {
  icone: (props: SVGProps<SVGSVGElement>) => ReactNode
  titulo: string
  descricao?: string
  acoes?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icone className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{titulo}</h2>
          {descricao ? <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{descricao}</p> : null}
        </div>
      </div>
      {acoes ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{acoes}</div> : null}
    </div>
  )
}
