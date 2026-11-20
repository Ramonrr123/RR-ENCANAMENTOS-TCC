import { Link } from 'react-router-dom'

const CONTATO = String(import.meta.env.VITE_PRIVACY_CONTACT || 'privacidaderr@gmail.com.br').trim()
const VERSAO = '2026-11-13-v3'

export default function PrivacidadePublica() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">Política de privacidade</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Como tratamos dados pessoais</h1>
        <p className="mt-2 text-sm text-slate-600">
          Versão {VERSAO} · atualizada em 13/11/2026. Este texto descreve os controles do sistema; a adequação jurídica
          é decisão do responsável pela empresa.
        </p>

        <section className="mt-8 space-y-4 text-sm leading-6">
          <h2 className="font-semibold text-slate-900">Quais dados</h2>
          <p>
            Do formulário de chamado e do atendimento: nome, telefone, endereço, descrição do problema, fotos do
            chamado e endereço IP de origem do formulário. De funcionários: login, e-mail, CPF/CNPJ quando informado e
            registro de atividades.
          </p>

          <h2 className="font-semibold text-slate-900">Para que usamos</h2>
          <p>
            Atender o pedido, executar o serviço, registrar garantia e manutenção preventiva, cobrança e controle
            financeiro, e segurança contra abuso do formulário.
          </p>

          <h2 className="font-semibold text-slate-900">Quem acessa</h2>
          <p>
            A equipe da empresa, conforme o perfil de cada usuário. A infraestrutura (hospedagem e banco de dados) é
            processada por provedores de hospedagem e banco de dados.
          </p>

          <h2 className="font-semibold text-slate-900">Por quanto tempo</h2>
          {/* TODO-juridico: confirmar o prazo de 5 anos após o encerramento com o controlador. */}
          <p>
            Proposta operacional: até 5 anos após o encerramento do atendimento. Depois disso, os dados pessoais
            podem ser anonimizados, mantendo o número do chamado e os registros financeiros.
          </p>

          <h2 className="font-semibold text-slate-900">Seus direitos</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Confirmar se tratamos seus dados</li>
            <li>Acessar os dados</li>
            <li>Corrigir dados incompletos ou errados</li>
            <li>Pedir anonimização ou eliminação</li>
            <li>Pedir informação sobre compartilhamento</li>
            <li>Retirar o consentimento quando essa for a base do tratamento</li>
          </ul>
          <p>
            Para pedir, fale com a empresa pelo contato abaixo. A equipe registra o pedido na área interna de
            Privacidade.
          </p>

          <h2 className="font-semibold text-slate-900">Contato</h2>
          <p>
            Pedidos de privacidade:{' '}
            <a className="break-all text-[#e10600] underline" href={`mailto:${CONTATO}`}>
              {CONTATO}
            </a>
          </p>
        </section>

        <p className="mt-10 text-sm">
          <Link to="/chamado" className="text-[#e10600] underline">
            Voltar ao chamado público
          </Link>
        </p>
      </main>
    </div>
  )
}
