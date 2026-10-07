/* Testes do caminho do lead: validação, card, entrega ao JSYNQ, fila no Blob
   e a rota. Tudo sem rede: o Blob é um Map e o fetch é trocado.

   Rodar:  npm test   (ou  node --test "_dev/tests/*.test.mjs")
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  validarLead, montarCard, montarDescricao, contatoGravado, contatoDeOutroCadastro,
  ROTULOS, ORDEM, ORIGENS, STATUS, CAMPOS_NO_CRM, JSYNQ,
} from '../../api/_lead.js';
import { criarFila } from '../../api/_fila.js';
import { criarHandler, entregarLead } from '../../api/lead.js';
import { criarHandler as criarDrenar } from '../../api/drenar.js';

const TOKEN = 'tok-secreto-123';
const URL_CARDS = 'https://api.jsynq.com/api/projects/6ac6505b1da4055c1f0439f6/cards';

const CORPO = {
  nome: '  Maria Souza ',
  email: 'Maria@Exemplo.com',
  telefone: '(11) 99999-9999',
  pais: 'Brazil',
  origem: 'google',
  area_atuacao: 'Tecnologia',
  graduacao: 'Engenharia',
  ano_graduacao: '2010',
  melhor_horario: 'Manhã',
  ultima_entrada_eua: '2026-01-10',
  expiracao_i94: '2026-07-10',
  status_imigratorio: 'Turista',
  servico_procurado: 'Quero um L-1A.\nTenho empresa no Brasil.',
  attribution: { gclid: 'abc123def456', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'l1a', utm_term: '', extra: 'x' },
};

const com = (extra) => ({ ...CORPO, ...extra });

/* ---------- validação ---------- */

test('lead completo: normaliza e não devolve problemas', () => {
  const { lead, problemas } = validarLead(CORPO);
  assert.deepEqual(problemas, []);
  assert.equal(lead.nome, 'Maria Souza');
  assert.equal(lead.email, 'maria@exemplo.com');
  assert.equal(lead.origem, 'Google');
  assert.equal(lead.ultima_entrada_eua, '10/01/2026');
  assert.equal(lead.expiracao_i94, '10/07/2026');
  assert.equal(lead.servico_procurado, 'Quero um L-1A.\nTenho empresa no Brasil.');
  assert.deepEqual(lead.attribution, { gclid: 'abc123def456', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'l1a' });
});

test('basta e-mail ou telefone: o card nasce com o que veio', () => {
  const soTel = validarLead(com({ email: '' }));
  assert.deepEqual(soTel.problemas, []);
  assert.equal(soTel.lead.email, undefined);
  const soEmail = validarLead(com({ telefone: '' }));
  assert.deepEqual(soEmail.problemas, []);
  assert.equal(soEmail.lead.telefone, undefined);
});

test('sem e-mail e sem telefone o problema é "contato"', () => {
  assert.deepEqual(validarLead(com({ email: '', telefone: '' })).problemas, ['contato']);
  assert.deepEqual(validarLead(com({ email: '   ', telefone: undefined })).problemas, ['contato']);
});

test('nome é obrigatório', () => {
  assert.deepEqual(validarLead(com({ nome: '   ' })).problemas, ['nome']);
  assert.deepEqual(validarLead(com({ nome: undefined })).problemas, ['nome']);
});

test('e-mail malformado e telefone curto são apontados, mesmo com o outro contato certo', () => {
  assert.deepEqual(validarLead(com({ email: 'maria@' })).problemas, ['email']);
  assert.deepEqual(validarLead(com({ telefone: '(11) 9999' })).problemas, ['telefone']);
});

test('telefone comprido passa: o form.js só confere o mínimo de dígitos', () => {
  const { lead, problemas } = validarLead(com({ telefone: '(11) 99999-9999 / (11) 98888-8888' }));
  assert.deepEqual(problemas, []);
  assert.equal(lead.telefone, '(11) 99999-9999 (11) 98888-8888');
});

test('internacional: número dos EUA e do Brasil com DDI passam', () => {
  assert.deepEqual(validarLead(com({ telefone: '+1 786 301 3817' })).problemas, []);
  assert.deepEqual(validarLead(com({ telefone: '+55 (11) 99999-9999' })).problemas, []);
});

test('o servidor NÃO é mais rígido que o formulário: campos opcionais e valores estranhos passam', () => {
  const { lead, problemas } = validarLead({
    nome: 'Ana', email: 'ana@exemplo.com', telefone: '(11) 99999-9999',
    status_imigratorio: 'Opção nova que o servidor não conhece',
    origem: 'podcast',
    ultima_entrada_eua: 'ontem',
    ano_graduacao: '20',
  });
  assert.deepEqual(problemas, []);
  assert.equal(lead.status_imigratorio, 'Opção nova que o servidor não conhece');
  assert.equal(lead.origem, 'podcast');
  assert.equal(lead.ultima_entrada_eua, 'ontem');
  assert.equal(lead.ano_graduacao, '20');
});

test('data impossível de calendário passa crua em vez de virar outra data', () => {
  assert.equal(validarLead(com({ ultima_entrada_eua: '2026-02-30' })).lead.ultima_entrada_eua, '2026-02-30');
});

test('texto longo é cortado, não recusado', () => {
  const { lead, problemas } = validarLead(com({ nome: 'A'.repeat(500), servico_procurado: 'x'.repeat(9000) }));
  assert.deepEqual(problemas, []);
  assert.equal(lead.nome.length, 120);
  assert.equal(lead.servico_procurado.length, 4000);
});

