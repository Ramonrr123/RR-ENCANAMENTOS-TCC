import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import Login from '@/pages/Login'
import ChamadoPublico from '@/pages/ChamadoPublico'
import PrivacidadePublica from '@/pages/PrivacidadePublica'
import CompanySelection from '@/pages/CompanySelection'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useIdle } from '@/hooks/use-idle'
import { resolveIsAdmin } from '@/lib/admin-access'
import { HiChevronDown, HiChevronRight, HiX } from 'react-icons/hi'
import { HiCheck } from 'react-icons/hi2'
import {
  CabecalhoModal,
  IconeAcesso,
  IconeAtividades,
  IconeCalendario,
  IconeChamado,
  IconeEmpresas,
  IconeEstoque,
  IconeFinanceiro,
  IconeFluxo,
  IconeInicio,
  IconeOrdem,
  IconePagar,
  IconePerfil,
  IconePermissoes,
  IconeProdutos,
  IconeReceber,
  IconeSessoes,
  IconeTarefas,
  IconeUsuarios,
} from '@/components/icones/IconesErp'
import { UsersGrid } from '@/components/UsersGrid'
import { CompaniesGrid } from '@/components/CompaniesGrid'
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal'
import { AlterarSenhaDialog } from '@/components/AlterarSenhaDialog'
import { SessoesAtivas } from '@/components/SessoesAtivas'
import { LandingPage } from '@/components/LandingPage'
import { AgendaModulo } from '@/components/AgendaModulo'
import { TarefasModulo } from '@/components/TarefasModulo'
import { OrdemServicoModulo } from '@/components/OrdemServicoModulo'
import { PreventivasModulo } from '@/components/PreventivasModulo'
import { GarantiasModulo } from '@/components/GarantiasModulo'
import { ControleRecebimentosModulo } from '@/components/ControleRecebimentosModulo'
import { ChamadosModulo } from '@/components/ChamadosModulo'
import { FluxoCaixa } from '@/components/FluxoCaixa'
import { FinanceiroTitulos } from '@/components/FinanceiroTitulos'
import { ProdutosModulo } from '@/components/ProdutosModulo'
import { EstoqueModulo } from '@/components/EstoqueModulo'
import { AtividadesModulo } from '@/components/AtividadesModulo'
import { PrivacidadeModulo } from '@/components/PrivacidadeModulo'
import { AccessPermissions } from '@/components/AccessPermissions'
import { AccessProfile } from '@/components/AccessProfile'
import { Toaster } from '@/components/ui/sonner'
import {
  api,
  clearAuthSession,
  permissionsBelongToUser,
  persistUserStorage,
  savePermissionsForUser,
} from '@/services/api'
import { screensSyncPayload } from '@/constants/permissionScreens'

function isPreviewSession() {
  return localStorage.getItem('access_token') === 'preview-local'
}

type MenuOption = { moduleId: string; optionId: string }

const financeiroOptions = [
  { id: 'pagar', label: 'Contas a pagar', screenId: 'financeiro-pagar', icon: IconePagar },
  { id: 'receber', label: 'Contas a receber', screenId: 'financeiro-receber', icon: IconeReceber },
  { id: 'fluxo', label: 'Fluxo de caixa', screenId: 'financeiro-fluxo', icon: IconeFluxo },
  { id: 'controle-recebimentos', label: 'Controle de recebimentos', screenId: 'financeiro-receber', icon: IconeReceber },
]

const businessModules = [
  { id: 'financeiro', label: 'Financeiro', icon: IconeFinanceiro, text: 'Contas a pagar, contas a receber e o movimento financeiro da empresa.' },
  { id: 'produtos', label: 'Produtos', icon: IconeProdutos, text: 'Cadastro de produtos, peças e materiais.' },
  { id: 'estoque', label: 'Estoque', icon: IconeEstoque, text: 'Entrada e saída das peças e o saldo de cada item.' },
  { id: 'chamados', label: 'Chamados', icon: IconeChamado, text: 'Pedidos recebidos pelo link, antes de virar ordem de serviço.' },
  { id: 'ordem-servico', label: 'Ordem de Serviço', icon: IconeOrdem, text: 'Recibo do serviço, assinatura do cliente e envio pelo WhatsApp.' },
  { id: 'preventivas', label: 'Preventivas', icon: IconeOrdem, text: 'Ordens encerradas com manutenção preventiva no prazo ou atrasada.' },
  { id: 'garantias', label: 'Garantias', icon: IconeOrdem, text: 'Ordens encerradas com garantia vigente ou vencida recentemente.' },
  { id: 'tarefas', label: 'Tarefas', icon: IconeTarefas, text: 'Lista do que precisa ser feito, em andamento ou concluído.' },
  { id: 'calendario', label: 'Calendário', icon: IconeCalendario, text: 'Mês atual, com as tarefas agendadas em cada dia.' },
]

