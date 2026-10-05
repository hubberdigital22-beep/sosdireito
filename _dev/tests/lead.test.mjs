/* Testes do caminho do lead: validação, texto do card, entrega ao webhook,
   fila no Blob e a rota. Tudo sem rede: o Blob é um Map e o fetch é trocado.

   Rodar:  npm test   (ou  node --test "_dev/tests/*.test.mjs")
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  validarLead, montarPayload, montarDescricao,
  ROTULOS, ORDEM, ORIGENS, STATUS, CAMPOS_NO_CRM, EMPRESA,
} from '../../api/_lead.js';
import { criarFila } from '../../api/_fila.js';
import { criarHandler, entregarLead } from '../../api/lead.js';
import { criarHandler as criarDrenar } from '../../api/drenar.js';

const URL_WEBHOOK = 'https://exemplo.invalid/webhook-secreto-123';

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

test('nome, e-mail e telefone são obrigatórios: o JSYNQ não cria card sem o e-mail', () => {
  assert.deepEqual(validarLead(com({ telefone: '' })).problemas, ['telefone']);
  assert.deepEqual(validarLead(com({ email: '' })).problemas, ['email']);
  assert.deepEqual(validarLead(com({ email: '', telefone: '' })).problemas, ['email', 'telefone']);
});

test('nome é obrigatório', () => {
  assert.deepEqual(validarLead(com({ nome: '   ' })).problemas, ['nome']);
  assert.deepEqual(validarLead(com({ nome: undefined })).problemas, ['nome']);
});

test('e-mail malformado e telefone curto ou longo são apontados', () => {
  assert.deepEqual(validarLead(com({ email: 'maria@' })).problemas, ['email']);
  assert.deepEqual(validarLead(com({ telefone: '(11) 9999' })).problemas, ['telefone']);
  assert.deepEqual(validarLead(com({ telefone: '1'.repeat(16) })).problemas, ['telefone']);
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

test('corpo que não é objeto vira "nome", "email" e "telefone", sem exceção', () => {
  for (const ruim of [null, undefined, 'texto', 42, []]) {
    assert.deepEqual(validarLead(ruim).problemas, ['nome', 'email', 'telefone']);
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

test('rótulos e ordem são os do form.js (a mensagem do WhatsApp e o card dizem o mesmo)', () => {
  const src = readFileSync(new URL('../../assets/js/components/form.js', import.meta.url), 'utf8');

  const bloco = /var ROTULOS = \{([\s\S]*?)\};/.exec(src)[1];
  const doForm = {};
  for (const [, k, v] of bloco.matchAll(/(\w+):\s*'([^']*)'/g)) doForm[k] = v;
  assert.deepEqual(ROTULOS, doForm);

  const ordem = /var ORDEM = \[([\s\S]*?)\];/.exec(src)[1];
  assert.deepEqual(ORDEM, [...ordem.matchAll(/'(\w+)'/g)].map((m) => m[1]));
});

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

test('descrição do card: rótulos na ordem, texto livre por último, origem, gclid e ID', () => {
  const { lead } = validarLead(CORPO);
  lead.id = 'm3k2x9a1-f4k2zq';
  const d = montarDescricao(lead);
  assert.equal(d, [
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
    '',
    'Serviço procurado:',
    'Quero um L-1A.\nTenho empresa no Brasil.',
    '',
    'Origem: google / cpc / l1a',
    '[ref: abc123def456]',
    'ID do envio: m3k2x9a1-f4k2zq',
  ].join('\n'));
  assert.doesNotMatch(d, /undefined|\[object/);
});

test('descrição sem atribuição nem campos opcionais não deixa linhas vazias sobrando nem "undefined"', () => {
  const { lead } = validarLead({ nome: 'Ana', email: 'ana@exemplo.com' });
  lead.id = 'x-1';
  assert.equal(montarDescricao(lead), 'Nome: Ana\nE-mail: ana@exemplo.com\n\nID do envio: x-1');
});

test('payload do webhook: chaves certas, e-mail e telefone só quando existem', () => {
  const cheio = validarLead(CORPO).lead;
  assert.deepEqual(Object.keys(montarPayload(cheio)), ['name', 'email', 'phone', 'company', 'message']);
  assert.equal(montarPayload(cheio).company, EMPRESA);

  const soTel = validarLead(com({ email: '' })).lead;
  const p1 = montarPayload(soTel);
  assert.deepEqual(Object.keys(p1), ['name', 'phone', 'company', 'message']);
  assert.ok(!('email' in p1));

  const soEmail = validarLead(com({ telefone: '' })).lead;
  const p2 = montarPayload(soEmail);
  assert.deepEqual(Object.keys(p2), ['name', 'email', 'company', 'message']);
  assert.ok(!('phone' in p2));
});

/* ---------- entrega ao webhook ---------- */

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

const semEspera = { esperar: async () => {} };

test('entrega: 200 de primeira, um POST JSON com o payload', async () => {
  const f = fetchFalso([{ status: 200 }]);
  try {
    const lead = { ...validarLead(CORPO).lead, id: 'a-1' };
    assert.equal(await entregarLead(lead, URL_WEBHOOK, semEspera), true);
    assert.equal(f.chamadas.length, 1);
    assert.equal(f.chamadas[0].url, URL_WEBHOOK);
    assert.equal(f.chamadas[0].opcoes.method, 'POST');
    assert.equal(f.chamadas[0].opcoes.headers['content-type'], 'application/json');
    const enviado = JSON.parse(f.chamadas[0].opcoes.body);
    assert.equal(enviado.name, 'Maria Souza');
    assert.match(enviado.message, /ID do envio: a-1/);
  } finally { f.restaurar(); }
});

