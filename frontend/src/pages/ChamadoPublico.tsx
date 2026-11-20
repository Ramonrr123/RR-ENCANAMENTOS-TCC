import { FormEvent, useMemo, useRef, useState } from 'react'

const TIPOS = ['Vazamento', 'Entupimento', 'Sem água', "Caixa d'água", 'Aquecedor', 'Outro'] as const
const ETAPAS = ['Aberto', 'Em atendimento', 'Em execução', 'Concluído'] as const

type Andamento = {
  numero: number
  tipo: string
  cidade: string
  uf: string
  etapa: number
  cancelado: boolean
  eventos: { quando: string; texto: string }[]
}

type Tipo = (typeof TIPOS)[number]
type Whatsapp = 'celular' | 'fixo' | 'invalido' | 'vazio'

type Formulario = {
  tipo: Tipo | ''
  descricao: string
  nome: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
}

const VAZIO: Formulario = {
  tipo: '',
  descricao: '',
  nome: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
}

function apiUrl() {
  const fallback = import.meta.env.PROD ? '/api' : 'http://127.0.0.1:3001'
  return String(import.meta.env.VITE_API_URL || fallback).replace(/\/+$/, '')
}

function digitos(valor: string) {
  const bruto = valor.replace(/\D/g, '')
  return bruto.startsWith('55') && bruto.length > 11 ? bruto.slice(2) : bruto
}

function classificarWhatsapp(valor: string): Whatsapp {
  const numero = digitos(valor)
  if (!numero) return 'vazio'
  if (numero.length === 11 && numero[2] === '9') return 'celular'
  if (numero.length === 10) return 'fixo'
  return 'invalido'
}

function mascaraTelefone(valor: string) {
  const numero = digitos(valor).slice(0, 11)
  if (numero.length <= 2) return numero
  if (numero.length <= 6) return `(${numero.slice(0, 2)}) ${numero.slice(2)}`
  if (numero.length <= 10) return `(${numero.slice(0, 2)}) ${numero.slice(2, 6)}-${numero.slice(6)}`
  return `(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}`
}

function mascaraCep(valor: string) {
  const numero = valor.replace(/\D/g, '').slice(0, 8)
  if (numero.length <= 5) return numero
  return `${numero.slice(0, 5)}-${numero.slice(5)}`
}

const ORIGENS_OK = new Set(['site', 'whatsapp', 'indicacao', 'outro'])

function origemDaUrl() {
  try {
    const valor = new URLSearchParams(window.location.search).get('origem') || 'site'
    const normalizado = valor.trim().toLowerCase()
    return ORIGENS_OK.has(normalizado) ? normalizado : 'site'
  } catch {
    return 'site'
  }
}

