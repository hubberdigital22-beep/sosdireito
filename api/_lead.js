/**
 * O lead do formulário de /contato/, do corpo do POST até o card do projeto
 * "SOS Direito · Leads do site", no JSYNQ da Hubber. Nada aqui lê ambiente,
 * rede ou relógio, para o teste rodar sem nenhum dos três (só os ids dos
 * blocos da descrição são aleatórios).
 *
 * O servidor exige o mínimo para o lead ter caminho de volta (nome e e-mail ou
 * telefone) e aceita o resto como veio. Quem impõe as regras do formulário é o
 * form.js, que hoje pede os três. Se o servidor fosse mais rígido, qualquer
 * mudança no formulário (campo que deixa de ser obrigatório, opção nova) faria
 * o CRM recusar os leads sem erro visível, porque o WhatsApp abre do mesmo
 * jeito. Perder o lead do CRM é justamente o que esta camada existe para
 * evitar. Por isso texto acima do limite é cortado, não recusado, e telefone
 * comprido passa: o form.js só confere o mínimo de dígitos.
 *
 * Os rótulos e a ordem de ROTULOS/ORDEM são os do form.js: o teste em
 * _dev/tests confere as duas listas contra ele. ORIGENS e STATUS reproduzem as
 * <option> do formulário e o build (conferir_lead, em _dev/build.py) trava se
 * o HTML e estas listas divergirem.
 */

import { randomUUID } from 'node:crypto';
import { telefoneWhatsapp } from './_whatsapp.js';

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

/* Onde o card nasce. Fixo no código, sem variável de ambiente: uma variável
   errada na Vercel mandaria os leads para outro projeto sem ninguém perceber.
   O projeto é privado; o dono do JSYNQ_API_TOKEN precisa ser integrante dele,
   e é quem aparece como autor de cada card. */
export const JSYNQ = {
  projeto: '6ac6505b1da4055c1f0439f6',      // SOS Direito · Leads do site
  quadro: '6ac6505b1da4055c1f0439fa',
  coluna: '6ac6505b1da4055c1f043a02',       // Leads
  responsavel: '6ab13770effd9919b7232453',  // Nicolas, em todo card
  // Etiqueta "Site": é ela que dispara o primeiro atendimento por WhatsApp
  // (automação do projeto no JSYNQ). Ver _whatsapp.js.
  etiquetaSite: '6ac6d4e698afae68b322f2c9',
};

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
 * `problemas` só tem o que impede o lead de ter caminho de volta: 'nome',
 * 'email' (malformado), 'telefone' (menos de 10 dígitos, a mesma regra do
 * form.js) e 'contato' (nenhum dos dois). Quando vazio, `lead` está pronto
 * para guardar e entregar.
 */
