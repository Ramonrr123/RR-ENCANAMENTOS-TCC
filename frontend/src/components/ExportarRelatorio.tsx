import { useState, type ReactElement } from 'react'
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { HiDocumentText } from 'react-icons/hi'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { baixarArquivo } from '@/lib/baixarArquivo'
import { api } from '@/services/api'

type Tipo = 'ordens' | 'estoque' | 'fluxo'

const estilos = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: 'Helvetica' },
  titulo: { fontSize: 16, marginBottom: 4 },
  subtitulo: { fontSize: 9, marginBottom: 12, color: '#475569' },
  linha: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: '#cbd5e1', paddingVertical: 3 },
  cabeca: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e3a5f', paddingBottom: 4, marginBottom: 2 },
  celula: { flex: 1, paddingRight: 4 },
})

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBr(valor: string | null | undefined) {
  if (!valor) return '-'
  const [ano, mes, dia] = valor.split('-')
  if (!ano || !mes || !dia) return valor
  return `${dia}/${mes}/${ano}`
}

function PdfTabela({ titulo, subtitulo, colunas, linhas }: { titulo: string; subtitulo: string; colunas: string[]; linhas: string[][] }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={estilos.page}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <Text style={estilos.subtitulo}>{subtitulo}</Text>
        <View style={estilos.cabeca}>
          {colunas.map((coluna) => (
            <Text key={coluna} style={estilos.celula}>{coluna}</Text>
          ))}
        </View>
        {linhas.length === 0 ? <Text>Nenhum registro.</Text> : linhas.map((linha, indice) => (
          <View key={indice} style={estilos.linha}>
            {linha.map((celula, coluna) => (
              <Text key={coluna} style={estilos.celula}>{celula}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}

export function ExportarRelatorio({
  tipo,
  de,
  ate,
  situacao,
  showToast,
  className,
}: {
  tipo: Tipo
  de?: string
  ate?: string
  situacao?: string
  showToast: (message: string, type?: 'success' | 'error') => void
  className?: string
}) {
  const [exportando, setExportando] = useState<'csv' | 'pdf' | null>(null)
  const [aberto, setAberto] = useState(false)

  function intervaloValido() {
    if (tipo === 'estoque') return true
    if (tipo === 'ordens' && !de && !ate) return true
    return Boolean(de && ate && /^\d{4}-\d{2}-\d{2}$/.test(de) && /^\d{4}-\d{2}-\d{2}$/.test(ate) && de <= ate)
  }

  async function exportarCsv() {
    if (!intervaloValido()) {
      showToast('Informe um intervalo válido.', 'error')
      return
    }
    setExportando('csv')
    const query = new URLSearchParams({ format: 'csv' })
    let caminho = '/relatorios/estoque?format=csv'
    let nome = 'relatorio-estoque.csv'
    if (tipo === 'ordens') {
      query.set('de', de || '')
      query.set('ate', ate || '')
      if (situacao) query.set('situacao', situacao)
      caminho = `/relatorios/ordens?${query}`
      nome = 'relatorio-ordens.csv'
    } else if (tipo === 'fluxo') {
      query.set('de', de || '')
      query.set('ate', ate || '')
      caminho = `/relatorios/fluxo-caixa?${query}`
      nome = 'relatorio-fluxo-caixa.csv'
    }
    const response = await api.baixarCsv(caminho, nome)
    if (response.error) showToast(response.error, 'error')
    setExportando(null)
  }

  async function exportarPdf() {
    if (!intervaloValido()) {
      showToast('Informe um intervalo válido.', 'error')
      return
    }
    setExportando('pdf')
    let documento: ReactElement | null = null
    let nome = 'relatorio.pdf'
    if (tipo === 'ordens') {
      const response = await api.getRelatorioOrdens({ de, ate, situacao })
      if (!response.data) {
        if (response.error) showToast(response.error, 'error')
        setExportando(null)
        return
      }
      documento = (
        <PdfTabela
          titulo="Ordens de serviço"
          subtitulo={`${dataBr(de)} a ${dataBr(ate)}`}
          colunas={['Nº', 'Cliente', 'Situação', 'Abertura', 'Encerramento', 'Garantia', 'Total', 'Entrada', 'Saldo parcelado', 'Taxa', 'Mão de obra', 'Desloc.', 'Material']}
          linhas={response.data.linhas.map((linha) => [
            String(linha.numero),
            linha.cliente,
            linha.situacao,
            dataBr(linha.dataAbertura),
            dataBr(linha.dataEncerramento),
            dataBr(linha.garantiaAte),
            moeda(linha.total),
            moeda(linha.entrada),
            moeda(linha.saldoParcelado),
            moeda(linha.taxa),
            moeda(linha.maoDeObra),
            moeda(linha.deslocamento),
            moeda(linha.material),
          ])}
        />
      )
      nome = 'relatorio-ordens.pdf'
    } else if (tipo === 'estoque') {
      const response = await api.getRelatorioEstoque()
      if (!response.data) {
        if (response.error) showToast(response.error, 'error')
        setExportando(null)
        return
      }
      documento = (
        <PdfTabela
          titulo="Estoque"
          subtitulo="Saldo atual dos produtos"
          colunas={['Código', 'Descrição', 'Unidade', 'Estoque']}
          linhas={response.data.linhas.map((linha) => [linha.codigo, linha.descricao, linha.unidade, linha.estoque.toLocaleString('pt-BR')])}
        />
      )
      nome = 'relatorio-estoque.pdf'
    } else {
      const response = await api.getFluxoCaixa(de || '', ate || '')
      if (!response.data) {
        if (response.error) showToast(response.error, 'error')
        setExportando(null)
        return
      }
      documento = (
        <PdfTabela
          titulo="Fluxo de caixa"
          subtitulo={`${dataBr(de)} a ${dataBr(ate)}`}
          colunas={['Mês', 'Entradas previstas', 'Saídas previstas', 'Entradas realizadas', 'Saídas realizadas']}
          linhas={[
            ...response.data.meses.map((mes) => [
              mes.mes,
              moeda(mes.entradasPrevistas),
              moeda(mes.saidasPrevistas),
              moeda(mes.entradasRealizadas),
              moeda(mes.saidasRealizadas),
            ]),
            [
              'Total',
              moeda(response.data.totais.entradasPrevistas),
              moeda(response.data.totais.saidasPrevistas),
              moeda(response.data.totais.entradasRealizadas),
              moeda(response.data.totais.saidasRealizadas),
            ],
          ]}
        />
      )
      nome = 'relatorio-fluxo-caixa.pdf'
    }
    const blob = await pdf(documento).toBlob()
    const resultado = await baixarArquivo(blob, nome)
    if (resultado === 'aborted') {
      setExportando(null)
      return
    }
    showToast(
      resultado === 'shared'
        ? 'Relatório pronto para salvar ou compartilhar.'
        : 'Relatório gerado. Se não baixou sozinho, use Salvar/Compartilhar na tela aberta.',
      'success',
    )
    setExportando(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={exportando !== null}
        className={
          className ||
          'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50'
        }
      >
        <HiDocumentText className="h-4 w-4 shrink-0" />
        {exportando ? 'Gerando...' : 'Gerar relatório'}
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="z-[80] max-w-sm rounded-2xl p-5 sm:rounded-2xl">
          <DialogHeader className="pr-6 text-left">
            <DialogTitle>Deseja gerar em</DialogTitle>
            <DialogDescription>Escolha o formato do relatório.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={exportando !== null}
              onClick={() => {
                setAberto(false)
                void exportarPdf()
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1d4ed8] px-3 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {exportando === 'pdf' ? 'Gerando...' : 'PDF'}
            </button>
            <button
              type="button"
              disabled={exportando !== null}
              onClick={() => {
                setAberto(false)
                void exportarCsv()
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#eef2f6] px-3 py-3 text-sm font-medium text-[#334155] disabled:opacity-50"
            >
              {exportando === 'csv' ? 'Gerando...' : 'CSV'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