const acessoOptions = [
  { id: 'usuarios', label: 'Usuários', screenId: 'acesso-usuarios', icon: IconeUsuarios },
  { id: 'permissoes', label: 'Permissões de usuário', screenId: 'acesso-permissoes', icon: IconePermissoes },
  { id: 'perfil', label: 'Perfil de acesso', screenId: 'acesso-perfil', icon: IconePerfil },
  { id: 'empresas', label: 'Empresas', screenId: 'acesso-empresas', icon: IconeEmpresas },
  { id: 'sessoes', label: 'Sessões em uso', screenId: 'acesso-sessoes', icon: IconeSessoes },
  { id: 'atividades', label: 'Atividades', screenId: 'acesso-atividades', icon: IconeAtividades },
  { id: 'privacidade', label: 'Privacidade', screenId: 'acesso-privacidade', icon: IconeAtividades },
]

function ModuleHome({ label, icon: Icon, text }: { label: string; icon: typeof IconeInicio; text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center">
        <Icon className="mx-auto mb-4 h-12 w-12 text-primary" />
        <h2 className="text-2xl font-semibold">{label}</h2>
        <p className="mt-2 text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

function Denied() {
  return (
    <div className="p-6 text-center">
      <p className="py-12 text-muted-foreground">Você não tem permissão para acessar esta tela.</p>
    </div>
  )
}

function SidebarCloseBridge({
  fecharRef,
  onMobileSheetClose,
}: {
  fecharRef: MutableRefObject<(() => void) | null>
  onMobileSheetClose?: () => void
}) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()
  const wasOpen = useRef(false)
  useEffect(() => {
    fecharRef.current = () => {
      if (isMobile) setOpenMobile(false)
    }
    return () => {
      fecharRef.current = null
    }
  }, [isMobile, setOpenMobile, fecharRef])
  useEffect(() => {
    if (wasOpen.current && isMobile && !openMobile) {
      onMobileSheetClose?.()
    }
    wasOpen.current = openMobile
  }, [isMobile, openMobile, onMobileSheetClose])
  return null
}

function AppShell() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({})
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [selectedOption, setSelectedOption] = useState<MenuOption | null>(null)
  const [ordemParaAbrir, setOrdemParaAbrir] = useState<number | null>(null)
  const [situacaoOrdemPainel, setSituacaoOrdemPainel] = useState<string | null>(null)
  const [filtroReceberPainel, setFiltroReceberPainel] = useState<'vencido' | null>(null)
  const [focoEstoquePainel, setFocoEstoquePainel] = useState<'repor' | null>(null)
  const [filtroPreventivasPainel, setFiltroPreventivasPainel] = useState<'vencer' | 'vencidas' | null>(null)
  const [filtroChamadosPainel, setFiltroChamadosPainel] = useState<'novos' | null>(null)
  const [abaGarantiasPainel, setAbaGarantiasPainel] = useState<'vigentes' | 'vencidas' | null>(null)
  const [prefillOrdem, setPrefillOrdem] = useState<{ clienteId: number; enderecoId: number | null } | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [financeiroAberto, setFinanceiroAberto] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia('(max-width: 767px)').matches) return false
    const salvo = window.localStorage.getItem('sidebar:open')
    if (salvo === 'true') return true
    if (salvo === 'false') return false
    return true
  })
  const fecharMenuMobileRef = useRef<(() => void) | null>(null)
  const [toast, setToast] = useState<{ message: string; visible: boolean; type: 'success' | 'error' }>({
    message: '',
    visible: false,
    type: 'success',
  })
  const [showSessionTimeout, setShowSessionTimeout] = useState(false)
  const [alterarSenhaOpen, setAlterarSenhaOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [userMenuMode, setUserMenuMode] = useState<'inline' | 'portal'>('portal')
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const [userAvatarBroken, setUserAvatarBroken] = useState(false)
  const [isCompanySelectorOpen, setIsCompanySelectorOpen] = useState(false)
  const [userCompaniesList, setUserCompaniesList] = useState<any[]>([])
  const userRowRef = useRef<HTMLDivElement | null>(null)
  const headerAvatarRef = useRef<HTMLButtonElement | null>(null)
  const didSyncScreens = useRef(false)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    localStorage.removeItem('theme')
  }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, visible: true, type })
    window.setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 4000)
  }

  const loadUserPermissions = async (ownerUser: { id: number; grupoUsuarioId?: string | null; isAdmin?: boolean }) => {
    setPermissionsLoaded(false)
    const response = await api.getMyPermissions()
    const permissionsMap: Record<string, boolean> = {}
    const raw = response.data
    const rows = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object'
        ? Object.entries(raw as Record<string, boolean>).map(([screenId, hasPermission]) => ({ screenId, hasPermission: Boolean(hasPermission) }))
        : []
    rows.forEach((row) => {
      const key = row.screenId || (row as { id?: string }).id
      if (key && row.hasPermission) permissionsMap[key] = true
    })
    if (response.error && navigator.onLine) showToast(response.error, 'error')
    if (Object.keys(permissionsMap).length === 0 && permissionsBelongToUser(ownerUser)) {
      try {
        const cached = JSON.parse(localStorage.getItem('permissions') || '{}') as Record<string, boolean>
        Object.assign(permissionsMap, cached)
      } catch {
        /* ignore */
      }
    }
    setUserPermissions(permissionsMap)
    savePermissionsForUser(ownerUser, permissionsMap)
    setPermissionsLoaded(true)
  }

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (!raw) return
    try {
      const user = JSON.parse(raw)
      if (isPreviewSession()) {
        user.isAdmin = true
        setCurrentUser(user)
        setPermissionsLoaded(true)
        return
      }
      const claimedAdmin = Boolean(user.isAdmin)
      user.isAdmin = false
      setCurrentUser(user)
      if (!claimedAdmin) {
        const cached = localStorage.getItem('permissions')
        if (cached && permissionsBelongToUser(user)) {
          setUserPermissions(JSON.parse(cached))
        }
      }
    } catch {
      setPermissionsLoaded(true)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token || isPreviewSession()) return
    let cancelled = false
    void (async () => {
      const res = await api.getProfile()
      if (cancelled) return
      if (!res.data) {
        setPermissionsLoaded(true)
        return
      }
      const data = res.data as any
      const stored = (() => {
        try {
          return JSON.parse(localStorage.getItem('user') || 'null')
        } catch {
          return null
        }
      })()
      if (stored?.id != null && data?.id != null && Number(stored.id) !== Number(data.id)) {
        clearAuthSession()
        window.location.href = '/login'
        return
      }
      const next = {
        ...(stored || {}),
        ...data,
        isAdmin: resolveIsAdmin({ ...data, isAdmin: Boolean(data.isAdmin) }),
      }
      persistUserStorage(next)
      setCurrentUser(next)
      if (next.isAdmin) setPermissionsLoaded(true)
      else void loadUserPermissions(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!currentUser || didSyncScreens.current || isPreviewSession()) return
    if (!currentUser.isAdmin && !permissionsLoaded) return
    didSyncScreens.current = true
    void api.syncScreens(screensSyncPayload())
  }, [currentUser, permissionsLoaded])

  useEffect(() => {
    const beat = async () => {
      if (!localStorage.getItem('access_token') || isPreviewSession() || document.visibilityState === 'hidden') return
      const res = await api.heartbeat()
      if (res.data?.access_token) localStorage.setItem('access_token', res.data.access_token)
    }
    void beat()
    const id = window.setInterval(() => void beat(), 20000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [])

  useIdle({
    timeout: 30 * 60 * 1000,
    onIdle: () => {
      if (currentUser && localStorage.getItem('access_token') && !showSessionTimeout) setShowSessionTimeout(true)
    },
    shouldReset: () => !showSessionTimeout,
  })

  const hasPermission = (screenId: string) => {
    if (currentUser?.isAdmin) return true
    if (!permissionsLoaded) return false
    return userPermissions[screenId] === true
  }

  const fecharMenuAposNavegar = () => {
    setFinanceiroAberto(false)
    setExpanded(false)
    fecharMenuMobileRef.current?.()
  }

  const openOption = (optionId: string, label: string) => {
    setSelectedOption({ moduleId: 'acesso', optionId })
    setBreadcrumb(['Acesso', label])
    fecharMenuAposNavegar()
    navigate('/')
  }

  const abrirOrdem = (ordemId: number) => {
    setPrefillOrdem(null)
    setOrdemParaAbrir(ordemId)
    openModule('ordem-servico', 'Ordem de Serviço')
  }

  const abrirOrdemDoCliente = (alvo: { clienteId: number; enderecoId: number | null; ordemAbertaId: number | null }) => {
    if (alvo.ordemAbertaId) {
      abrirOrdem(alvo.ordemAbertaId)
      return
    }
    setOrdemParaAbrir(null)
    setPrefillOrdem({ clienteId: alvo.clienteId, enderecoId: alvo.enderecoId })
    openModule('ordem-servico', 'Ordem de Serviço')
  }

  const openModule = (moduleId: string, label: string) => {
    setSelectedOption({ moduleId, optionId: 'main' })
    setBreadcrumb([label])
    fecharMenuAposNavegar()
    navigate('/')
  }

  const openFinanceiro = (optionId: string, label: string) => {
    setSelectedOption({ moduleId: 'financeiro', optionId })
    setBreadcrumb(['Financeiro', label])
    fecharMenuAposNavegar()
    navigate('/')
  }

  const podeFinanceiro = (screenId?: string) => {
    void screenId
    return Boolean(currentUser?.isAdmin)
  }

  const goHome = () => {
    setSelectedOption(null)
    setBreadcrumb([])
    fecharMenuAposNavegar()
    navigate('/')
  }

  function fecharUserMenu() {
    setIsUserMenuOpen(false)
    setMenuPosition(null)
    setUserMenuMode('portal')
  }

  function handleLogout() {
    fecharUserMenu()
    setIsConfirmingLogout(false)
    void api.encerrarMinhaSessao().finally(() => {
      api.logout()
      window.location.href = '/login'
    })
  }

  function pedirConfirmacaoSair() {
    const vinhaDoSheet = isMobile && userMenuMode === 'inline'
    fecharUserMenu()
    if (vinhaDoSheet) {
      fecharMenuMobileRef.current?.()
      window.setTimeout(() => setIsConfirmingLogout(true), 350)
      return
    }
    setIsConfirmingLogout(true)
  }

  function posicionarUserMenu(origem: 'sidebar' | 'header') {
    const alvo = origem === 'header' ? headerAvatarRef.current : userRowRef.current
    const largura = 224
    if (!alvo) {
      setMenuPosition({
        left: Math.max(8, window.innerWidth - largura - 8),
        top: isMobile ? 56 : 16,
      })
      return
    }
    const rect = alvo.getBoundingClientRect()
    let left = origem === 'header' ? rect.right - largura : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - largura - 8))
    if (origem === 'header') {
      const top = Math.min(rect.bottom + 8, window.innerHeight - 280)
      setMenuPosition({ left, top: Math.max(8, top) })
      return
    }
    setMenuPosition({ left, bottom: Math.max(8, window.innerHeight - rect.top + 8) })
  }

  function openUserMenu(origem: 'sidebar' | 'header' = 'sidebar') {
    if (isUserMenuOpen) {
      fecharUserMenu()
      return
    }
    setIsConfirmingLogout(false)

    if (isMobile && origem === 'sidebar') {
      setUserMenuMode('inline')
      setMenuPosition(null)
      setIsUserMenuOpen(true)
      return
    }

    setUserMenuMode('portal')
    posicionarUserMenu(origem)
    setIsUserMenuOpen(true)
  }

  const userMenuItems = (
    <>
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{currentUser?.nome || 'Usuário'}</div>
          <div className="truncate text-xs text-muted-foreground">{currentUser?.grupoUsuario?.label || (currentUser?.isAdmin ? 'Administrador' : '')}</div>
        </div>
        <button type="button" onClick={fecharUserMenu} aria-label="Fechar">
          <HiX className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2.5 text-left text-sm hover:bg-accent"
        onClick={() => {
          fecharUserMenu()
          openOption('perfil', 'Perfil de acesso')
        }}
      >
        Perfil
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2.5 text-left text-sm hover:bg-accent"
        onClick={() => {
          fecharUserMenu()
          fecharMenuMobileRef.current?.()
          setAlterarSenhaOpen(true)
        }}
      >
        Alterar senha
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-accent"
        onClick={pedirConfirmacaoSair}
      >
        Sair
      </button>
    </>
  )

  const initials = (nome?: string) => {
    if (!nome) return 'U'
    const parts = nome.split(' ').filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return nome.slice(0, 2).toUpperCase()
  }

  const avatar = (size: 'sm' | 'md') => {
    const box = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-10 w-10 text-sm'
    if (currentUser?.profileImage && !userAvatarBroken) {
      return <img src={currentUser.profileImage} alt="" className={`${box} rounded-lg object-cover`} onError={() => setUserAvatarBroken(true)} />
    }
    return <div className={`${box} flex items-center justify-center rounded-lg border border-[#eee] bg-white font-bold text-[#333]`}>{initials(currentUser?.nome)}</div>
  }

  const canSee = (screenId: string, adminOnly = false) => {
    if (adminOnly) return Boolean(currentUser?.isAdmin)
    return Boolean(currentUser?.isAdmin) || hasPermission(screenId) || hasPermission('acesso')
  }

  const renderContent = () => {
    if (!selectedOption) {
      if (!currentUser?.isAdmin && permissionsLoaded && !hasPermission('inicio') && !hasPermission('acesso')) {
        return <Denied />
      }
      return (
        <LandingPage
          nome={currentUser?.nome}
          isAdmin={Boolean(currentUser?.isAdmin)}
          onOpen={(id, extras) => {
            if (id === 'receber') {
              setFiltroReceberPainel(extras?.filtro === 'vencido' ? 'vencido' : null)
              openFinanceiro('receber', 'Contas a receber')
              return
            }
            if (id === 'ordem-servico') {
              setSituacaoOrdemPainel(extras?.situacao || null)
              openModule('ordem-servico', 'Ordem de Serviço')
              return
            }
            if (id === 'estoque') {
              setFocoEstoquePainel(extras?.filtro === 'repor' ? 'repor' : null)
              openModule('estoque', 'Estoque')
              return
            }
            if (id === 'preventivas') {
              setFiltroPreventivasPainel(
                extras?.filtro === 'vencidas' ? 'vencidas' : extras?.filtro === 'vencer' ? 'vencer' : null,
              )
              openModule('preventivas', 'Preventivas')
              return
            }
            if (id === 'garantias') {
              setAbaGarantiasPainel(extras?.filtro === 'vencidas' ? 'vencidas' : 'vigentes')
              openModule('garantias', 'Garantias')
              return
            }
            if (id === 'chamados') {
              setFiltroChamadosPainel(extras?.filtro === 'novos' ? 'novos' : 'novos')
              openModule('chamados', 'Chamados')
              return
            }
            if (id === 'privacidade') {
              openOption('privacidade', 'Privacidade')
              return
            }
            const module = businessModules.find((item) => item.id === id)
            if (module) {
              openModule(module.id, module.label)
              return
            }
            const option = acessoOptions.find((item) => item.id === id)
            if (option) openOption(option.id, option.label)
          }}
        />
      )
    }

    const { optionId } = selectedOption
    const option = acessoOptions.find((item) => item.id === optionId)
    const soAdmin = option?.id === 'sessoes' || option?.id === 'atividades' || option?.id === 'privacidade'
    if (option && soAdmin && !currentUser?.isAdmin) return <Denied />
    if (option && !soAdmin && !canSee(option.screenId)) return <Denied />

    if (optionId === 'usuarios') return <UsersGrid showToast={showToast} canEditUserGroup={Boolean(currentUser?.isAdmin)} />
    if (optionId === 'permissoes') return <AccessPermissions showToast={showToast} />
    if (optionId === 'perfil') {
      return (
        <AccessProfile
          isAdmin={Boolean(currentUser?.isAdmin)}
          showToast={showToast}
          onUpdated={(user) => {
            setCurrentUser(user)
            setUserAvatarBroken(false)
            if (!user?.isAdmin) void loadUserPermissions(user)
          }}
        />
      )
    }
    if (optionId === 'empresas') return <CompaniesGrid showToast={showToast} />
    if (optionId === 'sessoes') return <SessoesAtivas showToast={showToast} />
    if (optionId === 'atividades') return <AtividadesModulo showToast={showToast} />
    if (optionId === 'privacidade') return <PrivacidadeModulo showToast={showToast} />

    const module = businessModules.find((item) => item.id === selectedOption.moduleId)
    if (module) {
      if (!currentUser?.isAdmin && permissionsLoaded && !hasPermission(module.id)) return <Denied />
      if (module.id === 'produtos') return <ProdutosModulo showToast={showToast} isAdmin={Boolean(currentUser?.isAdmin)} />
      if (module.id === 'estoque') {
        return (
          <EstoqueModulo
            showToast={showToast}
            isAdmin={Boolean(currentUser?.isAdmin)}
            focoReposicao={focoEstoquePainel}
            onFocoConsumido={() => setFocoEstoquePainel(null)}
          />
        )
      }
      if (module.id === 'calendario') return <AgendaModulo isAdmin={Boolean(currentUser?.isAdmin)} showToast={showToast} />
      if (module.id === 'tarefas') return <TarefasModulo />
      if (module.id === 'chamados') {
        return (
          <ChamadosModulo
            onAbrirOrdem={abrirOrdem}
            filtroInicial={filtroChamadosPainel}
            onFiltroConsumido={() => setFiltroChamadosPainel(null)}
          />
        )
      }
      if (module.id === 'ordem-servico') {
        return (
          <OrdemServicoModulo
            isAdmin={Boolean(currentUser?.isAdmin)}
            ordemInicialId={ordemParaAbrir}
            onOrdemConsumida={() => setOrdemParaAbrir(null)}
            situacaoInicial={situacaoOrdemPainel}
            onSituacaoConsumida={() => setSituacaoOrdemPainel(null)}
            prefill={prefillOrdem}
            onPrefillConsumido={() => setPrefillOrdem(null)}
          />
        )
      }
      if (module.id === 'preventivas') {
        if (!currentUser?.isAdmin) return <Denied />
        return (
          <PreventivasModulo
            onAbrirOrdem={abrirOrdemDoCliente}
            filtroInicial={filtroPreventivasPainel}
            onFiltroConsumido={() => setFiltroPreventivasPainel(null)}
          />
        )
      }
      if (module.id === 'garantias') {
        if (!currentUser?.isAdmin) return <Denied />
        return (
          <GarantiasModulo
            onAbrirOrdem={abrirOrdemDoCliente}
            abaInicial={abaGarantiasPainel}
            onAbaConsumida={() => setAbaGarantiasPainel(null)}
          />
        )
      }
      if (module.id === 'financeiro') {
        const tela =
          selectedOption.optionId === 'pagar'
            ? 'financeiro-pagar'
            : selectedOption.optionId === 'receber'
              ? 'financeiro-receber'
              : selectedOption.optionId === 'fluxo'
                ? 'financeiro-fluxo'
                : undefined
        if (!podeFinanceiro(tela)) return <Denied />
        if (selectedOption.optionId === 'pagar') return <FinanceiroTitulos tipo="PAGAR" showToast={showToast} />
        if (selectedOption.optionId === 'receber') {
          return (
            <FinanceiroTitulos
              tipo="RECEBER"
              showToast={showToast}
              filtroInicial={filtroReceberPainel}
              onFiltroConsumido={() => setFiltroReceberPainel(null)}
            />
          )
        }
        if (selectedOption.optionId === 'fluxo') return <FluxoCaixa showToast={showToast} />
        if (selectedOption.optionId === 'controle-recebimentos') {
          if (!currentUser?.isAdmin) return <Denied />
          return <ControleRecebimentosModulo showToast={showToast} />
        }
        return null
      }
      return <ModuleHome label={module.label} icon={module.icon} text={module.text} />
    }
    return null
  }

  const selectedCompany = (() => {
    try {
      const raw = localStorage.getItem('selectedCompany')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SidebarCloseBridge fecharRef={fecharMenuMobileRef} onMobileSheetClose={fecharUserMenu} />
      <Sidebar className="border-r" collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center justify-center px-3 py-2">
            <img src="/logo-rr.png?v=2" alt="RR Encanamentos" className="h-16 w-auto object-contain" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(currentUser?.isAdmin || !permissionsLoaded || hasPermission('inicio') || hasPermission('acesso')) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={selectedOption === null} onClick={goHome}>
                      <span className="inline-flex items-center gap-2">
                        <IconeInicio className="h-5 w-5" />
                        Início
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {businessModules.map((module) => {
                  const Icon = module.icon
                  if ((module.id === 'preventivas' || module.id === 'garantias') && !currentUser?.isAdmin) return null
                  if (module.id === 'financeiro') {
                    if (!podeFinanceiro()) return null
                    return (
                      <SidebarMenuItem key={module.id}>
                        <SidebarMenuButton
                          isActive={selectedOption?.moduleId === 'financeiro'}
                          onClick={() => setFinanceiroAberto((aberto) => !aberto)}
                        >
                          <span className="inline-flex flex-1 items-center gap-2">
                            <Icon className="h-5 w-5" />
                            {module.label}
                          </span>
                          <HiChevronDown className={`h-4 w-4 transition-transform ${financeiroAberto ? 'rotate-180' : ''}`} />
                        </SidebarMenuButton>
                        {financeiroAberto && (
                          <SidebarMenuSub>
                            {financeiroOptions.filter((option) => podeFinanceiro(option.screenId)).map((option) => (
                              <SidebarMenuSubItem key={option.id}>
                                <SidebarMenuSubButton
                                  isActive={selectedOption?.moduleId === 'financeiro' && selectedOption.optionId === option.id}
                                  onClick={() => openFinanceiro(option.id, option.label)}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <option.icon className="h-4 w-4" />
                                    {option.label}
                                  </span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    )
                  }
                  const visible = Boolean(currentUser?.isAdmin) || !permissionsLoaded || hasPermission(module.id)
                  if (!visible) return null
                  return (
                    <SidebarMenuItem key={module.id}>
                      <SidebarMenuButton
                        isActive={selectedOption?.moduleId === module.id}
                        onClick={() => openModule(module.id, module.label)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          {module.label}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
                {(currentUser?.isAdmin || hasPermission('acesso') || acessoOptions.some((option) => option.id !== 'sessoes' && option.id !== 'atividades' && option.id !== 'privacidade' && hasPermission(option.screenId))) && (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setExpanded((value) => !value)}>
                      <span className="inline-flex flex-1 items-center gap-2">
                        <IconeAcesso className="h-5 w-5" />
                        Acesso
                      </span>
                      <HiChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </SidebarMenuButton>
                    {expanded && (
                      <SidebarMenuSub>
                        {acessoOptions.filter((option) => option.id === 'sessoes' || option.id === 'atividades' || option.id === 'privacidade' ? Boolean(currentUser?.isAdmin) : canSee(option.screenId)).map((option) => (
                          <SidebarMenuSubItem key={option.id}>
                            <SidebarMenuSubButton
                              isActive={selectedOption?.optionId === option.id}
                              onClick={() => openOption(option.id, option.label)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <option.icon className="h-4 w-4" />
                                {option.label}
                              </span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {isUserMenuOpen && userMenuMode === 'inline' && (
            <div
              role="menu"
              className="mx-2 mb-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
            >
              {userMenuItems}
            </div>
          )}
          <div
            ref={userRowRef}
            className="mx-2 mb-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-sidebar-accent/50"
            onClick={() => openUserMenu('sidebar')}
          >
            {avatar('md')}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{currentUser?.nome || 'Usuário'}</div>
              <div className="truncate text-xs text-muted-foreground">{currentUser?.email || currentUser?.login || ''}</div>
            </div>
            <HiChevronDown className={`h-4 w-4 ${isUserMenuOpen && userMenuMode === 'inline' ? 'rotate-180' : ''}`} />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 min-w-0 items-center gap-2 border-b bg-card px-2 py-2 sm:px-3">
          <SidebarTrigger />
          {breadcrumb.length > 0 && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground">
              {breadcrumb.map((crumb, index) => (
                <div key={crumb} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <HiChevronRight className="hidden h-4 w-4 sm:block" />}
                  <span className={`${index === breadcrumb.length - 1 ? 'truncate font-medium text-foreground' : 'hidden truncate sm:inline'}`}>{crumb}</span>
                </div>
              ))}
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {selectedCompany && (
              <button type="button" className="max-w-[7.5rem] truncate text-xs hover:text-primary sm:max-w-xs sm:text-sm" onClick={async () => {
                const user = currentUser
                if (!user?.id) return
                const response = await api.getUserCompanies(user.id)
                setUserCompaniesList(Array.isArray(response.data) ? response.data : [])
                setIsCompanySelectorOpen(true)
              }}>
                <span className="sm:hidden">{selectedCompany.nome || selectedCompany.codigo}</span>
                <span className="hidden sm:inline">Empresa: {selectedCompany.codigo} - {selectedCompany.nome}</span>
              </button>
            )}
            {isMobile && (
              <button
                ref={headerAvatarRef}
                type="button"
                className="rounded-lg bg-transparent p-0.5"
                onClick={() => openUserMenu('header')}
                aria-label="Menu do usuário"
              >
                {avatar('sm')}
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden overscroll-none">{renderContent()}</div>
      </SidebarInset>

      {isUserMenuOpen && userMenuMode === 'portal' && menuPosition && createPortal(
        <>
          <button
            type="button"
            aria-label="Fechar menu do usuário"
            className="fixed inset-0 z-[199] cursor-default bg-black/20"
            onClick={fecharUserMenu}
          />
          <div
            role="menu"
            className="fixed z-[200] w-56 rounded-md border bg-popover text-popover-foreground shadow-lg"
            style={{
              left: menuPosition.left,
              ...(menuPosition.top != null ? { top: menuPosition.top } : { bottom: menuPosition.bottom }),
            }}
          >
            {userMenuItems}
          </div>
        </>,
        document.body,
      )}

      {isConfirmingLogout && createPortal(
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsConfirmingLogout(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sair-titulo"
            className="w-full max-w-sm rounded-xl border border-[#ddd] bg-background p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="sair-titulo" className="text-lg font-semibold text-[#333]">Sair do sistema</h3>
            <p className="mt-2 text-sm text-muted-foreground">Tem certeza que deseja sair?</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-[#d0d5dd] text-sm font-medium"
                onClick={() => setIsConfirmingLogout(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-destructive text-sm font-medium text-destructive-foreground"
                onClick={handleLogout}
              >
                Sair
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <AlterarSenhaDialog open={alterarSenhaOpen} onOpenChange={setAlterarSenhaOpen} />
      {currentUser && (
        <SessionTimeoutModal
          isOpen={showSessionTimeout}
          onReconnect={() => window.location.reload()}
          onLogout={handleLogout}
          countdown={30}
        />
      )}

      {isCompanySelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-background p-6">
            <CabecalhoModal
              icone={IconeEmpresas}
              titulo="Trocar empresa"
              descricao="Escolha a empresa desta sessão."
              onFechar={() => setIsCompanySelectorOpen(false)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              {userCompaniesList.map((company) => {
                const selected = selectedCompany?.id === company.id
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      localStorage.setItem('selectedCompany', JSON.stringify(company))
                      window.location.reload()
                    }}
                    className={`rounded-lg border-2 p-4 text-left ${selected ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {selected ? <HiCheck className="h-4 w-4" /> : null}
                      {company.codigo}
                    </div>
                    <p className="text-sm text-muted-foreground">{company.nome}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {toast.visible && (
        <div className={`fixed bottom-6 right-6 z-[9999] max-w-sm rounded-xl px-5 py-4 text-sm text-white shadow-2xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
      <Toaster />
    </SidebarProvider>
  )
}

function shouldSelectCompany() {
  if (window.location.pathname !== '/') return false
  const token = localStorage.getItem('access_token')
  if (!token) return false
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const companies = user.companies || []
    if (companies.length <= 1) {
      if (companies.length === 1 && !localStorage.getItem('selectedCompany')) {
        localStorage.setItem('selectedCompany', JSON.stringify(companies[0]))
      }
      return false
    }
    return !localStorage.getItem('selectedCompany')
  } catch {
    return false
  }
}

export default function RootApp() {
  const tokenSalvo = localStorage.getItem('access_token')
  const sessaoFalsaPublicada = import.meta.env.PROD && tokenSalvo === 'preview-local'
  if (sessaoFalsaPublicada) clearAuthSession()
  const token = sessaoFalsaPublicada ? null : tokenSalvo
  const caminho = window.location.pathname
  const isLoginPage = caminho === '/login'
  const chamadoPublico = caminho === '/chamado'
  const privacidadePublica = caminho === '/privacidade'
  const rotaPublica = isLoginPage || chamadoPublico || privacidadePublica

  useEffect(() => {
    if (!token && !rotaPublica) window.location.href = '/login'
  }, [token, rotaPublica])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'user' || event.key === 'access_token' || event.key === 'permissionsOwner') {
        window.location.reload()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/chamado" element={<ChamadoPublico />} />
        <Route path="/privacidade" element={<PrivacidadePublica />} />
        <Route path="*" element={token ? (
          <div className="relative">
            <AppShell />
            {shouldSelectCompany() && <CompanySelection />}
          </div>
        ) : <Login />} />
      </Routes>
    </BrowserRouter>
  )
}