test('caracteres de controle saem e o texto livre mantém as quebras de linha', () => {
  const { lead } = validarLead(com({ nome: 'Ma\u0000ria\u0007', servico_procurado: 'a\r\nb\u0001c' }));
  assert.equal(lead.nome, 'Maria');
  assert.equal(lead.servico_procurado, 'a\nbc');
});

test('corpo que não é objeto vira "nome" e "contato", sem exceção', () => {
  for (const ruim of [null, undefined, 'texto', 42, []]) {
    assert.deepEqual(validarLead(ruim).problemas, ['nome', 'contato']);
  }
});

test('campos fora de CAMPOS_NO_CRM são descartados antes de guardar (minimização)', () => {
  const so = ['nome', 'email', 'telefone', 'pais', 'origem', 'area_atuacao', 'graduacao', 'ano_graduacao', 'melhor_horario'];
  const { lead } = validarLead(CORPO, { campos: so });
  assert.equal(lead.status_imigratorio, undefined);
  assert.equal(lead.ultima_entrada_eua, undefined);
  assert.equal(lead.expiracao_i94, undefined);
  assert.equal(lead.servico_procurado, undefined);
  assert.equal(lead.area_atuacao, 'Tecnologia');
  assert.doesNotMatch(JSON.stringify(lead), /Turista|L-1A|10\/01\/2026/);
});

test('hoje o CRM recebe os 13 campos', () => {
  assert.deepEqual(CAMPOS_NO_CRM, ORDEM);
  assert.equal(ORDEM.length, 13);
});

/* ---------- texto do card e payload ---------- */

test('as listas do servidor batem com as <option> do formulário', () => {
  const html = readFileSync(new URL('../../_dev/pages/08-contato.html', import.meta.url), 'utf8');
  const opcoes = (nome) => {
    const sel = new RegExp(`<select[^>]*name="${nome}"[^>]*>([\\s\\S]*?)</select>`).exec(html)[1];
    return [...sel.matchAll(/<option value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g)]
      .filter((m) => m[1]).map((m) => [m[1], m[2].replace(/\s+/g, ' ').trim()]);
  };
  assert.deepEqual(opcoes('origem').sort(), Object.entries(ORIGENS).sort());
  assert.deepEqual(opcoes('status_imigratorio').map((o) => o[0]).sort(), [...STATUS].sort());
});

/* A descrição é BlockNote em JSON. Para conferir o conteúdo, cada bloco vira
   uma linha de texto, e título ganha "# " na frente. */
const linhasDe = (desc) => JSON.parse(desc).map((b) =>
  (b.type === 'heading' ? '# ' : '') + b.content.map((c) => c.text).join(''));

test('descrição do card: rótulos na ordem, texto livre e origem sob título próprio, ID por último', () => {
  const { lead } = validarLead(CORPO);
  lead.id = 'm3k2x9a1-f4k2zq';
  const d = montarDescricao(lead);
  assert.deepEqual(linhasDe(d), [
    'Nome: Maria Souza',
    'E-mail: maria@exemplo.com',
    'Telefone: (11) 99999-9999',
    'País: Brazil',
    'Como nos conheceu: Google',
    'Área de atuação: Tecnologia',
    'Graduação: Engenharia',
    'Ano de conclusão: 2010',
    'Melhor horário para contato: Manhã',
    'Última entrada nos EUA: 10/01/2026',
    'Expiração da I-94: 10/07/2026',
    'Status imigratório nos EUA: Turista',
    '# Serviço procurado',
    'Quero um L-1A.',
    'Tenho empresa no Brasil.',
    '# Origem do lead',
    'Origem: google / cpc / l1a',
    '[ref: abc123def456]',
    'ID do envio: m3k2x9a1-f4k2zq',
  ]);
  assert.doesNotMatch(d, /undefined|\[object/);
});

test('descrição: formato de blocos que o JSYNQ guarda, com rótulo em negrito e ids únicos', () => {
  const blocos = JSON.parse(montarDescricao({ ...validarLead(CORPO).lead, id: 'b-1' }));
  const ids = blocos.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of blocos) {
    assert.match(b.id, /^[0-9a-f-]{36}$/);
    assert.ok(['paragraph', 'heading'].includes(b.type));
    assert.equal(b.props.textAlignment, 'left');
    assert.deepEqual(b.children, []);
    for (const c of b.content) assert.equal(c.type, 'text');
  }
  assert.deepEqual(blocos[0].content, [
    { type: 'text', text: 'Nome: ', styles: { bold: true } },
    { type: 'text', text: 'Maria Souza', styles: {} },
  ]);
  for (const b of blocos.filter((x) => x.type === 'heading')) assert.equal(b.props.level, 3);
  const ultimo = blocos.at(-1);
  assert.equal(ultimo.props.textColor, 'gray');
  assert.deepEqual(ultimo.content[0].styles, { italic: true });
});

test('descrição: texto livre vira um parágrafo por linha, sem linha vazia', () => {
  const lead = validarLead(com({ servico_procurado: 'Linha 1\r\n\r\n  Linha 2  \n\n' })).lead;
  const l = linhasDe(montarDescricao(lead));
  assert.deepEqual(l.slice(l.indexOf('# Serviço procurado'), l.indexOf('# Origem do lead')),
    ['# Serviço procurado', 'Linha 1', 'Linha 2']);
});

test('descrição leva todos os parâmetros de origem que o site guarda, e só os preenchidos', () => {
  const { lead, problemas } = validarLead(com({ attribution: {
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'l1a', utm_term: 'visto l1a', utm_content: 'anuncio-2',
    gclid: 'g1', gbraid: 'gb1', wbraid: 'wb1', outro: 'x' } }));
  assert.deepEqual(problemas, []);
  lead.id = 'x-2';
  const l = linhasDe(montarDescricao(lead));
  assert.deepEqual(l.slice(l.indexOf('# Origem do lead')), [
    '# Origem do lead', 'Origem: google / cpc / l1a', 'Termo: visto l1a', 'Conteúdo: anuncio-2',
    '[ref: g1]', '[gbraid: gb1]', '[wbraid: wb1]', 'ID do envio: x-2',
  ]);
});

