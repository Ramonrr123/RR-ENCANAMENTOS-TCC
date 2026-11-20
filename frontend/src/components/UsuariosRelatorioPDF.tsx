import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export type UsuarioRelatorioRow = {
  nome: string
  login: string
  ativo: boolean
  grupo: string
}

const NAVY = '#1e3a5f'
const NAVY_DEEP = '#152a45'
const MUTED = '#64748b'
const LINE = '#c5d0de'
const ROW_ALT = '#f3f6fa'
const TOTALS_BG = '#e8eef5'

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function docCode(iso: string) {
  const d = new Date(iso)
  const stamp = Number.isNaN(d.getTime())
    ? '--------'
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `REL-USR-${stamp}`
}

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: NAVY,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topLeft: { flex: 1, paddingRight: 12 },
  topRight: { width: 180, alignItems: 'flex-end' },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: '#7a93b0',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Times-Bold',
    color: NAVY,
    marginBottom: 4,
  },
  subtitle: { fontSize: 9, color: MUTED },
  metaLine: {
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'right',
    marginBottom: 2,
  },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    marginBottom: 12,
    marginTop: 4,
  },
  metrics: { flexDirection: 'row', marginBottom: 12 },
  metricCol: {
    flex: 1,
    paddingHorizontal: 5,
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  metricColLast: { flex: 1, paddingHorizontal: 5 },
  metricLabel: {
    fontSize: 6,
    letterSpacing: 0.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  metricHint: { fontSize: 6.5, color: MUTED },
  box: {
    backgroundColor: TOTALS_BG,
    padding: 8,
    marginBottom: 12,
  },
  boxTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  boxText: { fontSize: 8, color: MUTED },
  sectionHead: {
    marginTop: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sectionCount: { fontSize: 8, color: MUTED },
  th: {
    flexDirection: 'row',
    backgroundColor: NAVY_DEEP,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  thCell: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  trAlt: { backgroundColor: ROW_ALT },
  td: { fontSize: 7.5, color: NAVY },
  tdBold: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: NAVY },
  ativoSim: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#166534' },
  ativoNao: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#b91c1c' },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLeft: { flex: 1, fontSize: 6.5, color: MUTED, paddingRight: 10 },
  footerRight: { fontSize: 7, color: MUTED, textAlign: 'right' },
})

function Metric({
  label,
  value,
  hint,
  last,
}: {
  label: string
  value: string
  hint: string
  last?: boolean
}) {
  return (
    <View style={last ? s.metricColLast : s.metricCol}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricHint}>{hint}</Text>
    </View>
  )
}

export function UsuariosRelatorioPDF({
  rows,
  geradoEm,
  empresaLabel,
}: {
  rows: UsuarioRelatorioRow[]
  geradoEm: string
  empresaLabel?: string
}) {
  const docId = docCode(geradoEm)
  const ativos = rows.filter((r) => r.ativo).length
  const inativos = rows.length - ativos

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topRow}>
          <View style={s.topLeft}>
            <Text style={s.eyebrow}>Configurações • Usuários</Text>
            <Text style={s.title}>Relatório de Usuários</Text>
            <Text style={s.subtitle}>Nome, login, situação e grupo de acesso</Text>
          </View>
          <View style={s.topRight}>
            <Text style={s.metaLine}>Emissão: {fmtDateTime(geradoEm)}</Text>
            {empresaLabel ? <Text style={s.metaLine}>Empresa {empresaLabel}</Text> : null}
            <Text style={s.metaLine}>Documento {docId}</Text>
          </View>
        </View>
        <View style={s.rule} />

        <View style={s.metrics}>
          <Metric label="Usuários" value={String(rows.length)} hint="Registros no relatório" />
          <Metric label="Ativos" value={String(ativos)} hint="Status ATIVO" />
          <Metric label="Inativos" value={String(inativos)} hint="Status DESLIGADO" last />
        </View>

        <View style={s.box}>
          <Text style={s.boxTitle}>Escopo do relatório</Text>
          <Text style={s.boxText}>
            Lista de usuários do sistema com nome, login, se está ativo e o grupo de
            acesso. {empresaLabel ? `Empresa ${empresaLabel}. ` : ''}
            Total de {rows.length} registro(s).
          </Text>
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>01 Usuários</Text>
          <Text style={s.sectionCount}>{rows.length} registro(s)</Text>
        </View>
        <View style={s.th}>
          <Text style={[s.thCell, { width: '34%' }]}>Nome</Text>
          <Text style={[s.thCell, { width: '32%' }]}>Login</Text>
          <Text style={[s.thCell, { width: '14%' }]}>Está ativo</Text>
          <Text style={[s.thCell, { width: '20%' }]}>Grupo</Text>
        </View>
        {rows.map((row, i) => (
          <View key={`${row.login}-${i}`} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]} wrap={false}>
            <Text style={[s.tdBold, { width: '34%' }]}>{row.nome || '—'}</Text>
            <Text style={[s.td, { width: '32%' }]}>{row.login || '—'}</Text>
            <Text style={[row.ativo ? s.ativoSim : s.ativoNao, { width: '14%' }]}>
              {row.ativo ? 'Sim' : 'Não'}
            </Text>
            <Text style={[s.td, { width: '20%' }]}>{row.grupo || '—'}</Text>
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>
            Relatório de usuários do sistema. Colunas: nome, login, está ativo e grupo.
          </Text>
          <Text
            style={s.footerRight}
            render={({ pageNumber, totalPages }) =>
              `${docId} · ${fmtDateTime(geradoEm)}\nPágina ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
