/* ============================================================
   SOS DIREITO — Tabela de taxas e regras de cálculo

   Fonte: calculadora do site atual (sosdireito.com.br/calculadora2.html),
   com as correções liberadas pela Dra. Diana em 08/09/2026 — ver
   CORREÇÕES, abaixo.

   TODOS os valores vivem neste arquivo. Nenhum número fica embutido
   no HTML ou na lógica de tela — quando o USCIS reajustar, se mexe
   aqui e em nenhum outro lugar.
   ============================================================ */
window.SOS = window.SOS || {};

window.SOS.taxas = {
  atualizadoEm: '2026-09-08',

  /* ---- CORREÇÕES sobre o site atual (08/09/2026) ----
     1. I-907 de 2805 para 2965. O USCIS reajustou a taxa de premium
        processing em 5,72% para pedidos postados a partir de
        01/03/2026, tanto na I-140 quanto na I-129. Reflete em
        ebCheques e l1ChequesBase.
     2. Ajuste de status do menor de 14 anos de 2400 para 2140, que é
        o que a própria tabela da página soma (950 + 260 + 630 + 300)
        e o que decorre das taxas vigentes do USCIS.

     A partir daqui os totais desta calculadora DIVERGEM de propósito
     dos de calculadora2.html, que segue com os valores antigos. */

  /* ---- Taxas do USCIS, por formulário ----
     Cheques, money orders ou débito ACH, payable to
     U.S. Department of Homeland Security. */
  formularios: {
    i129:            { rotulo: 'I-129', valor: 695 },
    i907:            { rotulo: 'I-907 Premium Processing', valor: 2965 },
    i140:            { rotulo: 'I-140', valor: 715 },
    i485_14mais:     { rotulo: 'I-485', valor: 1440 },
    i485_menor14:    { rotulo: 'I-485', valor: 950 },
    i765:            { rotulo: 'Permissão de Trabalho I-765', valor: 260 },
    i131:            { rotulo: 'Permissão de Viagem (Parole) I-131', valor: 630 },
    i539:            { rotulo: 'I-539', valor: 470 },
    supplemental:    { rotulo: 'Supplemental Fee', valor: 500 },
    asilo:           { rotulo: 'Taxa de Asilo', valor: 300 }
  },

  /* ---- Composições prontas ---- */
  composicoes: {
    /* L1 e L1-Renovação: I-129 695 + I-907 2965 + Supplemental 500
       + Asilo 2× 300 */
    l1ChequesBase: 4760,
    /* Cônjuge no L1: I-539 (470) + Supplemental Fee (500) */
    l1Conjuge: 970,
    /* Cada filho dependente no L1: só a I-539 */
    l1Dependente: 470,
    /* EB: I-907 2965 + I-140 715 + Taxa de Asilo 600 */
    ebCheques: 4280,
    /* Taxa de asilo cobrada no I-140 (empregador padrão).
       Small employer paga 300 e entidade sem fins lucrativos, 0. */
    asiloEB: 600,
    /* Ajuste de status, por pessoa */
    ajuste14Mais: 2630,
    ajusteMenor14: 2140
  },

  /* ---- Honorários e custos operacionais, por categoria ---- */
  honorarios: {
    EB1A: { assinatura: 6000, impressao: 2000, aprovacao: 6000 },
    EB1C: { assinatura: 4000, impressao: 2000, aprovacao: 4000 },
    EB2:  { assinatura: 5000, impressao: 1500, aprovacao: 5000 },
    L1:   { assinatura: 6000, impressao: 1000, aprovacao: 5000 },
    L1R:  { assinatura: 4000, impressao: 1000, aprovacao: 0 }
  },

  /* ---- Valores do dia do protocolo ---- */
  protocolo: {
    titular: 8545,          /* principal, todas as categorias */
    honorarioEB1: 5000,     /* honorário profissional somado no EB-1 */
    dependenteEB1: 4635,    /* por dependente, EB-1A e EB-1C */
    adultoEB2: 4625,        /* por pessoa de 14 anos ou mais, EB-2 */
    criancaEB2: 2765        /* por menor de 14, EB-2 */
  },

  /* ---- Ajuste de status usado no CÁLCULO do EB-1 ----
     Cada valor bate com a tabela exibida na própria página:
       adulto  = I-485 1440 + I-765 260 + I-131 630 + Asilo 300
       criança = I-485  950 + I-765 260 + I-131 630 + Asilo 300
     O site atual cobra 2400 pela criança, valor que não decompõe nas
     taxas vigentes e que a Dra. Diana liberou para corrigir. */
  ajusteEB1: {
    adulto: 2630,
    crianca: 2140
  },

  /* Honorário opcional de ajuste de status. Exibido, mas fora do total. */
  opcionalAjuste: 1500,

  /* ---- Serviços não inclusos, ofertados por terceiros ----
     Lista completa e na mesma ordem da tabela do site atual. */
  terceiros: [
    { servico: 'Expert Opinion Letter',                        faixa: 'USD $ 1.800,00 – USD $ 2.500,00' },
    { servico: 'Business Plan',                                faixa: 'USD $ 2.000,00 – USD $ 3.000,00' },
    { servico: 'Exames Médicos',                               faixa: 'USD $ 550,00 – USD $ 750,00' },
    { servico: 'Traduções (com certificado)',                  faixa: 'USD $ 10,00 – USD $ 15,00 por página' },
    { servico: 'Validação de Diplomas',                        faixa: 'USD $ 500,00 – USD $ 800,00' },
    { servico: 'Publicações em Mídia Nacional (www.dino.com.br)', faixa: 'USD $ 1.200,00 – USD $ 2.500,00' },
    { servico: 'Associações Profissionais (média de custo por cada)', faixa: 'USD $ 300,00 – USD $ 600,00' },
    { servico: 'Respostas de RFE',                             faixa: 'USD $ 1.500,00 – USD $ 2.500,00' },
    { servico: 'Respostas de NOID',                            faixa: 'USD $ 2.500,00 – USD $ 3.500,00' },
    { servico: 'Apelações e moções',                           faixa: 'USD $ 1.800,00 – USD $ 2.800,00' },
    { servico: 'Mudança de endereço',                          faixa: 'USD $ 150,00 – USD $ 250,00 cada' },
    { servico: 'Inquiries',                                    faixa: 'USD $ 50,00 – USD $ 150,00 cada' },
    { servico: 'Honorários (Excluso Taxas)',                   faixa: 'USD $ 750,00 por hora' },
    { servico: 'Honorários de Ajuste de Status',               faixa: 'USD $ 1.500,00 – USD $ 2.000,00' },
    { servico: 'Atendimento individual por telefone (cliente)',     faixa: 'USD $ 350,00 por chamada' },
    { servico: 'Atendimento individual por telefone (não-cliente)', faixa: 'USD $ 500,00 por chamada' }
  ],

  /* ---- Categorias oferecidas ---- */
  categorias: [
    { id: 'L1',   rotulo: 'L-1A — Para executivos e empresários', principal: true,
      criterios: ['Empresa ativa no Brasil ou cargo de gestão',
                  'Estrutura ou experiência consolidada',
                  'Vínculo com uma operação nos EUA'] },
    { id: 'L1R',  rotulo: 'L-1A Renovação — Para quem já tem o visto',
      criterios: ['L-1A já aprovado anteriormente',
                  'Empresa e função mantidas',
                  'Operação americana em atividade'] },
    { id: 'EB1A', rotulo: 'EB-1A — Para talentos de destaque',
      criterios: ['Reconhecimento nacional ou internacional',
                  'Prêmios ou publicações relevantes',
                  'Destaque comprovado na área'] },
    { id: 'EB1C', rotulo: 'EB-1C — Para quem já está no L-1A',
      criterios: ['Vínculo com empresa multinacional',
                  'Função executiva ou gerencial',
                  'Intenção de buscar o Green Card'] },
    { id: 'EB2',  rotulo: 'EB-2 NIW — Grau educacional avançado',
      criterios: ['Bacharelado ou mais',
                  'Habilidades avançadas',
                  'Experiência profissional relevante'] }
  ]
};