test('descrição sem atribuição nem campos opcionais não deixa título vazio nem "undefined"', () => {
  const { lead } = validarLead({ nome: 'Ana', email: 'ana@exemplo.com' });
  lead.id = 'x-1';
  const d = montarDescricao(lead);
  assert.deepEqual(linhasDe(d), ['Nome: Ana', 'E-mail: ana@exemplo.com', 'ID do envio: x-1']);
  assert.doesNotMatch(d, /undefined|\[object/);
});

test('card: projeto da SOS no JSYNQ da Hubber, coluna Leads e o Nicolas como responsável', () => {
  assert.deepEqual(JSYNQ, {
    projeto: '6ac6505b1da4055c1f0439f6',
    quadro: '6ac6505b1da4055c1f0439fa',
    coluna: '6ac6505b1da4055c1f043a02',
    responsavel: '6ab13770effd9919b7232453',
  });
  const lead = { ...validarLead(CORPO).lead, id: 'c-1' };
  const card = montarCard(lead);
  assert.deepEqual(Object.keys(card),
    ['title', 'type', 'board', 'column', 'assignedUsers', 'customFields', 'desc']);
  assert.equal(card.title, 'Maria Souza');
  assert.equal(card.board, JSYNQ.quadro);
  assert.equal(card.column, JSYNQ.coluna);
  assert.deepEqual(card.assignedUsers, [JSYNQ.responsavel]);
  assert.deepEqual(card.customFields, [
    { fieldId: 'contactName', fieldName: 'Contact name', fieldType: 'text', value: 'Maria Souza' },
    { fieldId: 'email', fieldName: 'Email', fieldType: 'email', value: 'maria@exemplo.com' },
    { fieldId: 'phone', fieldName: 'Phone', fieldType: 'text', value: '(11) 99999-9999' },
  ]);
  assert.deepEqual(linhasDe(card.desc), linhasDe(montarDescricao(lead)));
});

test('card: contato só em customFields, nunca no topo (pela API, no topo ele sai em dobro)', () => {
  const card = montarCard({ ...validarLead(CORPO).lead, id: 'c-3' });
  for (const k of ['contactName', 'email', 'phone', 'company']) assert.ok(!(k in card), k);
});

test('card: dados de rastreio só na descrição, nunca em campo personalizado', () => {
  const lead = { ...validarLead(com({ attribution: {
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'l1a', utm_term: 'visto', utm_content: 'v2',
    gclid: 'g1', gbraid: 'gb1', wbraid: 'wb1' } })).lead, id: 'c-2' };
  const card = montarCard(lead);
  assert.deepEqual(card.customFields.map((c) => c.fieldId), ['contactName', 'email', 'phone']);
  const { desc, ...resto } = card;
  assert.doesNotMatch(JSON.stringify(resto), /google|cpc|l1a|visto|v2|g1|gb1|wb1|c-2/);
  const l = linhasDe(desc);
  for (const v of ['Origem: google / cpc / l1a', 'Termo: visto', 'Conteúdo: v2',
    '[ref: g1]', '[gbraid: gb1]', '[wbraid: wb1]', 'ID do envio: c-2']) assert.ok(l.includes(v), v);
});

test('card: e-mail e telefone só quando existem', () => {
  const campos = (card) => Object.fromEntries(card.customFields.map((c) => [c.fieldId, c.value]));
  assert.deepEqual(campos(montarCard(validarLead(com({ email: '' })).lead)),
    { contactName: 'Maria Souza', phone: '(11) 99999-9999' });
  assert.deepEqual(campos(montarCard(validarLead(com({ telefone: '' })).lead)),
    { contactName: 'Maria Souza', email: 'maria@exemplo.com' });
});

/* ---------- entrega ao JSYNQ ---------- */

function fetchFalso(respostas) {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    return new Response(r.corpo ?? '', { status: r.status });
  };
  return { chamadas, restaurar: () => { globalThis.fetch = original; } };
}

function calarConsole() {
  const originais = { error: console.error, log: console.log };
  const linhas = [];
  console.error = (...a) => linhas.push(a.join(' '));
  console.log = (...a) => linhas.push(a.join(' '));
  return { linhas, restaurar: () => { console.error = originais.error; console.log = originais.log; } };
}

/* O WhatsApp tem testes próprios mais abaixo; nos de entrega ele é trocado
   por um resultado pronto, para cada teste contar só as chamadas do card. */
const ZAP_OK = { ok: true, enviados: ['mensagem de boas-vindas'], para: '+55 11 99999-9999', de: '+1 (689) 280-2039' };
const semEspera = { esperar: async () => {}, whatsapp: async () => ZAP_OK };

