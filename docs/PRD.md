# Documento de requisitos do produto

ERP da RR Encanamentos

Versão 1.0  
Outubro de 2026

## 1. Identificação

O produto é um sistema de gestão para a RR Encanamentos, empresa de prestação de serviço de encanamento sediada em Porto União. Os dados usados no recibo são os da própria empresa: responsável Ricardo Rocha, CNPJ 32.710.190/0001-27, endereço João Fernandes de Aquino, 92, bairro São Pedro.

O sistema reúne, numa aplicação web, o cadastro de quem pode entrar, o financeiro da empresa escolhida, o cadastro de peças, a movimentação de estoque, o recibo de serviço com assinatura do cliente, a lista de tarefas e o calendário do mês. A marca aparece na tela de entrada, no menu e no PDF do recibo.

O trabalho trata de um ERP enxuto para o dia a dia de uma empresa pequena de serviço. Não é um ERP genérico de indústria, nem um sistema fiscal.

## 2. Contexto

Na rotina de uma empresa desse porte, conta a pagar, peça comprada, serviço feito e recibo entregue ao cliente costumam ficar em lugares diferentes: caderno, planilha, conversa de WhatsApp e arquivo solto no celular. Quando mais de uma pessoa mexe nesses registros, o saldo da peça e o que ainda está em aberto deixam de bater.

O sistema existe para colocar essas rotinas no mesmo lugar, com login, empresa selecionada e permissão por tela. Quem entra vê só o menu que o grupo ou o administrador liberou. Os lançamentos de financeiro, produto, estoque, cliente e ordem de serviço ficam separados pelo código da empresa.

A tela inicial mostra o nome de quem entrou, as tarefas que ainda não foram concluídas, o clima do aparelho (consulta à previsão do Open-Meteo a partir da localização) e um atalho para os módulos. O clima é apoio visual da entrada. Não entra no controle da empresa.

## 3. Objetivo

Permitir que a empresa lance e consulte, com usuário identificado:

- contas a pagar e contas a receber, com parcela, baixa, juros, multa e desconto;
- peças e materiais, com preço, custo e saldo;
- entrada e saída dessas peças, sem deixar o saldo ficar negativo;
- recibo de prestação de serviço em PDF, com valor por extenso, assinatura do cliente e envio pelo WhatsApp;
- tarefas com prazo, prioridade e situação;
- calendário do mês corrente, com navegação entre meses, feriados e as tarefas já agendadas para cada dia;
- usuários, grupos, permissões de tela, empresas e sessões em uso.

O administrador enxerga todas as telas. Os demais enxergam o que estiver marcado para o grupo ou para o próprio usuário.

## 4. Quem usa

Há dois papéis.

O administrador é o usuário com a marca de administrador. Ele abre qualquer módulo, cadastra usuário, grupo, empresa e permissão, e encerra sessão de outra pessoa. A carga inicial do banco cria o login `admin`, no grupo Administradores, ligado à empresa de código 01, nome Matriz.

O operador é qualquer outro usuário ativo. O menu dele depende da permissão. Sessões em uso só aparecem para o administrador. Se a pessoa não tiver a tela, o sistema mostra que o acesso não foi liberado.

Um usuário pode estar ligado a mais de uma empresa. Com uma empresa só, ela já entra selecionada. Com duas ou mais, a escolha acontece antes do menu. No topo dá para trocar a empresa sem sair do login. Financeiro, produto, estoque, cliente e ordem de serviço usam sempre a empresa que está selecionada.

Usuário desligado não deve permanecer operando. A situação do cadastro é Ativo ou Desligado.

## 5. Escopo desta versão

Entra nesta versão:

- tela de entrada com usuário e senha, tema claro na página de login e tema claro ou escuro dentro do sistema;
- menu lateral com Início, Financeiro (contas a pagar e contas a receber), Produtos, Estoque, Ordem de Serviço, Tarefas, Calendário e Acesso;
- Acesso com Usuários, Permissões de usuário, Perfil de acesso, Empresas e, para o administrador, Sessões em uso;
- troca de senha pelo menu do usuário, com a senha atual e uma nova senha de no mínimo 6 caracteres, diferente da atual;
- perfil com nome, e-mail e foto;
- listagens com busca, ordenação por coluna, seleção e páginas de 16 linhas;
- exportação da lista de usuários em PDF e em CSV.