export function validarLead(corpo, { campos = CAMPOS_NO_CRM } = {}) {
  const b = corpo && typeof corpo === 'object' ? corpo : {};
  const problemas = [];
  const lead = {};

  const nome = linha(b.nome, LIMITE.nome);
  if (nome) lead.nome = nome; else problemas.push('nome');

  const email = linha(b.email, LIMITE.email).toLowerCase();
  if (email) {
    if (RE_EMAIL.test(email)) lead.email = email; else problemas.push('email');
  }

  const tel = telefone(b.telefone);
  if (tel.valor) {
    if (tel.digitos >= 10) lead.telefone = tel.valor; else problemas.push('telefone');
  }

  // Sem nenhum dos dois: se um veio malformado, o problema já é dele.
  if (!email && !tel.valor) problemas.push('contato');

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

const PROPS = { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' };
const trecho = (text, styles = {}) => ({ type: 'text', text, styles });
const bloco = (type, content, props = {}) => ({
  id: randomUUID(), type, props: { ...PROPS, ...props }, content, children: [],
});

/* A descrição do card. O JSYNQ guarda a descrição como blocos do editor
   (BlockNote, em JSON) e descarta as linhas em branco de texto corrido, então
   as seções vão como blocos: os campos com o rótulo em negrito, nos mesmos
   rótulos e ordem da mensagem do WhatsApp; o texto livre e a origem do clique
   sob título próprio; o ID do envio por último. O ID é o mesmo do arquivo no
   Blob e do log, e serve para reconhecer duplicata se um reenvio criar dois
   cards. Quando o primeiro atendimento automático não pode sair (telefone sem
   código de país reconhecível), a descrição abre pedindo o contato à mão; com
   `aviso` (o cadastro antigo que o JSYNQ ligou ao card), alerta para não
   confiar nos campos de contato. */
export function montarDescricao(lead, { aviso = null } = {}) {
  const blocos = [];
  if (!telefoneWhatsapp(lead)) blocos.push(blocoSemWhatsapp(lead));
  if (aviso) blocos.push(blocoDoAviso(aviso));
  for (const nome of ORDEM) {
    const v = lead[nome];
    if (!v || nome === 'servico_procurado') continue;
    blocos.push(bloco('paragraph', [trecho(ROTULOS[nome] + ': ', { bold: true }), trecho(v)]));
  }

  const livre = (lead.servico_procurado || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (livre.length) {
    blocos.push(bloco('heading', [trecho(ROTULOS.servico_procurado)], { level: 3 }));
    for (const l of livre) blocos.push(bloco('paragraph', [trecho(l)]));
  }

  const a = lead.attribution || {};
  const origem = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ');
  const rastreio = [];
  if (origem) rastreio.push('Origem: ' + origem);
  if (a.utm_term) rastreio.push('Termo: ' + a.utm_term);
  if (a.utm_content) rastreio.push('Conteúdo: ' + a.utm_content);
  if (a.gclid) rastreio.push('[ref: ' + a.gclid + ']');
  if (a.gbraid) rastreio.push('[gbraid: ' + a.gbraid + ']');
  if (a.wbraid) rastreio.push('[wbraid: ' + a.wbraid + ']');
  if (rastreio.length) {
    blocos.push(bloco('heading', [trecho('Origem do lead')], { level: 3 }));
    for (const l of rastreio) blocos.push(bloco('paragraph', [trecho(l)]));
  }

  if (lead.id) {
    blocos.push(bloco('paragraph', [trecho('ID do envio: ' + lead.id, { italic: true })], { textColor: 'gray' }));
  }
  return JSON.stringify(blocos);
}

/* Vermelho: a automação do JSYNQ não vai mandar nada para este lead. */
function blocoSemWhatsapp(lead) {
  const motivo = lead.telefone
    ? `não deu para saber o código do país do telefone "${lead.telefone}"`
    : 'a pessoa não deixou telefone';
  return bloco('paragraph', [
    trecho('WhatsApp automático não sai para este lead: ', { bold: true }),
    trecho(`${motivo}. Chamar a pessoa à mão.`),
  ], { backgroundColor: 'red' });
}

function blocoDoAviso(antigo) {
  const cadastro = [antigo.nome, antigo.email, antigo.telefone].filter(Boolean)
    .concat(antigo.empresa ? ['empresa ' + antigo.empresa] : []).join(' · ');
  return bloco('paragraph', [
    trecho('Atenção: ', { bold: true }),
    trecho('o JSYNQ ligou este card a um contato que já existia no CRM, com o mesmo e-mail ou '
      + 'telefone. Os campos de contato e a empresa mostram esse cadastro antigo (' + cadastro
      + '). O que a pessoa enviou agora está abaixo.'),
  ], { backgroundColor: 'yellow' });
}

/* O contato que ficou gravado no card, lido do que a API devolve: os campos
   de contato em customFields ou, na falta deles, no topo do card. */
export function contatoGravado(card) {
  const c = card && typeof card === 'object' ? card : {};
  const campos = Array.isArray(c.customFields) ? c.customFields : [];
  const valor = (id) => {
    const f = campos.find((x) => x && x.fieldId === id && x.value != null && String(x.value).trim());
    if (f) return String(f.value).trim();
    return typeof c[id] === 'string' ? c[id].trim() : '';
  };
  return { nome: valor('contactName'), email: valor('email'), telefone: valor('phone'), empresa: valor('company') };
}

const comparavel = (v) => String(v || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
const digitos = (v) => String(v || '').replace(/\D/g, '');

/* O telefone que vai para o contato do card: com "+" e o código do país
   quando ele é conhecido, que é o formato que o WhatsApp do JSYNQ usa. */
export function telefoneDoCrm(lead) {
  const n = telefoneWhatsapp(lead);
  return n ? '+' + n : lead.telefone;
}

/* O CRM junta contato por e-mail e também por telefone (medido em
   07/10/2026). Quando junta, os campos de contato do card passam a mostrar o
   cadastro que já existia, não o que a pessoa mandou. Devolve esse cadastro
   antigo, ou null quando o card ficou com o contato enviado. Empresa no card
   também denuncia o cadastro antigo: o site nunca manda empresa. */
export function contatoDeOutroCadastro(lead, card) {
  const g = contatoGravado(card);
  const difere = (g.nome && comparavel(g.nome) !== comparavel(lead.nome))
    || (g.email && comparavel(g.email) !== comparavel(lead.email))
    || (g.telefone && digitos(g.telefone) !== digitos(telefoneDoCrm(lead))
      && digitos(g.telefone) !== digitos(lead.telefone))
    || Boolean(g.empresa);
  return difere ? g : null;
}

/* Os três campos de contato que todo projeto CRM do JSYNQ já traz (não são
   campos personalizados): com eles o JSYNQ cria o contato. Vão em
   customFields, com o id do próprio campo, e não no topo do card: pela API,
   nome, e-mail e telefone no topo saem gravados duas vezes (medido em
   07/10/2026). */
const CONTATO = [
  { fieldId: 'contactName', fieldName: 'Contact name', fieldType: 'text', chave: 'nome' },
  { fieldId: 'email', fieldName: 'Email', fieldType: 'email', chave: 'email' },
  { fieldId: 'phone', fieldName: 'Phone', fieldType: 'text', chave: 'telefone' },
];

/* O corpo de POST /api/projects/{projeto}/cards. Só o contato vai em campo;
   todo o resto, inclusive a origem do clique, fica só na descrição. E-mail e
   telefone entram só quando existem. Chave vazia ou e-mail inventado não
   serve: o CRM deduplica contato por e-mail, e dois leads sem e-mail virariam
   a mesma pessoa se compartilhassem um valor. */
export function montarCard(lead) {
  return {
    title: lead.nome,
    type: 'task',
    board: JSYNQ.quadro,
    column: JSYNQ.coluna,
    assignedUsers: [JSYNQ.responsavel],
    // Sem país conhecido, nada de etiqueta: a automação não dispara e não
    // manda mensagem para um número incompleto.
    labels: telefoneWhatsapp(lead) ? [JSYNQ.etiquetaSite] : [],
    customFields: CONTATO.filter((c) => lead[c.chave])
      .map(({ fieldId, fieldName, fieldType, chave }) => ({
        fieldId, fieldName, fieldType, value: chave === 'telefone' ? telefoneDoCrm(lead) : lead[chave],
      })),
    desc: montarDescricao(lead),
  };
}