test('entrega: 201 de primeira, um POST autenticado com o card na rota de cards do projeto', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'a-1' };
  const f = fetchFalso([{ status: 201, corpo: JSON.stringify({ newCard: cardGravado('k', 'SDL-1', lead) }) }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead(lead, TOKEN, semEspera), true);
    assert.equal(f.chamadas.length, 2);
    assert.equal(f.chamadas[1].url, URL_CARDS + '/k');
    assert.equal(f.chamadas[1].opcoes.method, 'PUT');
    assert.equal(f.chamadas[0].url, URL_CARDS);
    assert.equal(f.chamadas[0].opcoes.method, 'POST');
    assert.equal(f.chamadas[0].opcoes.headers['content-type'], 'application/json');
    assert.equal(f.chamadas[0].opcoes.headers.authorization, 'Bearer ' + TOKEN);
    const { desc, ...enviado } = JSON.parse(f.chamadas[0].opcoes.body);
    const { desc: esperada, ...card } = montarCard(lead);
    assert.deepEqual(enviado, card);
    assert.deepEqual(linhasDe(desc), linhasDe(esperada));
    assert.match(c.linhas.join('\n'), /SDL-1.*a-1/);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: espaço e quebra de linha em volta do token não vão no cabeçalho', async () => {
  const f = fetchFalso([{ status: 201 }]);
  const c = calarConsole();
  try {
    await entregarLead({ ...validarLead(CORPO).lead, id: 'a-8' }, `  ${TOKEN}\n`, semEspera);
    assert.equal(f.chamadas[0].opcoes.headers.authorization, 'Bearer ' + TOKEN);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: token que já vem com "Bearer" não ganha outro', async () => {
  const f = fetchFalso([{ status: 201 }]);
  const c = calarConsole();
  try {
    await entregarLead({ ...validarLead(CORPO).lead, id: 'a-0' }, 'Bearer ' + TOKEN, semEspera);
    assert.equal(f.chamadas[0].opcoes.headers.authorization, 'Bearer ' + TOKEN);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: 2xx que diz no corpo que não gravou devolve false, para o lead ficar na fila', async () => {
  for (const corpo of [{ status: false, message: 'erro' }, { success: false }]) {
    const f = fetchFalso([{ status: 200, corpo: JSON.stringify(corpo) }]);
    const c = calarConsole();
    try {
      assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-7' }, TOKEN, semEspera), false);
      assert.equal(f.chamadas.length, 1);
    } finally { f.restaurar(); c.restaurar(); }
  }
});

test('entrega: 500, 500, 200 → true na terceira tentativa', async () => {
  const f = fetchFalso([{ status: 500 }, { status: 502 }, { status: 201 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-2' }, TOKEN, semEspera), true);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: 500 três vezes → false', async () => {
  const f = fetchFalso([{ status: 500 }, { status: 500 }, { status: 500 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-3' }, TOKEN, semEspera), false);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: erro de rede é tentado de novo', async () => {
  const f = fetchFalso([new Error('fetch failed'), new Error('fetch failed'), { status: 200 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-4' }, TOKEN, semEspera), true);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: 4xx não repete (o mesmo corpo daria a mesma resposta)', async () => {
  const f = fetchFalso([{ status: 400, corpo: 'payload inválido' }, { status: 200 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-5' }, TOKEN, semEspera), false);
    assert.equal(f.chamadas.length, 1);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: o token nunca aparece no log', async () => {
  const f = fetchFalso([{ status: 500 }, new Error('boom'), { status: 401, corpo: 'token inválido' }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-6' }, TOKEN, semEspera), false);
    assert.ok(c.linhas.length > 0);
    for (const l of c.linhas) assert.ok(!l.includes('tok-secreto'), l);
  } finally { f.restaurar(); c.restaurar(); }
});

/* ---------- contato que já existia no CRM ---------- */

/* O card como a API devolve depois de criar: campos de contato em
   customFields. Sem `outro`, com o contato que foi enviado. */
function cardGravado(id, slug, lead, outro = null) {
  const c = outro || { nome: lead.nome, email: lead.email, telefone: lead.telefone };
  const customFields = [
    { fieldId: 'contactName', value: c.nome },
    { fieldId: 'email', value: c.email },
    { fieldId: 'phone', value: c.telefone },
  ].filter((x) => x.value);
  if (c.empresa) customFields.push({ fieldId: 'company', value: c.empresa });
  return { _id: id, slug, customFields };
}

const ANTIGO = { nome: 'nome responsavel site teste', email: 'email@siteteste.com',
  telefone: '99999999999', empresa: 'nome empresa site teste' };

test('contato gravado: lê os campos de contato do card, ou do topo quando faltam', () => {
  assert.deepEqual(contatoGravado(cardGravado('k', 'S', null, ANTIGO)), ANTIGO);
  assert.deepEqual(contatoGravado({ contactName: 'Ana', email: 'a@b.co', phone: '1', company: '' }),
    { nome: 'Ana', email: 'a@b.co', telefone: '1', empresa: '' });
  assert.deepEqual(contatoGravado(null), { nome: '', email: '', telefone: '', empresa: '' });
});

test('outro cadastro: mesmo contato (fora formato e maiúsculas) não avisa', () => {
  const lead = validarLead(CORPO).lead;
  assert.equal(contatoDeOutroCadastro(lead, cardGravado('k', 'S', lead)), null);
  assert.equal(contatoDeOutroCadastro(lead, cardGravado('k', 'S', null,
    { nome: ' MARIA  souza ', email: 'MARIA@exemplo.com', telefone: '11 999999999' })), null);
  assert.equal(contatoDeOutroCadastro(lead, {}), null);
});

test('outro cadastro: nome, e-mail, telefone diferente ou empresa no card avisam', () => {
  const lead = validarLead(CORPO).lead;
  assert.deepEqual(contatoDeOutroCadastro(lead, cardGravado('k', 'S', null, ANTIGO)), ANTIGO);
  const base = { nome: lead.nome, email: lead.email, telefone: lead.telefone };
  for (const troca of [{ nome: 'Outra' }, { email: 'x@y.co' }, { telefone: '21 988887777' }, { empresa: 'ACME' }]) {
    assert.ok(contatoDeOutroCadastro(lead, cardGravado('k', 'S', null, { ...base, ...troca })), JSON.stringify(troca));
  }
  // Lead só com telefone que caiu num cadastro com e-mail: é outro cadastro.
  const soTel = validarLead(com({ email: '' })).lead;
  assert.ok(contatoDeOutroCadastro(soTel, cardGravado('k', 'S', null, { ...base, email: 'velho@x.co' })));
});

test('descrição com aviso: alerta amarelo no topo com o cadastro antigo, o resto igual', () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-1' };
  const blocos = JSON.parse(montarDescricao(lead, { aviso: ANTIGO }));
  assert.equal(blocos[0].props.backgroundColor, 'yellow');
  const alerta = blocos[0].content.map((c) => c.text).join('');
  assert.match(alerta, /^Atenção: o JSYNQ ligou este card a um contato que já existia/);
  assert.match(alerta, /nome responsavel site teste · email@siteteste\.com · 99999999999 · empresa nome empresa site teste/);
  assert.deepEqual(linhasDe(JSON.stringify(blocos.slice(1))), linhasDe(montarDescricao(lead)));
});

test('entrega: JSYNQ juntou com contato antigo → põe o aviso na descrição pelo PUT do card', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-2' };
  const f = fetchFalso([
    { status: 201, corpo: JSON.stringify({ newCard: cardGravado('c9', 'SDL-9', lead, ANTIGO) }) },
    { status: 200, corpo: '{}' },
  ]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead(lead, TOKEN, semEspera), true);
    assert.equal(f.chamadas.length, 2);
    assert.equal(f.chamadas[1].url, URL_CARDS + '/c9');
    assert.equal(f.chamadas[1].opcoes.method, 'PUT');
    assert.equal(f.chamadas[1].opcoes.headers.authorization, 'Bearer ' + TOKEN);
    const corpo = JSON.parse(f.chamadas[1].opcoes.body);
    assert.deepEqual(Object.keys(corpo), ['desc']);
    const linhas = linhasDe(corpo.desc);
    assert.match(linhas[0], /^WhatsApp automático enviado/);
    assert.match(linhas[1], /^Atenção:.*nome responsavel site teste/);
    assert.equal(linhas[2], 'Nome: Maria Souza');
    assert.match(c.linhas.join('\n'), /SDL-9 ligado a contato que já existia/);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: resposta sem campos de contato → lê o card e só avisa se for outro cadastro', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-3' };
  let f = fetchFalso([
    { status: 201, corpo: JSON.stringify({ newCard: { _id: 'c1', slug: 'SDL-1' } }) },
    { status: 200, corpo: JSON.stringify({ card: cardGravado('c1', 'SDL-1', lead, ANTIGO) }) },
    { status: 200, corpo: '{}' },
  ]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead(lead, TOKEN, semEspera), true);
    assert.deepEqual(f.chamadas.map((x) => x.opcoes.method || 'GET'), ['POST', 'GET', 'PUT']);
    assert.equal(f.chamadas[1].url, URL_CARDS + '/c1');
    f.restaurar();

    f = fetchFalso([
      { status: 201, corpo: JSON.stringify({ newCard: { _id: 'c2', slug: 'SDL-2' } }) },
      { status: 200, corpo: JSON.stringify({ card: cardGravado('c2', 'SDL-2', lead) }) },
      { status: 200, corpo: '{}' },
    ]);
    assert.equal(await entregarLead(lead, TOKEN, semEspera), true);
    assert.deepEqual(f.chamadas.map((x) => x.opcoes.method || 'GET'), ['POST', 'GET', 'PUT']);
    assert.doesNotMatch(JSON.parse(f.chamadas[2].opcoes.body).desc, /Atenção/);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: atualização da descrição que falha ou lança não muda o resultado nem tenta criar de novo', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-4' };
  for (const segunda of [{ status: 500, corpo: 'erro' }, new Error('rede caiu')]) {
    const f = fetchFalso([
      { status: 201, corpo: JSON.stringify({ newCard: cardGravado('c3', 'SDL-3', lead, ANTIGO) }) },
      segunda,
    ]);
    const c = calarConsole();
    try {
      assert.equal(await entregarLead(lead, TOKEN, semEspera), true);
      assert.equal(f.chamadas.filter((x) => x.opcoes.method === 'POST').length, 1);
      assert.match(c.linhas.join('\n'), /SDL-3 descrição não atualizada/);
    } finally { f.restaurar(); c.restaurar(); }
  }
});

test('entrega: criação demorada pula o WhatsApp, e o card diz que falta chamar à mão', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-5' };
  const f = fetchFalso([
    { status: 201, corpo: JSON.stringify({ newCard: cardGravado('c4', 'SDL-4', lead) }) },
    { status: 200, corpo: '{}' },
  ]);
  const c = calarConsole();
  let chamouZap = false;
  const relatorio = {};
  try {
    // Faltam 20 s para o limite: cabe criar (8 s), não cabe a sequência (25 s).
    assert.equal(await entregarLead(lead, TOKEN, {
      ...semEspera, relatorio, agora: () => 30000, limite: 50000,
      whatsapp: async () => { chamouZap = true; return ZAP_OK; },
    }), true);
    assert.equal(chamouZap, false);
    assert.equal(relatorio.whatsapp, 'nao_enviado');
    assert.deepEqual(f.chamadas.map((x) => x.opcoes.method), ['POST', 'PUT']);
    assert.match(linhasDe(JSON.parse(f.chamadas[1].opcoes.body).desc)[0], /^WhatsApp automático NÃO enviado: o card demorou a ser criado/);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: sem tempo para criar o card nem tenta, e o lead fica na fila', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-7' };
  const f = fetchFalso([]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead(lead, TOKEN, { ...semEspera, agora: () => 45000, limite: 50000 }), false);
    assert.equal(f.chamadas.length, 0);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: o prazo do WhatsApp guarda tempo para reescrever a descrição', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-8' };
  const f = fetchFalso([{ status: 201, corpo: JSON.stringify({ newCard: cardGravado('c6', 'SDL-6', lead) }) }, { status: 200 }]);
  const c = calarConsole();
  let prazo;
  try {
    await entregarLead(lead, TOKEN, {
      ...semEspera, agora: () => 1000, limite: 50000,
      whatsapp: async (l, id, a, opcoes) => { prazo = opcoes.prazo; return ZAP_OK; },
    });
    assert.equal(prazo, 45000);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: relatório diz ao handler se o WhatsApp saiu', async () => {
  const lead = { ...validarLead(CORPO).lead, id: 'w-6' };
  for (const [zap, esperado] of [[ZAP_OK, 'enviado'], [{ ok: false, enviados: [], motivo: 'x' }, 'nao_enviado']]) {
    const f = fetchFalso([{ status: 201, corpo: JSON.stringify({ newCard: cardGravado('c5', 'SDL-5', lead) }) }, { status: 200 }]);
    const c = calarConsole();
    const relatorio = {};
    try {
      await entregarLead(lead, TOKEN, { ...semEspera, relatorio, whatsapp: async () => zap });
      assert.equal(relatorio.whatsapp, esperado);
    } finally { f.restaurar(); c.restaurar(); }
  }
});

/* ---------- fila (Blob falso) ---------- */

function blobFalso() {
  const itens = new Map();
  let t = 0;
  return {
    itens,
    async put(caminho, corpo) {
      if (itens.has(caminho)) throw new Error('já existe');
      itens.set(caminho, { corpo, uploadedAt: new Date(Date.UTC(2026, 8, 1, 0, 0, t++)) });
      return { pathname: caminho };
    },
    async list({ prefix, limit }) {
      const blobs = [...itens.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit)
        .map((pathname) => ({ pathname, uploadedAt: itens.get(pathname).uploadedAt }));
      return { blobs };
    },
    async get(caminho) {
      const i = itens.get(caminho);
      return i ? { statusCode: 200, stream: new Response(i.corpo).body } : null;
    },
    async del(caminho) { itens.delete(caminho); },
  };
}

test('fila: guardar grava em pendentes/lead/<id>.json e concluir apaga', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => true });
  const caminho = await fila.guardar('lead', { id: 'k1-aaa', nome: 'Ana' });
  assert.equal(caminho, 'pendentes/lead/k1-aaa.json');
  assert.equal(blob.itens.size, 1);
  assert.equal(JSON.parse(blob.itens.get(caminho).corpo).dados.nome, 'Ana');
  await fila.concluir(caminho);
  assert.equal(blob.itens.size, 0);
  await fila.concluir(caminho); // repetir não quebra
  await fila.concluir(null);
});

test('fila desligada (sem Blob): tudo vira no-op', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => false });
  assert.equal(await fila.guardar('lead', { id: 'x' }), null);
  assert.deepEqual(await fila.drenar('lead', async () => true), { pendentes: 0, entregues: 0 });
  assert.deepEqual(await fila.resumo('lead'), { total: 0, maisAntigo: null });
  assert.equal(blob.itens.size, 0);
});

test('fila: erro do Blob ao guardar devolve null e não lança', async () => {
  const blob = blobFalso();
  blob.put = async () => { throw new Error('Blob fora'); };
  const c = calarConsole();
  try {
    const fila = criarFila({ blob, ativa: () => true });
    assert.equal(await fila.guardar('lead', { id: 'x' }), null);
  } finally { c.restaurar(); }
});

test('fila: drenar entrega do mais antigo ao mais novo, respeita o limite e só apaga o que foi aceito', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => true });
  for (const id of ['k1-a', 'k2-b', 'k3-c', 'k4-d']) await fila.guardar('lead', { id, nome: id });

  const vistos = [];
  const r = await fila.drenar('lead', async (d) => { vistos.push(d.id); return d.id !== 'k2-b'; }, 3);
  assert.deepEqual(vistos, ['k1-a', 'k2-b', 'k3-c']);
  assert.deepEqual(r, { pendentes: 3, entregues: 2 });
  assert.deepEqual([...blob.itens.keys()].sort(), ['pendentes/lead/k2-b.json', 'pendentes/lead/k4-d.json']);
});

test('fila: falha ou exceção na entrega deixa o item e segue para o próximo', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => true });
  await fila.guardar('lead', { id: 'k1-a' });
  await fila.guardar('lead', { id: 'k2-b' });
  const c = calarConsole();
  try {
    const r = await fila.drenar('lead', async (d) => { if (d.id === 'k1-a') throw new Error('rede'); return true; }, 10);
    assert.deepEqual(r, { pendentes: 2, entregues: 1 });
    assert.deepEqual([...blob.itens.keys()], ['pendentes/lead/k1-a.json']);
  } finally { c.restaurar(); }
});