Ficam gravados no PostgreSQL, pela API: usuário, grupo, tela, permissão de grupo, permissão extra de usuário, empresa, vínculo usuário-empresa, sessão, título financeiro, produto, movimento de estoque, cliente, ordem de serviço e peça da ordem, inclusive a assinatura desenhada. No sistema publicado esse banco é o do Supabase. Em desenvolvimento pode ser o PostgreSQL local.

Ficam gravados no navegador de quem lançou: tarefas. Trocar de computador ou limpar os dados do navegador tira esses registros daquele aparelho. Financeiro, produto, estoque e ordem de serviço não dependem disso.

O calendário não grava compromisso próprio. Ele abre no mês e no dia de hoje, deixa avançar e voltar os meses, marca feriado nacional e ponto facultativo (com a data móvel da Páscoa: carnaval, sexta-feira santa e Corpus Christi; a partir de 2024, 20 de novembro, Consciência Negra) mostra, em cada dia, as tarefas cujo prazo cai naquela data, e traz uma seção com as tarefas atrasadas que ainda não foram concluídas.

## 6. O que esta versão não faz

- não emite nota fiscal eletrônica, boleto registrado nem arquivo de remessa bancária;
- não importa extrato e não concilia conta;
- não controla ponto, folha, compra com pedido nem ordem de compra;
- não guarda orçamento com aprovação de representante;
- não agenda visita com horário. O calendário lê o prazo das tarefas e não cria um compromisso separado;
- não grava tarefa no servidor;
- não envia o PDF sozinho para o WhatsApp do cliente. O aparelho compartilha o arquivo quando o navegador permite. Se não permitir, o PDF é baixado e abre a conversa para a pessoa anexar o arquivo;
- não é aplicativo de loja. Roda no navegador, inclusive no celular, com o menu recolhível.

Campos de grupo herdados de outro cadastro (aprovação de orçamento, tabela de preço, precificação de representante) existem na base e não têm tela nesta versão. Não fazem parte do uso da RR Encanamentos.

## 7. Módulos

### 7.1 Entrada, sessão e empresa

A pessoa informa usuário ou e-mail e senha. A API confere a senha, recusa usuário desligado e abre uma sessão de 8 horas, com o endereço de rede e o navegador. Enquanto a aba está visível, o sistema avisa o servidor a cada 20 segundos. Sessão sem aviso há mais de 45 segundos deixa de contar como em uso.

Depois de 30 minutos sem uso, abre um aviso. A pessoa tem 30 segundos para continuar ou sair. Sair encerra a sessão. Trocar o usuário em outra aba recarrega a tela.

Na apresentação, a tela de login também aceita uma entrada local, sem consultar a senha no servidor, e abre o menu como administrador. Com o token emitido pela API, valem sessão, inatividade, empresa e permissão.

### 7.2 Financeiro

Há duas listas: contas a pagar e contas a receber. Cada título tem pessoa (fornecedor ou cliente), número do documento, tipo do documento, plano de contas, forma de pagamento, valor, datas de emissão, competência e vencimento, parcela, conta bancária, desconto, juros, multa, valor baixado, data da baixa, código de barras, observação e situação.

Tipos de documento: boleto, duplicata, nota fiscal, recibo, cupom e outros.

Formas de pagamento: boleto, PIX, transferência, dinheiro, cartão de crédito, cartão de débito e cheque.

Planos de contas a pagar: material, mão de obra de terceiros, aluguel, energia, água, telefone e internet, impostos e taxas, combustível, manutenção, frete e outras despesas.

Planos de contas a receber: serviço de encanamento, venda de material, mão de obra, visita técnica, locação de equipamento e outras receitas.

No lançamento novo dá para gerar de 1 a 60 parcelas. O valor é dividido em centavos. O resto fica na última parcela. O vencimento de cada parcela anda um mês. Juros, multa, desconto e baixa não entram na geração do parcelamento. Isso se lança depois, em cada parcela.

