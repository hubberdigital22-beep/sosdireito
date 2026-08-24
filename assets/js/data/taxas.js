/* ============================================================
   SOS DIREITO — Tabela de taxas e regras de cálculo

   Fonte: calculadora do site atual (sosdireito.com.br/calculadora2.html).
   Os critérios foram confirmados pelo cliente em 19/08/2026.

   TODOS os valores vivem neste arquivo. Nenhum número fica embutido
   no HTML ou na lógica de tela — quando o USCIS reajustar, se mexe
   aqui e em nenhum outro lugar.
   ============================================================ */
window.SOS = window.SOS || {};

window.SOS.taxas = {
  atualizadoEm: '2026-08-19',

  /* ---- Taxas do USCIS, por formulário ----
     Cheques, money orders ou débito ACH, payable to
     U.S. Department of Homeland Security. */
  formularios: {
    i129:            { rotulo: 'I-129', valor: 695 },
    i907:            { rotulo: 'I-907 Premium Processing', valor: 2805 },
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
    /* L1 e L1-Renovação: I-129 + I-907 + 1 Supplemental + 2× Asilo */
    l1ChequesBase: 4600,
    /* Cônjuge no L1: I-539 (470) + Supplemental Fee (500) */
    l1Conjuge: 970,
    /* Cada filho dependente no L1: só a I-539 */
    l1Dependente: 470,
    /* EB: I-907 + I-140 + Taxa de Asilo (600) */
    ebCheques: 4120,
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

     ATENÇÃO — DIVERGÊNCIA HERDADA DO SITE ATUAL:
     a calculadora em produção cobra 2400 por menor de 14 no cálculo,
     enquanto a tabela de taxas exibida na MESMA página soma 2140
     (I-485 950 + I-765 260 + I-131 630 + Asilo 300).

     Mantivemos 2400 para que os totais batam exatamente com os da
     calculadora atual, como pede a Opção B. A divergência está
     sinalizada para a Diana decidir qual dos dois é o valor correto.
     Ao decidir, mudar apenas esta linha. */
  ajusteEB1: {
    adulto: 2630,
    crianca: 2400,
    criancaConformeTabela: 2140
  },

  /* Honorário opcional de ajuste de status. Exibido, mas fora do total. */
  opcionalAjuste: 1500,

  /* ---- Serviços não inclusos, ofertados por terceiros ---- */
  terceiros: [
    { servico: 'Respostas de RFE',                             faixa: 'USD $ 1.500,00 – USD $ 2.500,00' },
    { servico: 'Respostas de NOID',                            faixa: 'USD $ 2.500,00 – USD $ 3.500,00' },
    { servico: 'Mudança de endereço',                          faixa: 'USD $ 150,00 – USD $ 250,00 cada' },
    { servico: 'Inquiries',                                    faixa: 'USD $ 50,00 – USD $ 150,00 cada' },
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