test('fila: resumo conta os pendentes e acha o mais antigo', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => true });
  await fila.guardar('lead', { id: 'k1-a' });
  await fila.guardar('lead', { id: 'k2-b' });
  const r = await fila.resumo('lead');
  assert.equal(r.total, 2);
  assert.equal(r.maisAntigo, '2026-09-01T00:00:00.000Z');
});

/* ---------- a rota ---------- */

function filaEspia({ ativa = true, guardarFalha = false } = {}) {
  const ordem = [];
  return {
    ordem,
    ativa: () => ativa,
    async guardar(tipo, dados) {
      ordem.push('guardar');
      return ativa && !guardarFalha ? `pendentes/${tipo}/${dados.id}.json` : null;
    },
    async concluir(c) { ordem.push(c ? 'concluir' : 'concluir-vazio'); },
    async drenar(tipo, fn, limite) { ordem.push('drenar:' + limite); return { pendentes: 0, entregues: 0 }; },
    async resumo() { return { total: 0, maisAntigo: null }; },
  };
}

function req(extra = {}) {
  return {
    method: 'POST',
    headers: { origin: 'https://www.sosdireito.com.br', 'content-type': 'application/json' },
    body: { ...CORPO },
    ...extra,
  };
}

function res() {
  return {
    codigo: 200, corpo: null, cab: {},
    status(c) { this.codigo = c; return this; },
    json(o) { this.corpo = o; return this; },
    setHeader(k, v) { this.cab[k] = v; },
    end() { return this; },
  };
}