O total do título é valor mais juros mais multa, menos desconto. O saldo é o total menos o que já foi baixado. A situação sai desse cálculo: sem baixa, aberto; baixa menor que o total, pago parcial; baixa que cobre o total, pago. Cancelado só vale se não houver baixa. Título com pagamento lançado não é excluído. É preciso estornar a baixa ou cancelar.

Documento repetido para a mesma pessoa, no mesmo tipo (pagar ou receber) e na mesma parcela, não é aceito. Sem número de documento, a trava não se aplica.

Título vencido e ainda aberto aparece como vencido. Pago parcial e vencido aparece como parcial vencido.

Contas a pagar e contas a receber ficam só com o administrador. Marcar a tela do financeiro no grupo não abre o módulo para o funcionário.

O fluxo de caixa lê os títulos registrados em contas a pagar e contas a receber.

### 7.3 Produtos

Cadastro da peça ou do material da empresa: código, descrição, unidade, categoria, preço de venda, custo, estoque, observação, se é ferramenta e se está ativo. A empresa trabalha com processo plástico (PVC roscável, esgoto e PPR). Não há linha soldável nem tubo metálico.

Unidades previstas: UN, MT, CM, CX, KG, PC, RL, JG, PAR e SC.

Categorias: peça, material, ferramenta, serviço e outros.

O código não se repete na mesma empresa, sem diferenciar maiúscula. Peça que já teve entrada ou saída de estoque não é excluída. O saldo mostrado aqui é o mesmo que a movimentação atualiza. Quantidade de estoque aceita três casas. Preço e custo, duas.

### 7.4 Estoque

A tela lista as movimentações da empresa, com filtro de entrada, saída ou todas, e os totais de quantidade de lançamentos.

Entrada aceita os motivos compra, devolução de cliente, ajuste de inventário e saldo inicial.

Saída aceita uso em serviço, venda, perda ou quebra, ajuste de inventário e devolução ao fornecedor.

Cada movimento tem peça, tipo, quantidade, data, motivo, documento e observação. A quantidade precisa ser maior que zero. Ao gravar, o saldo da peça sobe na entrada e desce na saída. Saída maior que o saldo é recusada, na tela e no servidor. Alterar ou apagar um movimento manual refaz o saldo. Saída gerada pelo encerramento da ordem aponta a ordem e não é alterada nem excluída por esta tela. Movimento lançado à mão continua sem ordem. Na exclusão de várias linhas, as saídas são desfeitas antes das entradas, para não bloquear um estorno que ainda dependia daquela quantidade.

A peça do movimento tem de ser da mesma empresa.

O saldo também fica separado em Veículo e Depósito. A compra entra no depósito. A baixa da ordem sai do veículo. Dá para transferir entre os dois e ajustar a quantidade depois de uma contagem, com motivo. Peça com estoque mínimo informado aparece no aviso quando o saldo total chega nesse mínimo.

### 7.5 Ordem de serviço

A ordem de serviço fica no servidor, da empresa selecionada. Os campos são cliente (nome, telefone, endereço e cidade), situação (aberta, em execução ou encerrada), vistoria, serviços, taxa de vistoria, mão de obra, deslocamento, material, data de abertura, peças escolhidas entre os produtos da empresa e assinatura. Depois do encerramento entram a data de encerramento e a garantia.

O número é o próximo daquela empresa, gerado na gravação. Não é escolhido no navegador. Cidade em branco no recibo continua Porto União. O total do recibo é a soma da taxa de vistoria, da mão de obra, do deslocamento e do material.

Enquanto a ordem está aberta ou em execução, dá para incluir, alterar, buscar e excluir. Ordem encerrada não volta atrás e não é excluída. Encerrar exige vistoria e serviços preenchidos. Na mesma gravação, a data de encerramento fica hoje, a garantia fica em 90 dias, cada peça gera uma saída de estoque e nasce o contas a receber do total. A saída é recusada se o saldo não cobrir; nesse caso nada do encerramento permanece. O contas a receber usa a forma de pagamento e o número de parcelas informados, com o mesmo rateio de centavos do financeiro e vencimento mês a mês. Sem valor, a ordem encerra e não gera título.

A assinatura é desenhada na tela, no dedo ou no mouse, e guardada junto da ordem.

