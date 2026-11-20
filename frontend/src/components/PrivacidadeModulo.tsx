import { useEffect, useState } from 'react'
import { CabecalhoModulo, IconeAtividades } from '@/components/icones/IconesErp'
import { api } from '@/services/api'

type Aba = 'solicitacoes' | 'titular' | 'mapa' | 'retencao'

const TIPOS = [
  'ACESSO',
  'CORRECAO',
  'ANONIMIZACAO',
  'ELIMINACAO',
  'INFORMACAO',
  'RETIRADA_CONSENTIMENTO',
  'OUTRO',
]

export function PrivacidadeModulo({ showToast }: { showToast: (msg: string, tipo?: 'success' | 'error') => void }) {
  const [aba, setAba] = useState<Aba>('solicitacoes')
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState('todas')
  const [nova, setNova] = useState({
    tipo: 'ACESSO',
    solicitanteNome: '',
    solicitanteTelefone: '',
    chamadoNumero: '',
    descricao: '',
    canal: 'SITE',
  })
  const [busca, setBusca] = useState('')
  const [titular, setTitular] = useState<any>(null)
  const [confirmAnon, setConfirmAnon] = useState('')
  const [confirmarAnonAberto, setConfirmarAnonAberto] = useState(false)
  const [mapa, setMapa] = useState<any[]>([])
  const [consentimentos, setConsentimentos] = useState<any>(null)
  const [retencao, setRetencao] = useState<any>(null)

  async function carregarSolicitacoes() {
    const r = await api.request(
      `/privacidade/solicitacoes?${new URLSearchParams({
        ...(filtroStatus !== 'todas' ? { status: filtroStatus } : {}),
        ...(filtroTipo !== 'todas' ? { tipo: filtroTipo } : {}),
      }).toString()}`,
    )
    if (r.error) showToast(r.error, 'error')
    else setSolicitacoes(Array.isArray(r.data) ? r.data : [])
  }

  useEffect(() => {
    if (aba === 'solicitacoes') void carregarSolicitacoes()
    if (aba === 'mapa') {
      void api.request('/privacidade/mapa').then((r) => {
        if (r.error) showToast(r.error, 'error')
        else setMapa(Array.isArray(r.data) ? r.data : [])
      })
    }
    if (aba === 'retencao') {
      void Promise.all([
        api.request('/privacidade/consentimentos'),
        api.request('/privacidade/retencao?simular=1'),
      ]).then(([c, ret]) => {
        if (c.error) showToast(c.error, 'error')
        else setConsentimentos(c.data)
        if (ret.error) showToast(ret.error, 'error')
        else setRetencao(ret.data)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, filtroStatus, filtroTipo])

  async function criarSolicitacao(e: React.FormEvent) {
    e.preventDefault()
    const r = await api.request('/privacidade/solicitacoes', {
      method: 'POST',
      body: JSON.stringify({
        ...nova,
        chamadoNumero: nova.chamadoNumero ? Number(nova.chamadoNumero) : undefined,
      }),
    })
    if (r.error) showToast(r.error, 'error')
    else {
      showToast('Solicitação registrada')
      setNova({ tipo: 'ACESSO', solicitanteNome: '', solicitanteTelefone: '', chamadoNumero: '', descricao: '', canal: 'SITE' })
      void carregarSolicitacoes()
    }
  }

  async function buscarTitular(e: React.FormEvent) {
    e.preventDefault()
    const r = await api.request(`/privacidade/titular?q=${encodeURIComponent(busca)}`)
    if (r.error) showToast(r.error, 'error')
    else setTitular(r.data)
  }

  async function exportar() {
    const r = await api.request(`/privacidade/titular/exportar?q=${encodeURIComponent(busca)}`)
    if (r.error) {
      showToast(r.error, 'error')
      return
    }
    const { baixarArquivo } = await import('@/lib/baixarArquivo')
    const blob = new Blob([JSON.stringify(r.data?.dados || r.data, null, 2)], { type: 'application/json' })
    await baixarArquivo(blob, 'exportacao-titular.json')
    if (r.data?.csv) {
      const csv = new Blob([r.data.csv], { type: 'text/csv;charset=utf-8' })
      await baixarArquivo(csv, 'exportacao-titular.csv')
    }
    showToast('Exportação gerada')
  }

  function pedirConfirmacaoAnonimizacao() {
    const id = titular?.cliente?.id
    if (!id) {
      showToast('Busque um titular com cliente', 'error')
      return
    }
    if (confirmAnon.trim().toUpperCase() !== 'ANONIMIZAR') {
      showToast('Digite ANONIMIZAR para confirmar', 'error')
      return
    }
    setConfirmarAnonAberto(true)
  }

  async function executarAnonimizacaoTitular() {
    const id = titular?.cliente?.id
    if (!id) return
    setConfirmarAnonAberto(false)
    const r = await api.request(`/privacidade/titular/${id}/anonimizar`, {
      method: 'POST',
      body: JSON.stringify({ confirmacao: 'ANONIMIZAR' }),
    })
    if (r.error) showToast(r.error, 'error')
    else {
      showToast('Titular anonimizado')
      setConfirmAnon('')
      setBusca(String(id))
      const novamente = await api.request(`/privacidade/titular?q=${encodeURIComponent(String(id))}`)
      if (!novamente.error) setTitular(novamente.data)
    }
  }

  async function anonimizarVencidos() {
    if (!window.confirm('Anonimizar todos os registros vencidos listados?')) return
    const r = await api.request('/privacidade/retencao/anonimizar', { method: 'POST', body: '{}' })
    if (r.error) showToast(r.error, 'error')
    else {
      showToast(`Anonimizados: ${r.data?.anonimizados ?? 0}`)
      const ret = await api.request('/privacidade/retencao?simular=1')
      setRetencao(ret.data)
    }
  }

  const abas: Array<{ id: Aba; label: string }> = [
    { id: 'solicitacoes', label: 'Solicitações de titulares' },
    { id: 'titular', label: 'Dados do titular' },
    { id: 'mapa', label: 'Mapa de dados' },
    { id: 'retencao', label: 'Consentimentos e retenção' },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-3 sm:px-6 sm:py-4">
        <CabecalhoModulo
          icone={IconeAtividades}
          titulo="Privacidade"
          descricao="Pedidos de titulares, mapa de dados e retenção. Controles do sistema — sem afirmação de conformidade."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              data-aba={item.id}
              onClick={() => setAba(item.id)}
              className={`rounded-md border px-3 py-2 text-sm ${aba === item.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {aba === 'solicitacoes' && (
          <div className="space-y-4" data-painel-privacidade="solicitacoes">
            <form className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2" onSubmit={criarSolicitacao}>
              <h3 className="sm:col-span-2 text-sm font-semibold">Nova solicitação</h3>
              <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })} className="h-10 rounded-md border px-3 text-sm">
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select value={nova.canal} onChange={(e) => setNova({ ...nova, canal: e.target.value })} className="h-10 rounded-md border px-3 text-sm">
                <option value="SITE">SITE</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="PRESENCIAL">PRESENCIAL</option>
                <option value="OUTRO">OUTRO</option>
              </select>
              <input required placeholder="Nome do solicitante" value={nova.solicitanteNome} onChange={(e) => setNova({ ...nova, solicitanteNome: e.target.value })} className="h-10 rounded-md border px-3 text-sm" />
              <input placeholder="Telefone" value={nova.solicitanteTelefone} onChange={(e) => setNova({ ...nova, solicitanteTelefone: e.target.value })} className="h-10 rounded-md border px-3 text-sm" />
              <input placeholder="Nº chamado (opcional)" value={nova.chamadoNumero} onChange={(e) => setNova({ ...nova, chamadoNumero: e.target.value })} className="h-10 rounded-md border px-3 text-sm" />
              <textarea required placeholder="Descrição" value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} className="min-h-20 rounded-md border px-3 py-2 text-sm sm:col-span-2" />
              <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground sm:col-span-2">Registrar</button>
            </form>

            <div className="flex flex-wrap gap-2">
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                <option value="todas">Todas</option>
                <option value="ABERTA">Aberta</option>
                <option value="EM_ANALISE">Em análise</option>
                <option value="ATENDIDA">Atendida</option>
                <option value="RECUSADA">Recusada</option>
              </select>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                <option value="todas">Todos os tipos</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <ul className="space-y-2">
              {solicitacoes.map((s) => (
                <li key={s.id} className={`rounded-xl border p-3 ${s.vencida ? 'border-amber-500 bg-amber-50' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">#{s.id} · {s.tipo} · {s.status}</p>
                      <p className="text-sm text-muted-foreground">{s.solicitanteNome}{s.chamadoNumero ? ` · chamado ${s.chamadoNumero}` : ''}</p>
                      <p className="mt-1 text-sm">{s.descricao}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Prazo {String(s.prazoEm).slice(0, 10)}{s.vencida ? ' · VENCIDA' : ''}</p>
                    </div>
                    <select
                      aria-label={`Status solicitação ${s.id}`}
                      value={s.status}
                      onChange={async (e) => {
                        const r = await api.request(`/privacidade/solicitacoes/${s.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: e.target.value }),
                        })
                        if (r.error) showToast(r.error, 'error')
                        else void carregarSolicitacoes()
                      }}
                      className="h-9 rounded-md border px-2 text-sm"
                    >
                      <option value="ABERTA">ABERTA</option>
                      <option value="EM_ANALISE">EM_ANALISE</option>
                      <option value="ATENDIDA">ATENDIDA</option>
                      <option value="RECUSADA">RECUSADA</option>
                    </select>
                  </div>
                </li>
              ))}
              {solicitacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação neste filtro.</p>}
            </ul>
          </div>
        )}

        {aba === 'titular' && (
          <div className="space-y-4" data-painel-privacidade="titular">
            <form className="flex flex-wrap gap-2" onSubmit={buscarTitular}>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone ou termo" className="h-10 min-w-[220px] flex-1 rounded-md border px-3 text-sm" />
              <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">Buscar</button>
              <button
                type="button"
                data-testid="exportar-titular"
                disabled={!titular?.cliente}
                onClick={() => void exportar()}
                className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                Exportar dados
              </button>
            </form>
            {titular?.cliente ? (
              <div className="space-y-3 rounded-xl border p-4">
                <p className="font-semibold">Cliente #{titular.cliente.id}</p>
                <p className="text-sm">Nome: {titular.cliente.nome}</p>
                <p className="text-sm">Telefone: {titular.cliente.telefone || '—'}</p>
                <p className="text-sm">Chamados: {titular.chamados?.length || 0} · Ordens: {titular.cliente.ordens?.length || 0} · Títulos: {titular.titulos?.length || 0}</p>
                <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                  <input value={confirmAnon} onChange={(e) => setConfirmAnon(e.target.value)} placeholder="Digite ANONIMIZAR" className="h-10 rounded-md border px-3 text-sm" />
                  <button type="button" onClick={pedirConfirmacaoAnonimizacao} className="h-10 rounded-md bg-[#e10600] px-4 text-sm text-white">Anonimizar titular</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Busque um titular para ver os vínculos.</p>
            )}
            {confirmarAnonAberto && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-anon-titulo"
                data-testid="confirmacao-anonimizacao"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              >
                <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-lg">
                  <h3 id="confirm-anon-titulo" className="text-base font-semibold text-slate-900">Confirmar anonimização</h3>
                  <p className="mt-2 text-sm text-slate-700">
                    Segunda etapa: confirma a anonimização completa do titular #{titular?.cliente?.id}? Esta ação altera os dados de verdade e não pode ser desfeita pelo sistema.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" className="h-10 rounded-md border px-4 text-sm" onClick={() => setConfirmarAnonAberto(false)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      data-testid="confirmar-anonimizacao"
                      className="h-10 rounded-md bg-[#e10600] px-4 text-sm text-white"
                      onClick={() => void executarAnonimizacaoTitular()}
                    >
                      Confirmar anonimização
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {aba === 'mapa' && (
          <div className="overflow-auto" data-painel-privacidade="mapa">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Dado</th>
                  <th className="p-2">Tabela</th>
                  <th className="p-2">Campo</th>
                  <th className="p-2">Finalidade</th>
                  <th className="p-2">Quem acessa</th>
                  <th className="p-2">Retenção</th>
                  <th className="p-2">Anonimização</th>
                </tr>
              </thead>
              <tbody>
                {mapa.map((linha, i) => (
                  <tr key={`${linha.modelo}-${linha.campo}-${i}`} className="border-b align-top">
                    <td className="p-2">{linha.dado}</td>
                    <td className="p-2 font-mono text-xs">{linha.modelo}</td>
                    <td className="p-2 font-mono text-xs">{linha.campo}</td>
                    <td className="p-2">{linha.finalidade}</td>
                    <td className="p-2">{linha.quemAcessa}</td>
                    <td className="p-2">{linha.retencao}</td>
                    <td className="p-2">{linha.anonimizacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === 'retencao' && (
          <div className="space-y-4" data-painel-privacidade="retencao">
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">Consentimentos por versão do aviso</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {(consentimentos?.porVersao || []).map((v: any) => (
                  <li key={v.avisoVersao}>{v.avisoVersao}: {v.quantidade}</li>
                ))}
              </ul>
              <h4 className="mt-4 text-sm font-medium">Chamados sem aceite (só número/data/origem)</h4>
              <ul className="mt-1 max-h-40 overflow-auto text-sm text-muted-foreground">
                {(consentimentos?.semAceite || []).map((c: any) => (
                  <li key={c.numero}>#{c.numero} · {c.data} · {c.origem}</li>
                ))}
                {(consentimentos?.semAceite || []).length === 0 && <li>Nenhum</li>}
              </ul>
            </section>
            <section className="rounded-xl border p-4">
              <h3 className="font-semibold">Retenção</h3>
              <p className="mt-1 text-sm">
                Lista abaixo em modo simular (só conta e mostra, sem alterar): registros com mais de{' '}
                {retencao?.prazoAnos ?? 5} anos após encerramento ainda não anonimizados — total{' '}
                {retencao?.total ?? 0}.
              </p>
              <ul className="mt-2 max-h-40 overflow-auto text-sm text-muted-foreground">
                {(retencao?.itens || []).map((i: any) => (
                  <li key={i.ordemId}>OS {i.numero} · encerrada {i.dataEncerramento} · cliente #{i.clienteId}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-[#e10600]">
                O botão &quot;Anonimizar vencidos&quot; altera os dados de verdade (não é simulação): anonimiza
                titular, endereços, chamados e textos ligados a cada registro listado.
              </p>
              <button type="button" onClick={() => void anonimizarVencidos()} className="mt-2 h-10 rounded-md bg-[#e10600] px-4 text-sm text-white">
                Anonimizar vencidos
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
