/**
 * O lead do formulário de /contato/, do corpo do POST até o payload do webhook
 * do JSYNQ. Só funções puras: nada aqui lê ambiente, rede ou relógio, para o
 * teste rodar sem nenhum dos três.
 *
 * O servidor exige só o que o CRM da SOS (JSYNQ) exige para criar o card: nome,
 * e-mail e telefone. Sem o e-mail o JSYNQ responde sucesso e não cria card, então
 * aceitar um lead assim seria perdê-lo em silêncio; recusar com 422 deixa o
 * motivo no log. O resto o servidor aceita como veio, e quem impõe as demais
 * regras do formulário é o form.js. Se o servidor fosse mais rígido, qualquer
 * mudança no formulário (campo que deixa de ser obrigatório, opção nova) faria
 * o CRM recusar os leads sem erro visível, porque o WhatsApp abre do mesmo jeito.
 * Perder o lead do CRM é justamente o que esta camada existe para evitar. Por
 * isso texto acima do limite é cortado, não recusado.
 *
 * Os rótulos e a ordem de ROTULOS/ORDEM são os do form.js: o teste em
 * _dev/tests confere as duas listas contra ele. ORIGENS e STATUS reproduzem as
 * <option> do formulário e o build (conferir_lead, em _dev/build.py) trava se
 * o HTML e estas listas divergirem.
 */

export const ROTULOS = {
  nome: 'Nome',
  email: 'E-mail',
  telefone: 'Telefone',
  pais: 'País',
  origem: 'Como nos conheceu',
  area_atuacao: 'Área de atuação',
  graduacao: 'Graduação',
  ano_graduacao: 'Ano de conclusão',
  melhor_horario: 'Melhor horário para contato',
  ultima_entrada_eua: 'Última entrada nos EUA',
  expiracao_i94: 'Expiração da I-94',
  status_imigratorio: 'Status imigratório nos EUA',
  servico_procurado: 'Serviço procurado'
};

export const ORDEM = ['nome', 'email', 'telefone', 'pais', 'origem',
  'area_atuacao', 'graduacao', 'ano_graduacao', 'melhor_horario',
  'ultima_entrada_eua', 'expiracao_i94', 'status_imigratorio',
  'servico_procurado'];

/* O que o CRM recebe. Hoje, os 13 campos do formulário, igual ao CRM antigo.
   Para reduzir (por exemplo, deixar o status imigratório e a I-94 só no
   WhatsApp), basta tirar o campo daqui: o servidor descarta o que não está
   na lista antes de guardar em qualquer lugar, então o dado nem chega ao
   Blob. Nome, e-mail e telefone são o caminho de volta e ficam sempre. */
export const CAMPOS_NO_CRM = [...ORDEM];

/* Valor da <option> → texto que a equipe lê. Valor desconhecido passa como
   veio, em vez de recusar o lead. */
export const ORIGENS = {
  'email': 'E-mail',
  'google': 'Google',
  'facebook': 'Facebook',
  'friend': 'Indicação de um amigo',
  'direct visit': 'Acesso direto ao site',
  'tv ad': 'Anúncio de TV'
};

export const STATUS = [
  'Turista',
  'Estudante',
  'Visto de Trabalho',
  'Extensão do Visto de Turista',
  'Outro'
];

export const EMPRESA = 'SOS Direito - Site';

const DATAS = ['ultima_entrada_eua', 'expiracao_i94'];
const ESSENCIAIS = ['nome', 'email', 'telefone'];
const ATRIBUICAO = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_term', 'utm_content'];