O PDF se chama recibo, com o número em quatro dígitos, por exemplo recibo-0001.pdf. O texto declara que a RR Encanamentos recebeu do cliente o valor, em moeda e por extenso, referente aos serviços listados. Entram a vistoria quando estiver preenchida, e taxa de vistoria, deslocamento, mão de obra e material quando o valor é maior que zero, o total, a assinatura da empresa, o CNPJ, o endereço, a assinatura do cliente, o nome do cliente e a cidade com a data por extenso. O fundo leva a marca d'água.

O envio pelo WhatsApp só segue depois da assinatura. A mensagem cita o nome do cliente, a empresa e o valor. Se o navegador compartilha arquivo, o PDF vai junto. Caso contrário, o arquivo é baixado e abre o WhatsApp no número informado, com o texto pedindo para anexar o PDF. Número com 10 ou 11 dígitos recebe o código 55 do Brasil.

A ordem também registra tipo (emergência, preventiva ou obra), origem do chamado, descrição do problema, endereço do cliente e funcionário da empresa. O cliente é pessoa física ou jurídica e pode ter vários endereços; o endereço principal continua na coluna antiga. A situação segue aberta, agendada, em andamento, concluída, cancelada ou encerrada. Ordem antiga em execução aparece como em andamento, e ordem nova grava em andamento. Quem não é administrador não recebe taxa, mão de obra, deslocamento, material, total, entrada, margem nem custo da peça. O funcionário registra vistoria, serviços e peças e conclui a ordem em andamento; só o administrador encerra, e somente se estiver concluída. O encerramento, numa única gravação, baixa o estoque, grava o custo, a garantia (90 dias, ajustável), a preventiva (6 meses, ajustável), a entrada e as parcelas do saldo. Se a entrada cobre o total e foi recebida, nasce um título já pago; se cobre e não foi recebida, não nasce parcela. O vencimento padrão é o quinto dia útil do mês seguinte à data informada, pulando sábado e domingo; se a data for escolhida à parte, ela vale para a primeira parcela e as seguintes andam um mês. A margem é o total menos o custo das peças e só o administrador a recebe. Cancelar exige motivo, vale antes do encerramento e não baixa estoque nem gera título. A lista filtra por situação, período, funcionário, cliente e tipo. A ficha do cliente mostra o histórico, com a garantia do endereço quando ainda estiver vigente. Dá para guardar foto de antes e de depois pela URL já enviada. O número da ordem cancelada não volta a ser usado. O usuário pode ter especialidade de encanador, pedreiro, pintor ou eletricista.

### 7.6 Tarefas

Cada tarefa tem título, descrição, prazo, prioridade (baixa, média ou alta) e situação (pendente, em andamento ou concluída). O título é obrigatório. Prazo de tarefa não concluída, anterior a hoje, aparece como vencido.

A lista ordena por título, descrição, prazo, prioridade ou situação. A tela inicial lê a mesma lista e mostra primeiro o que vence hoje, depois o atrasado e em seguida o que ainda vai vencer. Tarefa concluída não entra nesse resumo.

### 7.7 Calendário

Abre no mês corrente e mostra a data de hoje. Dá para avançar e voltar um mês, ou voltar para hoje. Cada dia lista as tarefas com prazo naquela data. Clicar no dia abre o detalhe, com feriado nacional ou ponto facultativo quando houver. A mesma tela lista as tarefas atrasadas, e clicar numa delas abre o dia do prazo. Não há cadastro de compromisso fora da tarefa.

### 7.8 Acesso

Usuários: nome, login, e-mail, CPF ou CNPJ, senha, situação, grupo, empresas ligadas e permissão extra de tela. O administrador altera o grupo. A lista exporta PDF e CSV. Exclusão pode ser de vários selecionados.

Permissões de usuário: cadastro do grupo (nome interno, nome exibido e descrição) e marcação das telas que o grupo pode abrir. As telas do menu são sincronizadas com o banco quando um administrador entra.

Perfil de acesso: a própria pessoa altera nome, e-mail e foto. O login aparece, sem troca por essa tela.

Empresas: código, nome e indicação de ativa ou inativa. Empresa inativa continua no cadastro, mas não deve ser oferecida como empresa de trabalho.

