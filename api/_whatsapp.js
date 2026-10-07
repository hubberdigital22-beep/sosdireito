/**
 * O primeiro atendimento por WhatsApp de quem envia o formulário de /contato/.
 *
 * O formulário não abre mais o WhatsApp de quem preenche. Depois que o card
 * nasce no JSYNQ, o servidor manda, do número da SOS ligado ao JSYNQ, a mesma
 * sequência que a Camila mandava à mão: a mensagem de boas-vindas, o link da
 * calculadora e os dois PDFs. Só o envio do formulário dispara isso: a
 * automação não reage a mensagem que chega no número.
 *
 * Aqui ficam só funções puras (telefone, saudação, textos). Quem fala com a
 * API do JSYNQ é o lead.js.
 */

/* O número que fala com o lead, ligado como sessão de WhatsApp no workspace
   da Hubber (Configurações → Mensagens → WhatsApp). A sessão é achada pelo
   número a cada envio, então reconectar o aparelho não pede mudança aqui. */
export const NUMERO_SOS = '5512996256773';
export const NUMERO_SOS_LEGIVEL = '+55 12 99625-6773';

export const CALCULADORA = 'https://www.sosdireito.com.br/calculadora/';

export const PDFS = [
  { arquivo: 'o-que-e-o-l1a.pdf', nome: 'O que é o L1-A - SOS Direito.pdf' },
  { arquivo: 'lista-de-documentos-l1a.pdf', nome: 'Lista de documentos para o L-1A - SOS Direito.pdf' },
];

/* DDDs que existem no Brasil. Número de 10 ou 11 dígitos sem "+" só vira
   +55 se começar por um deles; o resto fica para a equipe chamar à mão, em
   vez de a mensagem ir para o número de outra pessoa. */
const DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * O telefone do lead no formato do WhatsApp (só dígitos, com o código do
 * país), ou null quando não dá para ter certeza do país.
 *
 * O campo é livre: o formulário formata no padrão brasileiro e aceita
 * número internacional começando com "+". Regras, na ordem:
 *   "+..."                                  → como veio (8 a 15 dígitos)
 *   País "United States" e 10 dígitos       → +1
 *   55 + DDD + número (12 ou 13 dígitos)    → como veio
 *   DDD válido + 8 ou 9 dígitos             → +55
 *   qualquer outra coisa                    → null
 */
export function telefoneWhatsapp(lead) {
  const bruto = String(lead?.telefone || '').trim();
  const d = bruto.replace(/\D/g, '');
  if (!d) return null;
  if (bruto.startsWith('+')) return d.length >= 8 && d.length <= 15 ? d : null;
  if (lead?.pais === 'United States') {
    if (d.length === 10) return '1' + d;
    if (d.length === 11 && d.startsWith('1')) return d;
  }
  if ((d.length === 12 || d.length === 13) && d.startsWith('55') && DDD.has(+d.slice(2, 4))) return d;
  if ((d.length === 10 || d.length === 11) && DDD.has(+d.slice(0, 2))) return '55' + d;
  return null;
}

/* "Super bom dia / boa tarde / boa noite", no horário de quem recebe:
   Nova York para número dos EUA, Brasília para o resto. */
export function saudacao(numero, agora = new Date()) {
  const fuso = String(numero).startsWith('1') ? 'America/New_York' : 'America/Sao_Paulo';
  const hora = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: fuso })
    .format(agora));
  if (hora >= 5 && hora < 12) return 'Super bom dia !!!';
  if (hora >= 12 && hora < 18) return 'Super boa tarde !!!';
  return 'Super boa noite !!!';
}

/* O texto da primeira mensagem, o da Camila, com a saudação do horário. */
export function mensagemInicial(numero, agora = new Date()) {
  return [
    saudacao(numero, agora),
    'Muito obrigada por seu contato.',
    'Somos especialistas em aquisição de residência permanente por transferência executiva.',
    'Abaixo lhe encaminho todos os detalhes de como podemos lhe auxiliar na trajetória do L1-A.',
    'Ao revisar o material, caso haja interesse de se relocar para os EUA nos próximos 6 meses '
      + 'por gentileza nos avise para fazermos o agendamento no qual vamos esclarecer todas as suas dúvidas.',
  ].join('\n');
}

/* A sequência, na ordem em que chega no celular. Cada item vira um envio. */
export function sequencia(numero, agora = new Date()) {
  return [
    { tipo: 'texto', rotulo: 'mensagem de boas-vindas', texto: mensagemInicial(numero, agora) },
    { tipo: 'texto', rotulo: 'link da calculadora', texto: CALCULADORA },
    ...PDFS.map((p) => ({ tipo: 'pdf', rotulo: p.nome, arquivo: p.arquivo, nome: p.nome })),
  ];
}

/* +55 12 99625-6773 / +1 305 555 0100, só para o texto do card. */
export function numeroLegivel(numero) {
  const d = String(numero);
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const n = d.slice(4);
    return `+55 ${d.slice(2, 4)} ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
  }
  if (d.startsWith('1') && d.length === 11) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return '+' + d;
}