const LIMITE = {
  nome: 120, email: 254, telefone: 40, pais: 80, origem: 60,
  area_atuacao: 160, graduacao: 160, ano_graduacao: 10, melhor_horario: 120,
  ultima_entrada_eua: 40, expiracao_i94: 40, status_imigratorio: 120,
  servico_procurado: 4000
};

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Tira caracteres de controle, mas deixa \t, \n e \r: o texto livre tem quebra de linha.
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function texto(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(CONTROLE, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function linha(v, max) {
  return texto(v, max * 2).replace(/\s+/g, ' ').slice(0, max);
}

/* AAAA-MM-DD (o valor nativo do input) → DD/MM/AAAA. O que não for uma data
   de calendário passa cru: a equipe lê o que a pessoa mandou. */
function dataBr(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const existe = d.getUTCFullYear() === +m[1]
    && d.getUTCMonth() === +m[2] - 1
    && d.getUTCDate() === +m[3];
  return existe ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function telefone(v) {
  const valor = texto(v, 60).replace(/[^\d+()\s.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return { valor, digitos: valor.replace(/\D/g, '').length };
}

function atribuicao(a) {
  const o = a && typeof a === 'object' ? a : {};
  const saida = {};
  for (const k of ATRIBUICAO) {
    const v = linha(o[k], 300);
    if (v) saida[k] = v;
  }
  return saida;
}

/**
 * Corpo do POST → { lead, problemas }.
 *
 * `problemas` só tem o que impede o CRM de criar o card: 'nome', 'email' e
 * 'telefone', cada um ausente ou inválido (e-mail malformado, telefone curto ou
 * longo demais). Quando vazio, `lead` está pronto para guardar e entregar.
 */
export function validarLead(corpo, { campos = CAMPOS_NO_CRM } = {}) {
  const b = corpo && typeof corpo === 'object' ? corpo : {};
  const problemas = [];
  const lead = {};

  const nome = linha(b.nome, LIMITE.nome);
  if (nome) lead.nome = nome; else problemas.push('nome');

  const email = linha(b.email, LIMITE.email).toLowerCase();
  if (RE_EMAIL.test(email)) lead.email = email; else problemas.push('email');

  const tel = telefone(b.telefone);
  if (tel.digitos >= 10 && tel.digitos <= 15) lead.telefone = tel.valor;
  else problemas.push('telefone');

  for (const nomeCampo of ORDEM) {
    if (ESSENCIAIS.includes(nomeCampo) || !campos.includes(nomeCampo)) continue;
    let v = nomeCampo === 'servico_procurado'
      ? texto(b[nomeCampo], LIMITE[nomeCampo])
      : linha(b[nomeCampo], LIMITE[nomeCampo]);
    if (!v) continue;
    if (DATAS.includes(nomeCampo)) v = dataBr(v);
    if (nomeCampo === 'origem') v = ORIGENS[v] || v;
    lead[nomeCampo] = v;
  }

  lead.attribution = atribuicao(b.attribution);
  return { lead, problemas };
}

/* O texto do card: os mesmos rótulos e a mesma ordem da mensagem do
   WhatsApp, com o texto livre por último, mais a origem do clique e o ID do
   envio. O ID é o mesmo do arquivo no Blob e do log, e serve para reconhecer
   duplicata se um reenvio criar dois cards. */
export function montarDescricao(lead) {
  const linhas = [];
  for (const nome of ORDEM) {
    const v = lead[nome];
    if (!v) continue;
    if (nome === 'servico_procurado') linhas.push('', ROTULOS[nome] + ':', v);
    else linhas.push(ROTULOS[nome] + ': ' + v);
  }

  const a = lead.attribution || {};
  const origem = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ');
  const rodape = [];
  if (origem) rodape.push('Origem: ' + origem);
  if (a.utm_term) rodape.push('Termo: ' + a.utm_term);
  if (a.utm_content) rodape.push('Conteúdo: ' + a.utm_content);
  if (a.gclid) rodape.push('[ref: ' + a.gclid + ']');
  if (a.gbraid) rodape.push('[gbraid: ' + a.gbraid + ']');
  if (a.wbraid) rodape.push('[wbraid: ' + a.wbraid + ']');
  if (lead.id) rodape.push('ID do envio: ' + lead.id);

  return linhas.concat('', rodape).join('\n').trim();
}

/* O que o webhook do JSYNQ espera: name, email, phone, company e message.
   E-mail e telefone entram só quando existem. Chave vazia ou e-mail
   inventado não serve: o CRM deduplica contato por e-mail, e dois leads sem
   e-mail viraram a mesma pessoa se compartilhassem um valor. O campo
   "assunto" do código original não existe neste formulário, então
   `company` leva um valor fixo e o resto vai na descrição. */
export function montarPayload(lead) {
  const payload = { name: lead.nome };
  if (lead.email) payload.email = lead.email;
  if (lead.telefone) payload.phone = lead.telefone;
  payload.company = EMPRESA;
  payload.message = montarDescricao(lead);
  return payload;
}