Sessões em uso: só o administrador. A grade mostra quem está conectado, empresa, endereço, navegador e há quanto tempo houve o último aviso. O administrador encerra as sessões marcadas.

## 8. Requisitos funcionais

RF01. O sistema só abre o menu para quem tem identificação gravada no navegador.

RF02. A API autentica login e senha, recusa senha errada e recusa usuário desligado.

RF03. Cada entrada válida na API cria uma sessão com validade de 8 horas.

RF04. A aba visível renova a sessão a cada 20 segundos.

RF05. Após 30 minutos sem uso, o sistema pede para continuar ou sair, com 30 segundos de espera.

RF06. Sair encerra a sessão daquela pessoa.

RF07. Usuário com mais de uma empresa escolhe a empresa antes de operar. Com uma só, ela fica selecionada.

RF08. Título, produto e movimento só são lidos e gravados na empresa selecionada.

RF09. O administrador acessa todas as telas do menu.

RF10. Usuário que não é administrador só abre tela com permissão do grupo ou permissão marcada nele.

RF11. A tela de sessões em uso aparece somente para o administrador, que pode encerrar sessão alheia.

RF12. A troca de senha exige a senha atual, uma nova senha com pelo menos 6 caracteres e diferente da atual.

RF13. O financeiro separa contas a pagar e contas a receber.

RF14. O lançamento de título exige pessoa, tipo de documento, plano de contas, forma de pagamento, valor e vencimento.

RF15. O parcelamento gera de 1 a 60 títulos, divide o valor em centavos e empurra o vencimento um mês por parcela.

RF16. Juros, multa, desconto e baixa de um parcelamento são lançados em cada parcela, depois da geração.

RF17. O sistema calcula total e saldo e define a situação aberto, pago parcial, pago ou cancelado a partir da baixa.

RF18. Título com valor baixado maior que zero não é excluído.

RF19. Não se repete o mesmo documento para a mesma pessoa, o mesmo tipo e a mesma parcela.

RF20. O produto exige código, descrição, unidade, categoria e preço, com código único na empresa.

RF21. Produto com movimento de estoque não é excluído.

RF22. A entrada aumenta o saldo e a saída diminui, na mesma gravação do movimento.

RF23. Saída, alteração ou exclusão que deixaria saldo negativo é recusada.

RF24. A ordem de serviço exige o nome do cliente e gera PDF de recibo com os dados da RR Encanamentos e o valor por extenso.

RF25. O envio pelo WhatsApp exige assinatura do cliente.

RF26. A tarefa exige título e aceita prazo, prioridade e situação.

RF27. O calendário abre no mês e no dia de hoje, permite navegar entre meses, mostra em cada dia as tarefas agendadas e os feriados calculados, e lista à parte as tarefas atrasadas ainda não concluídas, sem gravar evento próprio.

RF28. O cadastro de usuário, grupo, empresa e permissão de tela é feito pelo módulo Acesso, respeitando quem é administrador.

RF29. A lista de usuários pode ser exportada em PDF e em CSV.

RF30. As listagens de títulos, produtos, movimentos, ordens, tarefas e usuários paginam de 16 em 16 e permitem busca.

A baixa do título (RF31) continua gravando a data e a forma de pagamento no próprio lançamento, sem alterar o cálculo de total e saldo. O administrador consulta os devedores de contas a receber (RF32): parcelas em aberto ou pagas parcialmente com vencimento anterior a hoje, agrupadas por pessoa, com a quantidade, a soma do saldo (valor menos o valor baixado) e os dias de atraso; essa lista aparece na seção Em atraso, no topo de contas a receber. No cadastro de contas a pagar (RF33), o plano de contas oferece as sugestões fixas Compra de material, Combustível, Salário, Diária e Aluguel, no campo de texto que já existia. O menu Relatórios (RF37), restrito ao administrador, mostra ordens de serviço, estoque e fluxo de caixa, com CSV gerado pela API e PDF montado no navegador. Cada inclusão, alteração ou exclusão autenticada e bem sucedida gera uma atividade (RF38 e RNF08) com usuário, método, caminho e objeto; se o registro falhar, a requisição segue, e a consulta em Atividades, no menu Acesso, também fica só com o administrador.

## 9. Regras de negócio