const PROD = { JSYNQ_API_TOKEN: TOKEN, VERCEL_ENV: 'production' };

test('rota: só aceita POST', async () => {
  const h = criarHandler({ fila: filaEspia(), ambiente: PROD, entregar: async () => true });
  const r = res();
  await h(req({ method: 'GET' }), r);
  assert.equal(r.codigo, 405);
  assert.equal(r.cab.Allow, 'POST');
});

test('rota: origem — www e apex passam; outro site, sem cabeçalho e localhost em produção não', async () => {
  const h = criarHandler({ fila: filaEspia(), ambiente: PROD, entregar: async () => true });
  const tenta = async (headers) => { const r = res(); await h(req({ headers }), r); return r.codigo; };
  assert.equal(await tenta({ origin: 'https://www.sosdireito.com.br' }), 200);
  assert.equal(await tenta({ origin: 'https://sosdireito.com.br' }), 200);
  assert.equal(await tenta({ referer: 'https://www.sosdireito.com.br/contato/' }), 200);
  assert.equal(await tenta({ origin: 'https://outro-site.com' }), 403);
  assert.equal(await tenta({ origin: 'https://www.sosdireito.com.br.malicioso.com' }), 403);
  assert.equal(await tenta({ origin: 'null' }), 403);
  assert.equal(await tenta({}), 403);
  assert.equal(await tenta({ origin: 'http://localhost:4321' }), 403);
});