export default function ChamadoPublico() {
  const [passo, setPasso] = useState(1)
  const [form, setForm] = useState<Formulario>(VAZIO)
  const [erro, setErro] = useState('')
  const [cepEstado, setCepEstado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [protocolo, setProtocolo] = useState<number | null>(null)
  const [senha, setSenha] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [modo, setModo] = useState<'abrir' | 'consultar'>('abrir')
  const [consultaNumero, setConsultaNumero] = useState('')
  const [consultaSenha, setConsultaSenha] = useState('')
  const [andamento, setAndamento] = useState<Andamento | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [aceite, setAceite] = useState(false)
  const [website, setWebsite] = useState('')
  const iniciadoEm = useRef(Date.now())
  const origem = useMemo(() => origemDaUrl(), [])

  const whatsapp = useMemo(() => classificarWhatsapp(form.telefone), [form.telefone])

  function atualizar(campo: keyof Formulario, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
    setErro('')
  }

  function avancar() {
    if (passo === 1) {
      if (!form.tipo) return setErro('Escolha o que está acontecendo.')
      if (form.descricao.trim().length < 10) return setErro('Descreva o problema com pelo menos 10 caracteres.')
    }
    if (passo === 2) {
      if (form.nome.trim().length < 2) return setErro('Informe o nome.')
      if (whatsapp === 'invalido' || whatsapp === 'vazio') {
        return setErro('Informe um celular com DDD, no formato (00) 90000-0000.')
      }
    }
    if (passo === 3) {
      if (digitos(form.cep).length !== 8) return setErro('Informe o CEP com 8 números.')
      if (form.logradouro.trim().length < 3 || !form.numero.trim() || form.cidade.trim().length < 2 || form.uf.trim().length !== 2) {
        return setErro('Complete o endereço, o número, a cidade e a UF.')
      }
    }
    setErro('')
    setPasso((atual) => Math.min(4, atual + 1))
  }

  async function buscarCep() {
    const cep = digitos(form.cep)
    if (cep.length !== 8) return setErro('Informe o CEP com 8 números.')
    setCepEstado('Buscando...')
    setErro('')
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const dados = await resposta.json()
      if (!resposta.ok || dados.erro) {
        setCepEstado('')
        setErro('CEP não encontrado. Preencha o endereço.')
        return
      }
      setForm((atual) => ({
        ...atual,
        logradouro: dados.logradouro || atual.logradouro,
        bairro: dados.bairro || atual.bairro,
        cidade: dados.localidade || atual.cidade,
        uf: dados.uf || atual.uf,
      }))
      setCepEstado(`${dados.localidade} - ${dados.uf}`)
    } catch {
      setCepEstado('')
      setErro('Não foi possível consultar o CEP agora. Preencha o endereço.')
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!aceite) {
      setErro('Marque o aviso de privacidade para enviar o chamado.')
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const resposta = await fetch(`${apiUrl()}/chamados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: form.tipo,
          nome: form.nome.trim(),
          telefone: form.telefone,
          cep: digitos(form.cep),
          logradouro: form.logradouro.trim(),
          numero: form.numero.trim(),
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf.trim().toUpperCase(),
          descricao: form.descricao.trim(),
          aceite: true,
          startedAt: iniciadoEm.current,
          website,
          origem,
        }),
      })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        const mensagem = Array.isArray(dados.message) ? dados.message[0] : dados.message
        throw new Error(mensagem || 'Não foi possível abrir o chamado.')
      }
      setProtocolo(Number(dados.numero))
      setSenha(String(dados.senha || ''))
      setCopiado(false)
      setAndamento(null)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível abrir o chamado.')
    } finally {
      setEnviando(false)
    }
  }

  async function copiarAcesso() {
    if (!protocolo || !senha) return
    const texto = `Chamado ${String(protocolo).padStart(4, '0')}\nSenha: ${senha}`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      setErro('Não foi possível copiar. Anote o número e a senha que estão na tela.')
    }
  }

  async function consultar(evento?: FormEvent, numeroPronto?: number, senhaPronta?: string) {
    evento?.preventDefault()
    const numero = numeroPronto ?? Number(consultaNumero.replace(/\D/g, ''))
    const senhaConsulta = (senhaPronta ?? consultaSenha).trim()
    if (!Number.isInteger(numero) || numero < 1 || senhaConsulta.length < 6) {
      setErro('Informe o número do chamado e a senha.')
      return
    }
    setConsultando(true)
    setErro('')
    try {
      const resposta = await fetch(`${apiUrl()}/chamados/consulta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, senha: senhaConsulta }),
      })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) {
        const mensagem = Array.isArray(dados.message) ? dados.message[0] : dados.message
        throw new Error(mensagem || 'Não foi possível consultar o chamado.')
      }
      setAndamento(dados as Andamento)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível consultar o chamado.')
    } finally {
      setConsultando(false)
    }
  }

  if (andamento) {
    return <AndamentoChamado andamento={andamento} onVoltar={() => setAndamento(null)} />
  }

  if (protocolo && senha) {
    return (
      <main className="flex min-h-screen items-center bg-[#f6f7f9] px-4 py-10 text-slate-900">
        <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <img src="/logo-rr-encanamentos.png?v=2" alt="RR Encanamentos" className="mx-auto h-20 w-auto object-contain" />
          <p className="mt-6 text-sm font-medium text-[#e10600]">Chamado recebido</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Chamado {String(protocolo).padStart(4, '0')}</h1>
          <p className="mt-6 text-sm text-slate-500">Senha de consulta</p>
          <p className="mt-1 break-all font-mono text-2xl font-semibold tracking-[0.2em] sm:text-3xl">{senha}</p>
          <button type="button" onClick={copiarAcesso} className="mt-5 w-full rounded-full bg-[#e10600] py-3 text-sm font-semibold text-white hover:bg-[#b00012]">
            {copiado ? 'Número e senha copiados' : 'Copiar número e senha'}
          </button>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Guarde o número do chamado e esta senha. Os dois são necessários para consultar o andamento depois.
          </p>
          <button
            type="button"
            onClick={() => consultar(undefined, protocolo, senha)}
            disabled={consultando}
            className="mt-4 text-sm font-medium text-[#e10600] underline disabled:opacity-60"
          >
            {consultando ? 'Abrindo...' : 'Ver andamento agora'}
          </button>
          {erro && <p className="mt-3 text-sm text-[#e10600]" role="alert">{erro}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-8 text-slate-900">
      <form
        className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col"
        onSubmit={(evento) => {
          if (modo === 'consultar') void consultar(evento)
          else void enviar(evento)
        }}
      >
        <header className="text-center">
          <img src="/logo-rr-encanamentos.png?v=2" alt="RR Encanamentos" className="mx-auto h-24 w-auto object-contain sm:h-28" />
          <h1 className="mt-4 text-2xl font-semibold">{modo === 'consultar' ? 'Consulte o chamado' : 'Abra um chamado'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {modo === 'consultar'
              ? 'Use o número e a senha que você guardou na abertura.'
              : 'Conte o que está acontecendo. A equipe retorna no contato informado.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setModo((atual) => (atual === 'abrir' ? 'consultar' : 'abrir'))
              setErro('')
            }}
            className="mt-3 text-sm font-medium text-[#e10600] underline"
          >
            {modo === 'consultar' ? 'Abrir um chamado novo' : 'Consultar um chamado'}
          </button>
        </header>

        {modo === 'consultar' ? (
          <section className="mt-8 flex-1">
            <label className="block text-sm text-slate-600" htmlFor="consulta-numero">Número do chamado</label>
            <input
              id="consulta-numero"
              inputMode="numeric"
              value={consultaNumero}
              onChange={(evento) => {
                setConsultaNumero(evento.target.value.replace(/\D/g, '').slice(0, 6))
                setErro('')
              }}
              placeholder="0001"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]"
            />
            <label className="mt-4 block text-sm text-slate-600" htmlFor="consulta-senha">Senha</label>
            <input
              id="consulta-senha"
              value={consultaSenha}
              onChange={(evento) => {
                setConsultaSenha(evento.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 8))
                setErro('')
              }}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="8 caracteres"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]"
            />
            <p className="mt-4 text-sm leading-6 text-slate-600">A senha nova tem 8 caracteres, sem os que se confundem (0, O, 1, I). A senha antiga, de 6 números, continua valendo.</p>
            {erro && <p className="mt-4 text-sm text-[#e10600]" role="alert">{erro}</p>}
            <button type="submit" disabled={consultando} className="mt-6 w-full rounded-full bg-[#e10600] py-3 text-sm font-semibold text-white hover:bg-[#b00012] disabled:opacity-60">
              {consultando ? 'Consultando...' : 'Ver andamento'}
            </button>
          </section>
        ) : (
        <>
        <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Site</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(evento) => setWebsite(evento.target.value)} />
        </div>
        <ol className="mx-auto mt-8 flex items-center gap-3" aria-label="Etapas">
          {[1, 2, 3, 4].map((numero, indice) => (
            <li key={numero} className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${passo === numero ? 'bg-[#e10600] text-white' : passo > numero ? 'bg-red-100 text-[#e10600]' : 'bg-white text-slate-400 ring-1 ring-slate-200'}`}>
                {numero}
              </span>
              {indice < 3 && <span className="h-px w-6 bg-slate-300" />}
            </li>
          ))}
        </ol>

        <section className="mt-8 flex-1">
          {passo === 1 && (
            <div>
              {origem === 'whatsapp' ? (
                <p className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  Você veio pelo WhatsApp? Preencha aqui para a equipe receber o seu pedido completo.
                </p>
              ) : null}
              <h2 className="text-lg font-medium">O que está acontecendo?</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {TIPOS.map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => atualizar('tipo', tipo)}
                    className={`rounded-2xl border bg-white px-3 py-4 text-left text-sm shadow-sm ${form.tipo === tipo ? 'border-[#e10600] bg-red-50 text-[#e10600]' : 'border-slate-200'}`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
              <label className="mt-5 block text-sm text-slate-600" htmlFor="descricao">Descrição</label>
              <textarea
                id="descricao"
                value={form.descricao}
                onChange={(evento) => atualizar('descricao', evento.target.value)}
                rows={4}
                maxLength={800}
                placeholder="Onde está o vazamento, desde quando, se a água está fechada..."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]"
              />
            </div>
          )}

          {passo === 2 && (
            <div>
              <h2 className="text-lg font-medium">Seus dados</h2>
              <label className="mt-4 block text-sm text-slate-600" htmlFor="nome">Nome</label>
              <input id="nome" value={form.nome} onChange={(evento) => atualizar('nome', evento.target.value)} maxLength={120} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]" />
              <label className="mt-4 block text-sm text-slate-600" htmlFor="telefone">WhatsApp ou telefone</label>
              <input
                id="telefone"
                inputMode="tel"
                value={form.telefone}
                onChange={(evento) => atualizar('telefone', mascaraTelefone(evento.target.value))}
                placeholder="(00) 90000-0000"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]"
              />
              <AvisoWhatsapp estado={whatsapp} />
            </div>
          )}

          {passo === 3 && (
            <div>
              <h2 className="text-lg font-medium">Onde vamos atender</h2>
              <label className="mt-4 block text-sm text-slate-600" htmlFor="cep">CEP</label>
              <div className="mt-2 flex gap-2">
                <input id="cep" inputMode="numeric" value={form.cep} onChange={(evento) => atualizar('cep', mascaraCep(evento.target.value))} placeholder="00000-000" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]" />
                <button type="button" onClick={buscarCep} className="shrink-0 rounded-2xl bg-[#e10600] px-4 text-sm font-medium text-white">Buscar</button>
              </div>
              {cepEstado && <p className="mt-2 text-sm text-[#e10600]">{cepEstado}</p>}
              <Campo id="logradouro" label="Endereço" value={form.logradouro} onChange={(valor) => atualizar('logradouro', valor)} />
              <div className="grid grid-cols-2 gap-3">
                <Campo id="numero" label="Número" value={form.numero} onChange={(valor) => atualizar('numero', valor)} />
                <Campo id="bairro" label="Bairro" value={form.bairro} onChange={(valor) => atualizar('bairro', valor)} />
              </div>
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <Campo id="cidade" label="Cidade" value={form.cidade} onChange={(valor) => atualizar('cidade', valor)} />
                <Campo id="uf" label="UF" value={form.uf} onChange={(valor) => atualizar('uf', valor.toUpperCase().slice(0, 2))} />
              </div>
            </div>
          )}

          {passo === 4 && (
            <div>
              <h2 className="text-lg font-medium">Confira o chamado</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Item termo="Problema" valor={`${form.tipo}. ${form.descricao}`} />
                <Item termo="Cliente" valor={`${form.nome} · ${form.telefone}`} />
                <Item termo="WhatsApp" valor={form.telefone} />
                {whatsapp === 'fixo' && (
                  <p className="text-sm leading-6 text-amber-700">Linha fixa: o WhatsApp não atende este número.</p>
                )}
                {whatsapp === 'celular' && (
                  <p className="text-sm leading-6 text-slate-500">Celular no formato do WhatsApp.</p>
                )}
                <Item termo="Endereço" valor={`${form.logradouro}, ${form.numero}${form.bairro ? ` - ${form.bairro}` : ''} · ${form.cidade} - ${form.uf} · CEP ${form.cep}`} />
              </dl>
              {/* TODO-juridico: confirmar o prazo de retenção (proposta: 5 anos após encerramento) com o responsável legal. */}
              <aside id="aviso-privacidade" className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <h3 className="font-medium text-slate-900">Aviso de privacidade</h3>
                <p className="mt-2">
                  Coletamos o seu nome, telefone, endereço e a descrição do problema para atender o pedido de serviço.
                  O endereço IP de origem também é registrado para prevenir abuso do formulário.
                  Quem vê esses dados é a equipe da empresa.
                  Proposta de retenção: os dados pessoais ficam guardados por até 5 anos após o encerramento do atendimento;
                  depois disso podem ser anonimizados, mantendo o número do chamado e os registros do serviço.
                  Você pode pedir à empresa que apague ou anonimize esses dados antes desse prazo.
                </p>
                <p className="mt-2">
                  <a href="/privacidade" target="_blank" rel="noreferrer" className="text-[#e10600] underline">
                    Política de privacidade
                  </a>
                </p>
                <label className="mt-3 flex items-start gap-3">
                  <input
                    id="aceite-privacidade"
                    type="checkbox"
                    checked={aceite}
                    onChange={(evento) => {
                      setAceite(evento.target.checked)
                      setErro('')
                    }}
                    className="mt-1"
                  />
                  <span>Li o aviso e aceito o uso desses dados para o atendimento.</span>
                </label>
              </aside>
            </div>
          )}

          {erro && <p className="mt-4 text-sm text-[#e10600]" role="alert">{erro}</p>}
        </section>

        <div className="mt-6 flex gap-3">
          {passo > 1 && (
            <button type="button" onClick={() => setPasso((atual) => atual - 1)} className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm">
              Voltar
            </button>
          )}
          {passo < 4 ? (
            <button type="button" onClick={avancar} className="flex-1 rounded-full bg-[#e10600] py-3 text-sm font-semibold text-white hover:bg-[#b00012]">
              Continuar
            </button>
          ) : (
            <button type="submit" disabled={enviando} className="flex-1 rounded-full bg-[#e10600] py-3 text-sm font-semibold text-white hover:bg-[#b00012] disabled:opacity-60">
              {enviando ? 'Enviando...' : 'Enviar chamado'}
            </button>
          )}
        </div>
        </>
        )}
      </form>
      <p className="mx-auto mt-8 max-w-xl text-center text-xs text-slate-500">
        <a href="/privacidade" className="underline hover:text-[#e10600]">Política de privacidade</a>
      </p>
    </main>
  )
}

function AndamentoChamado({ andamento, onVoltar }: { andamento: Andamento; onVoltar: () => void }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-8 text-slate-900">
      <article className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-8">
        <img src="/logo-rr-encanamentos.png?v=2" alt="RR Encanamentos" className="mx-auto h-16 w-auto object-contain" />
        <p className="mt-5 text-center text-lg font-medium text-[#e10600]">Chamado {String(andamento.numero).padStart(4, '0')}</p>
        <ol className="mt-8 flex items-start justify-between gap-1" aria-label="Andamento">
          {ETAPAS.map((nome, indice) => {
            const feito = indice < andamento.etapa
            const atual = indice === andamento.etapa && !andamento.cancelado
            const ativo = feito || atual
            return (
              <li key={nome} className="relative flex flex-1 flex-col items-center text-center">
                {indice > 0 && (
                  <span className={`absolute right-1/2 top-5 h-0.5 w-full ${indice <= andamento.etapa && !andamento.cancelado ? 'bg-[#e10600]' : 'bg-slate-200'}`} />
                )}
                <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${ativo ? 'bg-[#e10600] text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {feito ? '✓' : indice + 1}
                </span>
                <span className="mt-2 text-[11px] leading-4 text-slate-600">{nome}</span>
              </li>
            )
          })}
        </ol>
        {andamento.cancelado && <p className="mt-6 text-center text-sm font-medium text-[#e10600]">Atendimento cancelado</p>}
        <dl className="mt-8 grid grid-cols-2 gap-4 border-y border-slate-200 py-4 text-sm">
          <div>
            <dt className="text-slate-500">Problema</dt>
            <dd className="mt-1 font-medium">{andamento.tipo}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Cidade</dt>
            <dd className="mt-1 font-medium">{andamento.cidade}-{andamento.uf}</dd>
          </div>
        </dl>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-slate-700">
              <th className="py-2 pr-3 font-semibold">Data / Hora</th>
              <th className="py-2 font-semibold">Ocorrência</th>
            </tr>
          </thead>
          <tbody>
            {andamento.eventos.map((evento) => (
              <tr key={`${evento.quando}-${evento.texto}`} className="border-b border-slate-100">
                <td className="py-3 pr-3 align-top text-slate-600">{formatarData(evento.quando)}</td>
                <td className="py-3 align-top font-medium text-[#e10600]">{evento.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-center text-sm leading-6 text-slate-600">Guarde a senha do chamado para consultar o andamento de novo.</p>
        <button type="button" onClick={onVoltar} className="mt-4 w-full rounded-full border border-slate-300 py-3 text-sm">
          Voltar
        </button>
      </article>
    </main>
  )
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function AvisoWhatsapp({ estado }: { estado: Whatsapp }) {
  if (estado === 'vazio') return <p className="mt-3 text-sm leading-6 text-slate-500">Celular com DDD pode receber WhatsApp. Linha fixa não.</p>
  if (estado === 'celular') return null
  if (estado === 'fixo') return <p className="mt-3 text-sm leading-6 text-amber-700">Este número é de linha fixa. O WhatsApp não atende linha fixa.</p>
  return <p className="mt-3 text-sm leading-6 text-amber-700">Ainda falta DDD ou dígitos. Celular: 11 números, começando com 9 depois do DDD.</p>
}

function Campo({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (valor: string) => void }) {
  return (
    <div>
      <label className="mt-4 block text-sm text-slate-600" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(evento) => onChange(evento.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e10600]" />
    </div>
  )
}

function Item({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-slate-500">{termo}</dt>
      <dd className="mt-1">{valor}</dd>
    </div>
  )
}