RN01. Dinheiro do título usa duas casas decimais. Quantidade de peça usa três.

RN02. Desconto não pode passar do valor do título. Valor baixado não pode passar do total. Total negativo não é gravado.

RN03. Cancelar título com baixa exige estorno antes.

RN04. Competência, quando não informada na criação, acompanha o vencimento da parcela.

RN05. Data da baixa, quando há valor baixado e a data não foi informada, fica com o dia da gravação.

RN06. O saldo da peça nunca fica abaixo de zero.

RN07. Código de produto é comparado sem diferenciar maiúsculas e minúsculas.

RN08. O total da ordem é a soma da taxa de vistoria, da mão de obra, do deslocamento e do material.

RN09. Cidade em branco no recibo vira Porto União.

RN10. WhatsApp com DDD e número, sem código do país, é completado com 55.

RN11. Tarefa concluída não conta como atrasada e não aparece no resumo da entrada.

RN12. Permissão de tela é por grupo. Uma permissão marcada no usuário soma à do grupo para aquela pessoa.

RN13. A empresa do lançamento financeiro, do produto, do estoque, do cliente e da ordem de serviço é a empresa selecionada na sessão de tela, enviada à API. Não se mistura lançamento de uma empresa na lista da outra.

RN14. Usuário desligado não autentica na API.

## 10. Requisitos não funcionais

RNF01. A interface é em português do Brasil. Data na tela segue dia, mês e ano. Valor segue real, com vírgula decimal.

RNF02. A aplicação abre no navegador. O menu e as grades se ajustam à largura do celular.

RNF03. A senha é armazenada com hash. A senha em texto não fica no banco.

RNF04. A API exige identificação nas rotas de negócio e rejeita campo que não pertence ao contrato daquela rota.

RNF05. A API aceita chamada do front com o cabeçalho da empresa selecionada.

RNF06. Gravação de título parcelado, de movimento de estoque e de estorno de saldo ocorre em transação. Se uma parte falha, a outra não permanece pela metade.

RNF07. A foto do perfil e o corpo da requisição podem chegar até 4 MB. Esse teto cabe no limite de corpo de requisição da publicação na Vercel.

RNF08. O tema escuro ou claro fica gravado no navegador e vale na próxima entrada.

RNF09. Mensagem de erro de gravação aparece na tela, com o texto devolvido pela API quando a regra de negócio barra o lançamento.

RNF10. O PDF do recibo é gerado no navegador, em página A4, sem depender de outro serviço para montar o arquivo.

## 11. Onde cada dado fica

| Dado | Onde fica |
| --- | --- |
| Usuário, senha, grupo, permissão, empresa, sessão | PostgreSQL, tabelas de acesso |
| Título a pagar e a receber | PostgreSQL, por código da empresa |
| Produto e saldo | PostgreSQL, por código da empresa |
| Movimento de estoque | PostgreSQL, ligado ao produto da mesma empresa |
| Tarefa | Navegador, chave local da lista de tarefas |
| Cliente, ordem de serviço, peças e assinatura | PostgreSQL, por código da empresa |
| Empresa selecionada, tema e identificação da entrada | Navegador |
| Feriado | Calculado na hora, a partir do ano |
| Clima da tela inicial | Consulta externa no momento da abertura, não é cadastro da empresa |

A carga inicial deixa um administrador e a empresa Matriz, código 01. Os planos de contas, as formas de pagamento, as unidades e as categorias são listas fixas da tela, não cadastros à parte.

## 12. Fluxo de uso

Entrada. A pessoa informa usuário e senha. Se a API aceitar, a sessão começa. Se houver mais de uma empresa, ela escolhe uma. O menu abre na tela inicial.

Conta. Em Financeiro, escolhe pagar ou receber, informa a pessoa, o documento, o plano, a forma, o valor e o vencimento. Se forem várias parcelas, gera a série e depois baixa cada uma. Título quitado muda de situação. Título com baixa não some da lista por exclusão.

Peça. Em Produtos, inclui o código e a descrição. O saldo inicial pode nascer no cadastro. A partir daí, compra e uso vão pelo Estoque, como entrada ou saída, com motivo. O saldo da grade de produtos acompanha o movimento.