test('rota: fora de produção aceita localhost e preview', async () => {
  const h = criarHandler({ fila: filaEspia(), ambiente: { ...PROD, VERCEL_ENV: 'preview' }, entregar: async () => true });
  for (const origin of ['http://localhost:4321', 'https://sosdireito-abc-hubber-digital.vercel.app']) {
    const r = res();
    await h(req({ headers: { origin } }), r);
    assert.equal(r.codigo, 200, origin);
  }
});

test('rota: isca preenchida responde 200 e não guarda nem entrega nada', async () => {
  const fila = filaEspia();
  let entregas = 0;
  const h = criarHandler({ fila, ambiente: PROD, entregar: async () => { entregas++; return true; } });
  const r = res();
  await h(req({ body: com({ site_extra: 'http://spam.example' }) }), r);
  assert.equal(r.codigo, 200);
  assert.deepEqual(r.corpo, { ok: true });
  assert.equal(entregas, 0);
  assert.deepEqual(fila.ordem, []);
});

test('rota: lead inválido dá 422 com a lista de campos e não guarda nada', async () => {
  const fila = filaEspia();
  const h = criarHandler({ fila, ambiente: PROD, entregar: async () => true });
  const r = res();
  await h(req({ body: com({ email: '', telefone: '' }) }), r);
  assert.equal(r.codigo, 422);
  assert.deepEqual(r.corpo, { ok: false, error: 'validation', campos: ['contato'] });
  assert.deepEqual(fila.ordem, []);
});

test('rota: JSON quebrado dá 400; corpo grande dá 413', async () => {
  const h = criarHandler({ fila: filaEspia(), ambiente: PROD, entregar: async () => true });
  let r = res();
  await h(req({ body: '{quebrado' }), r);
  assert.equal(r.codigo, 400);
  r = res();
  await h(req({ body: JSON.stringify(com({ servico_procurado: 'x'.repeat(70 * 1024) })) }), r);
  assert.equal(r.codigo, 413);
  r = res();
  await h(req({ headers: { origin: 'https://www.sosdireito.com.br', 'content-length': String(70 * 1024) } }), r);
  assert.equal(r.codigo, 413);
});

test('rota: corpo em texto (sendBeacon) e em Buffer também são lidos', async () => {
  const h = criarHandler({ fila: filaEspia(), ambiente: PROD, entregar: async () => true });
  for (const body of [JSON.stringify(CORPO), Buffer.from(JSON.stringify(CORPO))]) {
    const r = res();
    await h(req({ body }), r);
    assert.equal(r.codigo, 200);
  }
});

test('rota: caminho feliz guarda ANTES de entregar, apaga depois, responde e drena 1 depois da resposta', async () => {
  const fila = filaEspia();
  const eventos = fila.ordem;
  const h = criarHandler({
    fila, ambiente: PROD,
    entregar: async (lead, token, { relatorio, limite }) => {
      eventos.push('entregar');
      assert.equal(token, TOKEN);
      assert.ok(limite > Date.now() + 40000 && limite <= Date.now() + 50000, 'limite da chamada');
      assert.match(lead.id, /^[0-9a-z]+-[0-9a-z]{6}$/);
      relatorio.whatsapp = 'enviado';
      return true;
    },
    emSegundoPlano: (p) => { eventos.push('segundo plano'); return p; },
  });
  const r = res();
  await h(req(), r);
  assert.equal(r.codigo, 200);
  assert.deepEqual(r.corpo, { ok: true, id: r.corpo.id, whatsapp: 'enviado' });
  assert.deepEqual(eventos, ['guardar', 'entregar', 'concluir', 'drenar:1', 'segundo plano']);
});