test('entrega: 500, 500, 200 → true na terceira tentativa', async () => {
  const f = fetchFalso([{ status: 500 }, { status: 502 }, { status: 201 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-2' }, URL_WEBHOOK, semEspera), true);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: 500 três vezes → false', async () => {
  const f = fetchFalso([{ status: 500 }, { status: 500 }, { status: 500 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-3' }, URL_WEBHOOK, semEspera), false);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: erro de rede é tentado de novo', async () => {
  const f = fetchFalso([new Error('fetch failed'), new Error('fetch failed'), { status: 200 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-4' }, URL_WEBHOOK, semEspera), true);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: 4xx não repete (o mesmo corpo daria a mesma resposta)', async () => {
  const f = fetchFalso([{ status: 400, corpo: 'payload inválido' }, { status: 200 }]);
  const c = calarConsole();
  try {
    assert.equal(await entregarLead({ ...validarLead(CORPO).lead, id: 'a-5' }, URL_WEBHOOK, semEspera), false);
    assert.equal(f.chamadas.length, 1);
  } finally { f.restaurar(); c.restaurar(); }
});

test('entrega: a URL do webhook nunca aparece no log', async () => {
  const f = fetchFalso([{ status: 500 }, new Error('boom'), { status: 404 }]);
  const c = calarConsole();
  try {
    await entregarLead({ ...validarLead(CORPO).lead, id: 'a-6' }, URL_WEBHOOK, semEspera);
    assert.ok(c.linhas.length > 0);
    for (const l of c.linhas) assert.ok(!l.includes('webhook-secreto'), l);
  } finally { f.restaurar(); c.restaurar(); }
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

const PROD = { JSYNQ_WEBHOOK_URL: URL_WEBHOOK, VERCEL_ENV: 'production' };

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
  assert.deepEqual(r.corpo, { ok: false, error: 'validation', campos: ['email', 'telefone'] });
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

test('rota: caminho feliz guarda ANTES de entregar, apaga depois e drena 2', async () => {
  const fila = filaEspia();
  const eventos = fila.ordem;
  const h = criarHandler({
    fila, ambiente: PROD,
    entregar: async (lead, url) => {
      eventos.push('entregar');
      assert.equal(url, URL_WEBHOOK);
      assert.match(lead.id, /^[0-9a-z]+-[0-9a-z]{6}$/);
      return true;
    },
  });
  const r = res();
  await h(req(), r);
  assert.equal(r.codigo, 200);
  assert.equal(r.corpo.ok, true);
  assert.deepEqual(eventos, ['guardar', 'entregar', 'concluir', 'drenar:2']);
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

test('rota: JSYNQ recusa e não há Blob → 502; sem URL e sem Blob → 503', async () => {
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

test('rota: sem a URL do webhook mas com Blob, o lead fica guardado (200 pendente)', async () => {
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
    assert.doesNotMatch(log, /Turista|L-1A|10\/01\/2026|webhook-secreto/);
  } finally { c.restaurar(); }
});

/* ---------- o cron ---------- */

test('drenar: sem CRON_SECRET recusa; segredo errado dá 401; sem Blob avisa', async () => {
  const chamada = (auth) => ({ headers: auth ? { authorization: auth } : {} });
  const c = calarConsole();
  try {
    let r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: {} })(chamada('Bearer x'), r);
    assert.equal(r.codigo, 503);

    r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: { CRON_SECRET: 's3gredo', JSYNQ_WEBHOOK_URL: URL_WEBHOOK } })(chamada('Bearer errado'), r);
    assert.equal(r.codigo, 401);
    r = res();
    await criarDrenar({ fila: filaEspia(), ambiente: { CRON_SECRET: 's3gredo', JSYNQ_WEBHOOK_URL: URL_WEBHOOK } })(chamada(), r);
    assert.equal(r.codigo, 401);

    r = res();
    await criarDrenar({ fila: filaEspia({ ativa: false }), ambiente: { CRON_SECRET: 's3gredo', JSYNQ_WEBHOOK_URL: URL_WEBHOOK } })(chamada('Bearer s3gredo'), r);
    assert.deepEqual(r.corpo, { ok: true, fila: 'inativa' });
  } finally { c.restaurar(); }
});

test('drenar: com o segredo certo, esvazia a fila pelo mesmo caminho de entrega', async () => {
  const blob = blobFalso();
  const fila = criarFila({ blob, ativa: () => true });
  await fila.guardar('lead', { ...validarLead(CORPO).lead, id: 'k1-a' });
  await fila.guardar('lead', { ...validarLead(com({ nome: 'João', email: '' })).lead, id: 'k2-b' });

  const enviados = [];
  const h = criarDrenar({
    fila,
    ambiente: { CRON_SECRET: 's3gredo', JSYNQ_WEBHOOK_URL: URL_WEBHOOK },
    entregar: async (lead, url) => { enviados.push([lead.id, url]); return true; },
  });
  const c = calarConsole();
  try {
    const r = res();
    await h({ headers: { authorization: 'Bearer s3gredo' } }, r);
    assert.equal(r.codigo, 200);
    assert.deepEqual(enviados, [['k1-a', URL_WEBHOOK], ['k2-b', URL_WEBHOOK]]);
    assert.equal(r.corpo.filas.lead.restantes, 0);
    assert.equal(blob.itens.size, 0);
  } finally { c.restaurar(); }
});