Serviço. Em Ordem de Serviço, lança o cliente, a vistoria, o que foi feito, as peças e os valores. O cliente assina na tela. Encerrar grava a garantia de 90 dias, baixa as peças no estoque e gera o contas a receber. O PDF é baixado ou segue para o WhatsApp.

Dia a dia. A tarefa guarda o que ainda precisa ser feito. A entrada mostra o que vence hoje e o que já passou. O calendário abre no mês atual e coloca essas tarefas no dia do prazo.

Acesso. O administrador cria a empresa, o grupo, marca as telas e cria o usuário ligando as empresas. Se alguém esqueceu a sessão aberta, ele encerra por Sessões em uso.

## 13. Como conferir se o requisito foi atendido

- Entrar com senha errada na API não abre sessão. Entrar com usuário desligado também não.
- Dois usuários de empresas diferentes não enxergam o título, o produto, o movimento, o cliente nem a ordem um do outro.
- Usuário sem permissão de Produtos não abre a grade, mesmo digitando o caminho da tela.
- Gerar 3 parcelas de R$ 100,00 produz três títulos de R$ 33,33, R$ 33,33 e R$ 33,34, com vencimentos em meses seguidos, todos em aberto e sem baixa.
- Baixar o valor total muda a situação para pago e zera o saldo. Tentar excluir esse título é recusado.
- Repetir documento, pessoa, tipo e parcela é recusado.
- Saída maior que o saldo da peça é recusada e o saldo anterior permanece.
- Excluir uma entrada que já foi consumida por uma saída é recusado se o saldo ficaria negativo.
- Excluir produto com movimento é recusado. Excluir produto sem movimento remove o cadastro.
- Recibo sem nome de cliente não grava. Recibo sem assinatura não segue para o WhatsApp. Encerrar sem vistoria, sem serviços ou com peça sem saldo não grava a baixa nem o título.
- O PDF mostra CNPJ 32.710.190/0001-27, o valor em reais e o mesmo valor por extenso, a lista de serviços e a assinatura desenhada.
- Tarefa sem título não grava. Tarefa concluída sai do resumo da entrada.
- O calendário abre no mês corrente, marca a data de hoje e, em setembro de 2026, mostra 7 de setembro como Independência do Brasil. Uma tarefa com prazo nesse dia aparece no calendário.
- Administrador vê Sessões em uso. Operador não vê.
- Senha nova com menos de 6 caracteres, ou igual à atual, é recusada.

## 14. Ambiente

O sistema publicado fica na Vercel, num único projeto com dois serviços que sobem juntos. O serviço do front entrega a aplicação React. O serviço da API entrega o NestJS. O banco publicado é PostgreSQL no Supabase, na região de São Paulo. O navegador chama a API no mesmo domínio, no prefixo `/api`. Na publicação, a API atende esse prefixo. Em desenvolvimento, a API local continua na raiz da porta 3001.

O front é uma aplicação React com TypeScript, empacotada pelo Vite, com estilo em Tailwind. O roteamento tem a página de login e o restante do sistema atrás da identificação. Endereço de tela que não é um arquivo estático abre a mesma página inicial, para o menu funcionar ao recarregar.

A API é NestJS e, na publicação, sobe como contêiner Node para levar junto as bibliotecas do servidor. O acesso aos dados usa Prisma sobre PostgreSQL. A senha usa bcrypt. A sessão de quem entrou pela API usa token JWT. Na publicação, o Prisma fala com o Supabase pelo pooler em modo de transação, com uma conexão por instância e sem prepared statement, que esse modo não aceita.

Em desenvolvimento, a API sobe na porta 3001 e escuta na rede local. O front conversa com ela por HTTP, enviando o token e o código da empresa. O banco local pode ser o PostgreSQL do docker-compose, na porta 5432. A URL do banco, o segredo do token e o endereço da API não entram no repositório. Os arquivos de exemplo mostram só os nomes. O valor publicado fica nas variáveis da Vercel.

A apresentação para a banca pode usar a entrada local da tela de login. A conferência de senha, sessão, permissão e dos módulos financeiro, produtos e estoque depende da API e do banco no ar. No ambiente publicado, essa conferência usa a API na Vercel e o banco no Supabase.