test('rota: sem relatório de WhatsApp o navegador ouve "nao_enviado", nunca uma promessa falsa', async () => {
  const h = criarHandler({ fila: filaEspia(), ambiente: PROD, entregar: async () => true, emSegundoPlano: (p) => p });
  const r = res();
  await h(req(), r);
  assert.equal(r.corpo.whatsapp, 'nao_enviado');
});

test('rota: JSYNQ recusa mas o lead está na fila → 200 pendente, sem apagar', async () => {
  const fila = filaEspia();
  const h = criarHandler({ fila, ambiente: PROD, entregar: async () => false });
  const c = calarConsole();
  try {
    const r = res();
    await h(req(), r);
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.pendente, true);
    assert.deepEqual(fila.ordem, ['guardar']);
  } finally { c.restaurar(); }
});

test('rota: entrega que lança também deixa o lead na fila', async () => {
  const fila = filaEspia();
  const h = criarHandler({ fila, ambiente: PROD, entregar: async () => { throw new Error('boom'); } });
  const c = calarConsole();
  try {
    const r = res();
    await h(req(), r);
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.pendente, true);
  } finally { c.restaurar(); }
});

test('rota: JSYNQ recusa e não há Blob → 502; sem token e sem Blob → 503', async () => {
  const c = calarConsole();
  try {
    let r = res();
    await criarHandler({ fila: filaEspia({ ativa: false }), ambiente: PROD, entregar: async () => false })(req(), r);
    assert.equal(r.codigo, 502);

    r = res();
    await criarHandler({ fila: filaEspia({ ativa: false }), ambiente: { VERCEL_ENV: 'production' }, entregar: async () => true })(req(), r);
    assert.equal(r.codigo, 503);
    assert.deepEqual(r.corpo, { ok: false, error: 'not_configured' });
  } finally { c.restaurar(); }
});

test('rota: sem o token mas com Blob, o lead fica guardado (200 pendente)', async () => {
  const fila = filaEspia();
  let entregas = 0;
  const h = criarHandler({ fila, ambiente: { VERCEL_ENV: 'production' }, entregar: async () => { entregas++; return true; } });
  const c = calarConsole();
  try {
    const r = res();
    await h(req(), r);
    assert.equal(r.codigo, 200);
    assert.equal(r.corpo.pendente, true);
    assert.equal(entregas, 0);
    assert.deepEqual(fila.ordem, ['guardar']);
  } finally { c.restaurar(); }
});

test('rota: o log de falha dupla leva só o caminho de volta, sem status imigratório nem texto livre', async () => {
  const h = criarHandler({ fila: filaEspia({ ativa: false }), ambiente: PROD, entregar: async () => false });
  const c = calarConsole();
  try {
    await h(req(), res());
    const log = c.linhas.join('\n');
    assert.match(log, /Maria Souza/);
    assert.doesNotMatch(log, /Turista|L-1A|10\/01\/2026|tok-secreto/);
  } finally { c.restaurar(); }
});

/* ---------- o cron ---------- */

test('drenar: sem CRON_SECRET recusa; segredo errado dá 401; sem Blob avisa; sem token recusa', async () => {
  const chamada = (auth) => ({ headers: auth ? { authorization: auth } : {} });
  const c = calarConsole();
  try {
    let r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: {} })(chamada('Bearer x'), r);
    assert.equal(r.codigo, 503);

    r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: { CRON_SECRET: 's3gredo', JSYNQ_API_TOKEN: TOKEN } })(chamada('Bearer errado'), r);
    assert.equal(r.codigo, 401);
    r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: { CRON_SECRET: 's3gredo', JSYNQ_API_TOKEN: TOKEN } })(chamada(), r);
    assert.equal(r.codigo, 401);

    r = res();
    await criarDrenar({ fila: filaEspia({ ativa: false }), ambiente: { CRON_SECRET: 's3gredo', JSYNQ_API_TOKEN: TOKEN } })(chamada('Bearer s3gredo'), r);
    assert.deepEqual(r.corpo, { ok: true, fila: 'inativa' });

    r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: { CRON_SECRET: 's3gredo' } })(chamada('Bearer s3gredo'), r);
    assert.equal(r.codigo, 503);
  } finally { c.restaurar(); }
});

test('drenar: com o segredo certo, esvazia a fila pelo mesmo caminho de entrega', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => true });
  await fila.guardar('lead', { ...validarLead(CORPO).lead, id: 'k1-a' });
  await fila.guardar('lead', { ...validarLead(com({ nome: 'João', email: '' })).lead, id: 'k2-b' });

  const enviados = [];
  const limites = new Set();
  const h = criarDrenar({
    fila,
    ambiente: { CRON_SECRET: 's3gredo', JSYNQ_API_TOKEN: TOKEN },
    entregar: async (lead, token, { limite }) => { enviados.push([lead.id, token]); limites.add(limite); return true; },
  });
  const c = calarConsole();
  try {
    const r = res();
    await h({ headers: { authorization: 'Bearer s3gredo' } }, r);
    assert.equal(r.codigo, 200);
    assert.deepEqual(enviados, [['k1-a', TOKEN], ['k2-b', TOKEN]]);
    // Um limite só para a chamada inteira: o segundo lead não ganha 50 s novos.
    assert.equal(limites.size, 1);
    assert.equal(r.corpo.filas.lead.restantes, 0);
    assert.equal(blob.itens.size, 0);
  } finally { c.restaurar(); }
});
