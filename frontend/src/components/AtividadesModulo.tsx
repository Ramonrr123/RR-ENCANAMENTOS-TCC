import { useState } from 'react'
import { api } from '@/services/api'
import { CabecalhoModulo, IconeAtividades } from '@/components/icones/IconesErp'

type Atividade = {
  id: number
  usuarioId: number | null
  login: string
  acao: string
  caminho: string
  metodo: string
  objeto: string
  criadoEm: string
}

const PAGE_SIZE = 16

function dataHora(valor: string) {
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return valor
  return data.toLocaleString('pt-BR')
}

export function AtividadesModulo({
  showToast,
}: {
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const [usuarioId, setUsuarioId] = useState('')
  const [acao, setAcao] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [linhas, setLinhas] = useState<Atividade[]>([])
  const [carregando, setCarregando] = useState(false)
  const [consultou, setConsultou] = useState(false)
  const [pagina, setPagina] = useState(0)

  async function consultar() {
    if ((de && !ate) || (!de && ate)) {
      showToast('Informe a data inicial e a data final.', 'error')
      return
    }
    if (de && ate && de > ate) {
      showToast('A data inicial não pode ser maior que a data final.', 'error')
      return
    }
    setCarregando(true)
    const response = await api.getAtividades({
      usuarioId: usuarioId.trim(),
      acao: acao.trim(),
      de,
      ate,
    })
    if (response.data) setLinhas(response.data)
    else {
      setLinhas([])
      if (response.error) showToast(response.error, 'error')
    }
    setConsultou(true)
    setPagina(0)
    setCarregando(false)
  }

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE))
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const visiveis = linhas.slice(paginaAtual * PAGE_SIZE, paginaAtual * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-3 sm:px-6 sm:py-6">
        <CabecalhoModulo
          icone={IconeAtividades}
          titulo="Atividades"
          descricao="Inclusões, alterações e exclusões feitas por quem estava autenticado."
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <input
            value={usuarioId}
            onChange={(event) => setUsuarioId(event.target.value)}
            inputMode="numeric"
            placeholder="Usuário"
            aria-label="Usuário"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-28"
          />
          <input
            value={acao}
            onChange={(event) => setAcao(event.target.value)}
            placeholder="Ação"
            aria-label="Ação"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-48"
          />
          <input type="date" value={de} onChange={(event) => setDe(event.target.value)} aria-label="De" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
          <input type="date" value={ate} onChange={(event) => setAte(event.target.value)} aria-label="Até" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
          <button type="button" onClick={() => void consultar()} className="col-span-2 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground sm:col-span-1 sm:w-auto">
            Consultar
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse md:min-w-[720px]">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {['Quando', 'Login', 'Método', 'Ação', 'Caminho', 'Objeto'].map((coluna) => (
                <th
                  key={coluna}
                  className={`border-b px-2 py-2 text-left text-xs font-medium text-muted-foreground sm:px-4 ${coluna === 'Caminho' || coluna === 'Objeto' ? 'hidden lg:table-cell' : ''}`}
                >
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando atividades...
                </td>
              </tr>
            ) : visiveis.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {consultou ? (
                    <div className="flex flex-col items-center gap-2">
                      <IconeAtividades className="h-8 w-8 text-muted-foreground" />
                      <span>Nenhuma atividade encontrada.</span>
                    </div>
                  ) : (
                    'Informe os filtros e consulte.'
                  )}
                </td>
              </tr>
            ) : (
              visiveis.map((linha) => (
                <tr key={linha.id} className="border-b">
                  <td className="px-4 py-2 text-sm">{dataHora(linha.criadoEm)}</td>
                  <td className="px-4 py-2 text-sm">
                    {linha.login || '-'}
                    {linha.usuarioId ? <span className="text-muted-foreground"> #{linha.usuarioId}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-sm">{linha.metodo}</td>
                  <td className="px-4 py-2 text-sm">{linha.acao}</td>
                  <td className="hidden max-w-[280px] truncate px-4 py-2 text-sm lg:table-cell">{linha.caminho}</td>
                  <td className="hidden px-4 py-2 text-sm lg:table-cell">{linha.objeto || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
        <span>{linhas.length > 0 ? `Página ${paginaAtual + 1} de ${totalPaginas} • ${linhas.length} atividade${linhas.length === 1 ? '' : 's'}` : ' '}</span>
        {linhas.length > PAGE_SIZE && (
          <div className="flex gap-2">
            <button type="button" className="rounded-md border px-3 py-1" disabled={paginaAtual === 0} onClick={() => setPagina((atual) => Math.max(0, atual - 1))}>
              Anterior
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1"
              disabled={paginaAtual >= totalPaginas - 1}
              onClick={() => setPagina((atual) => Math.min(totalPaginas - 1, atual + 1))}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
