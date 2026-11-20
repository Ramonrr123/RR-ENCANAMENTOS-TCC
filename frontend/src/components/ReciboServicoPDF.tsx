import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { EMPRESA_RECIBO, dataRecibo, formatarMoeda, valorPorExtenso, type OrdemServico } from '@/lib/reciboServico'

Font.registerHyphenationCallback((word) => [word])

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 54,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#111111',
  },
  marca: {
    position: 'absolute',
    top: 250,
    left: 108,
    width: 380,
  },
  logoCaixa: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 132,
    height: 132,
  },
  titulo: {
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    marginBottom: 22,
  },
  paragrafo: {
    textAlign: 'justify',
    lineHeight: 1.45,
    marginBottom: 16,
  },
  item: {
    marginLeft: 14,
    marginBottom: 8,
    lineHeight: 1.35,
  },
  total: {
    marginTop: 8,
    fontFamily: 'Helvetica-Bold',
  },
  rodape: {
    marginTop: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  blocoEmpresa: {
    width: 230,
  },
  assinaturaEmpresa: {
    width: 118,
    height: 32,
    marginBottom: 2,
  },
  linha: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginBottom: 4,
    width: 170,
  },
  responsavel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  empresaLinha: {
    fontSize: 10,
    lineHeight: 1.35,
  },
  blocoCliente: {
    width: 220,
    alignItems: 'flex-end',
  },
  assinaturaCliente: {
    width: 170,
    height: 52,
    objectFit: 'contain',
    marginBottom: 2,
  },
  linhaCliente: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    marginBottom: 4,
    width: 180,
  },
  rotuloAssinatura: {
    fontSize: 9,
    marginBottom: 2,
  },
  nomeCliente: {
    fontSize: 10,
    marginBottom: 8,
    textAlign: 'right',
  },
  data: {
    fontSize: 11,
    textAlign: 'right',
  },
})

type ReciboServicoPdfProps = {
  ordem: OrdemServico
  logo: string
  marca: string
  assinaturaEmpresa: string
}

export function ReciboServicoPdf({ ordem, logo, marca, assinaturaEmpresa }: ReciboServicoPdfProps) {
  const total = ordem.total
  const extenso = valorPorExtenso(total)
  const situado = ordem.endereco.trim() ? `, situado a ${ordem.endereco.trim()}` : ''

  return (
    <Document title={`Recibo ${String(ordem.numero).padStart(4, '0')}`}>
      <Page size="A4" style={s.page}>
        <Image src={marca} style={s.marca} />
        <View style={s.logoCaixa}>
          <Image src={logo} style={s.logo} />
        </View>
        <Text style={s.titulo}>RECIBO DE PRESTAÇÃO DE SERVIÇO</Text>
        <Text style={s.paragrafo}>
          {`Declaramos para os devidos fins que a empresa ${EMPRESA_RECIBO.nome}, inscrita no CNPJ nº ${EMPRESA_RECIBO.cnpj}, recebeu ${ordem.cliente}${situado}, a importância de ${formatarMoeda(total)} (${extenso}), referente ao pagamento pelos serviços de:`}
        </Text>
        {ordem.vistoria.trim() ? <Text style={s.paragrafo}>{`Vistoria: ${ordem.vistoria.trim()}`}</Text> : null}
        {ordem.servicos.map((servico, indice) => (
          <Text key={`${indice}-${servico}`} style={s.item}>{`•  ${servico}`}</Text>
        ))}
        {ordem.taxaVistoria > 0 ? (
          <Text style={s.item}>{`•  TAXA DE VISTORIA: ${formatarMoeda(ordem.taxaVistoria)}`}</Text>
        ) : null}
        {ordem.deslocamento > 0 ? (
          <Text style={s.item}>{`•  DESLOCAMENTO: ${formatarMoeda(ordem.deslocamento)}`}</Text>
        ) : null}
        {ordem.maoDeObra > 0 ? (
          <Text style={s.item}>{`•  VALOR DA MÃO DE OBRA : ${formatarMoeda(ordem.maoDeObra)}`}</Text>
        ) : null}
        {ordem.material > 0 ? (
          <Text style={s.item}>{`•  VALOR DO MATERIAL: ${formatarMoeda(ordem.material)}`}</Text>
        ) : null}
        <Text style={s.total}>{`TOTAL: ${formatarMoeda(total)}`}</Text>
        <View style={s.rodape}>
          <View style={s.blocoEmpresa}>
            <Image src={assinaturaEmpresa} style={s.assinaturaEmpresa} />
            <View style={s.linha} />
            <Text style={s.responsavel}>{EMPRESA_RECIBO.responsavel}</Text>
            <Text style={s.empresaLinha}>{EMPRESA_RECIBO.nome.toUpperCase()}</Text>
            <Text style={s.empresaLinha}>{`CNPJ:  ${EMPRESA_RECIBO.cnpj}`}</Text>
            <Text style={s.empresaLinha}>{EMPRESA_RECIBO.endereco}</Text>
            <Text style={s.empresaLinha}>{EMPRESA_RECIBO.bairroCidade}</Text>
          </View>
          <View style={s.blocoCliente}>
            {ordem.assinatura ? <Image src={ordem.assinatura} style={s.assinaturaCliente} /> : <View style={{ height: 52 }} />}
            <View style={s.linhaCliente} />
            <Text style={s.rotuloAssinatura}>Assinatura do cliente</Text>
            <Text style={s.nomeCliente}>{ordem.cliente}</Text>
            <Text style={s.data}>{dataRecibo(ordem.data, ordem.cidade)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
