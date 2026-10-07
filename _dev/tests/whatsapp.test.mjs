/* Testes do primeiro atendimento por WhatsApp: telefone com código do país,
   saudação pelo horário, a sequência de envios e o que o card mostra. Sem
   rede: o fetch é trocado.

   Rodar:  npm test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  telefoneWhatsapp, saudacao, mensagemInicial, sequencia, numeroLegivel,
  NUMERO_SOS, CALCULADORA, PDFS,
} from '../../api/_whatsapp.js';
import { montarDescricao } from '../../api/_lead.js';
import { enviarWhatsapp } from '../../api/lead.js';

const AUTH = 'Bearer tok-secreto-123';
const linhasDe = (desc) => JSON.parse(desc).map((b) => b.content.map((c) => c.text).join(''));

/* ---------- telefone ---------- */

test('telefone: número brasileiro digitado no padrão do formulário ganha +55', () => {
  assert.equal(telefoneWhatsapp({ telefone: '(11) 99999-9999' }), '5511999999999');
  assert.equal(telefoneWhatsapp({ telefone: '(12) 3456-7890' }), '551234567890');
  assert.equal(telefoneWhatsapp({ telefone: '5511999999999' }), '5511999999999');
});

test('telefone: com "+" vale o código que a pessoa digitou', () => {
  assert.equal(telefoneWhatsapp({ telefone: '+1 305 555 0100' }), '13055550100');
  assert.equal(telefoneWhatsapp({ telefone: '+351 912 345 678' }), '351912345678');
  assert.equal(telefoneWhatsapp({ telefone: '+55 (11) 99999-9999' }), '5511999999999');
});

test('telefone: dos EUA sem "+" só vira +1 quando o país marcado é os EUA', () => {
  assert.equal(telefoneWhatsapp({ telefone: '(305) 555-0100', pais: 'United States' }), '13055550100');
  assert.equal(telefoneWhatsapp({ telefone: '13055550100', pais: 'United States' }), '13055550100');
  // Sem país, 305 não é DDD brasileiro: ninguém recebe mensagem por chute.
  assert.equal(telefoneWhatsapp({ telefone: '(305) 555-0100' }), null);
});

test('telefone: DDD que não existe, tamanho estranho ou vazio → null (a equipe chama à mão)', () => {
  for (const t of ['(10) 99999-9999', '(20) 9999-9999', '999', '', '+12', undefined]) {
    assert.equal(telefoneWhatsapp({ telefone: t }), null, String(t));
  }
});

test('número legível no card', () => {
  assert.equal(numeroLegivel('5511999999999'), '+55 11 99999-9999');
  assert.equal(numeroLegivel('551234567890'), '+55 12 3456-7890');
  assert.equal(numeroLegivel('13055550100'), '+1 (305) 555-0100');
  assert.equal(numeroLegivel('351912345678'), '+351912345678');
  assert.equal(numeroLegivel(NUMERO_SOS), '+1 (689) 280-2039');
});

/* ---------- textos ---------- */

test('saudação segue o horário de quem recebe: Brasília para +55, Nova York para +1', () => {
  // 14:00 UTC = 11h em Brasília e 10h em Nova York (horário de verão dos EUA).
  const manha = new Date(Date.UTC(2026, 9, 7, 14, 0));
  assert.equal(saudacao('5511999999999', manha), 'Super bom dia !!!');
  // 17:00 UTC = 14h em Brasília, 13h em Nova York.
  const tarde = new Date(Date.UTC(2026, 9, 7, 17, 0));
  assert.equal(saudacao('5511999999999', tarde), 'Super boa tarde !!!');
  assert.equal(saudacao('13055550100', tarde), 'Super boa tarde !!!');
  // 23:30 UTC = 20h30 em Brasília.
  assert.equal(saudacao('5511999999999', new Date(Date.UTC(2026, 9, 7, 23, 30))), 'Super boa noite !!!');
  // 15:30 UTC = 12h30 em Brasília (tarde), 11h30 em Nova York (manhã).
  const meio = new Date(Date.UTC(2026, 9, 7, 15, 30));
  assert.equal(saudacao('5511999999999', meio), 'Super boa tarde !!!');
  assert.equal(saudacao('13055550100', meio), 'Super bom dia !!!');
});

test('mensagem inicial: o texto da Camila, com a saudação do horário na primeira linha', () => {
  const m = mensagemInicial('5511999999999', new Date(Date.UTC(2026, 9, 7, 17, 0))).split('\n');
  assert.deepEqual(m, [
    'Super boa tarde !!!',
    'Muito obrigada por seu contato.',
    'Somos especialistas em aquisição de residência permanente por transferência executiva.',
    'Abaixo lhe encaminho todos os detalhes de como podemos lhe auxiliar na trajetória do L1-A.',
    'Ao revisar o material, caso haja interesse de se relocar para os EUA nos próximos 6 meses por gentileza nos avise para fazermos o agendamento no qual vamos esclarecer todas as suas dúvidas.',
  ]);
});

test('sequência: mensagem, calculadora e os dois PDFs, nessa ordem', () => {
  const s = sequencia('5511999999999');
  assert.deepEqual(s.map((x) => x.tipo), ['texto', 'texto', 'pdf', 'pdf']);
  assert.equal(s[1].texto, CALCULADORA);
  assert.deepEqual(s.slice(2).map((x) => x.arquivo), PDFS.map((p) => p.arquivo));
});

test('os PDFs existem, são PDF de verdade e entram no pacote da função', () => {
  for (const p of PDFS) {
    const bytes = readFileSync(new URL(`../../api/_materiais/${p.arquivo}`, import.meta.url));
    assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', p.arquivo);
  }
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercel.functions['api/*.js'].includeFiles, 'api/_materiais/**');
});

/* ---------- envio ---------- */

function fetchFalso(respostas) {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opcoes = {}) => {
    chamadas.push({ url, opcoes });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    if (!r) throw new Error('chamada a mais: ' + url);
    return new Response(r.corpo ?? '', { status: r.status });
  };
  return { chamadas, restaurar: () => { globalThis.fetch = original; } };
}

function calarConsole() {
  const originais = { error: console.error, log: console.log };
  console.error = () => {};
  console.log = () => {};
  return { restaurar: () => { console.error = originais.error; console.log = originais.log; } };
}

const SESSOES = JSON.stringify({ sessions: [
  { _id: 'outra', label: 'OUTRO CLIENTE', phone: '5511988887777' },
  { _id: 'sos', label: 'COMERCIAL EUA', me: { id: `${NUMERO_SOS}:7@s.whatsapp.net` } },
] });
const LEAD = { nome: 'Maria', telefone: '(11) 99999-9999' };
const opcoes = { esperar: async () => {}, agora: () => Date.UTC(2026, 9, 7, 17, 0) };

test('envio: acha a sessão pelo número da SOS e manda os quatro itens ligados ao card', async () => {
  const f = fetchFalso([
    { status: 200, corpo: SESSOES },
    { status: 200 }, { status: 200 }, { status: 200 }, { status: 200 },
  ]);
  try {
    const r = await enviarWhatsapp(LEAD, 'card1', AUTH, opcoes);
    assert.equal(r.ok, true);
    assert.equal(r.para, '+55 11 99999-9999');
    assert.equal(r.de, '+1 (689) 280-2039');
    assert.equal(r.enviados.length, 4);
    assert.match(f.chamadas[0].url, /\/api\/whatsapp-lite\/sessions$/);
    const envios = f.chamadas.slice(1);
    for (const e of envios) {
      assert.match(e.url, /\/api\/whatsapp-lite\/sessions\/sos\/send-to-phone$/);
      assert.equal(e.opcoes.headers.authorization, AUTH);
    }
    const corpos = envios.map((e) => JSON.parse(e.opcoes.body));
    for (const c of corpos) {
      assert.equal(c.phone, '5511999999999');
      assert.equal(c.linkedEntityType, 'card');
      assert.equal(c.linkedEntityId, 'card1');
    }
    assert.match(corpos[0].text, /^Super boa tarde !!!\nMuito obrigada/);
    assert.equal(corpos[1].text, CALCULADORA);
    assert.equal(corpos[2].mimeType, 'application/pdf');
    assert.equal(corpos[2].fileName, PDFS[0].nome);
    assert.equal(Buffer.from(corpos[2].mediaBase64, 'base64').subarray(0, 5).toString('latin1'), '%PDF-');
    assert.equal(corpos[3].fileName, PDFS[1].nome);
  } finally { f.restaurar(); }
});

test('envio: a sessão é achada pelo número em qualquer campo, mesmo com outro nome', async () => {
  const f = fetchFalso([
    { status: 200, corpo: JSON.stringify([{ id: 'velha', name: 'Qualquer nome', jid: `${NUMERO_SOS}@s.whatsapp.net` }]) },
    { status: 200 }, { status: 200 }, { status: 200 }, { status: 200 },
  ]);
  try {
    const r = await enviarWhatsapp(LEAD, 'c', AUTH, opcoes);
    assert.equal(r.ok, true);
    assert.match(f.chamadas[1].url, /sessions\/velha\/send-to-phone/);
  } finally { f.restaurar(); }
});

test('envio: telefone sem país reconhecível não chama a API', async () => {
  const f = fetchFalso([]);
  try {
    const r = await enviarWhatsapp({ telefone: '(305) 555-0100' }, 'c', AUTH, opcoes);
    assert.equal(r.ok, false);
    assert.match(r.motivo, /código do país/);
    assert.equal(f.chamadas.length, 0);
  } finally { f.restaurar(); }
});

test('envio: número da SOS desconectado ou sem permissão para listar → não envia e diz por quê', async () => {
  for (const [resposta, motivo] of [
    [{ status: 200, corpo: JSON.stringify({ sessions: [{ _id: 'outra', phone: '5511988887777' }] }) }, /não está ligado ao JSYNQ/],
    [{ status: 401, corpo: 'Unauthorized' }, /respondeu 401/],
  ]) {
    const f = fetchFalso([resposta]);
    try {
      const r = await enviarWhatsapp(LEAD, 'c', AUTH, opcoes);
      assert.equal(r.ok, false);
      assert.match(r.motivo, motivo);
      assert.equal(f.chamadas.length, 1);
    } finally { f.restaurar(); }
  }
});

test('envio: para no primeiro item que falha e conta o que já saiu', async () => {
  const f = fetchFalso([{ status: 200, corpo: SESSOES }, { status: 200 }, { status: 500, corpo: 'erro' }]);
  const c = calarConsole();
  try {
    const r = await enviarWhatsapp(LEAD, 'c', AUTH, opcoes);
    assert.equal(r.ok, false);
    assert.deepEqual(r.enviados, ['mensagem de boas-vindas']);
    assert.match(r.motivo, /link da calculadora não saiu \(o JSYNQ respondeu 500\)/);
    assert.equal(f.chamadas.length, 3);
  } finally { f.restaurar(); c.restaurar(); }
});

test('envio: não começa um item que pode passar do prazo', async () => {
  const f = fetchFalso([{ status: 200, corpo: SESSOES }, { status: 200 }]);
  // O primeiro envio cabe (0 + 15 s ≤ 20 s); no segundo o relógio já passou.
  const tempos = [0, 0, 99999];
  try {
    const r = await enviarWhatsapp(LEAD, 'c', AUTH, { ...opcoes, agora: () => tempos.shift() ?? 99999, prazo: 20000 });
    assert.equal(r.ok, false);
    assert.match(r.motivo, /acabou o tempo/);
    assert.deepEqual(r.enviados, ['mensagem de boas-vindas']);
  } finally { f.restaurar(); }
});

/* ---------- o que o card mostra ---------- */

test('card: bloco verde quando o WhatsApp saiu, vermelho com o motivo quando não', () => {
  const lead = { nome: 'Ana', email: 'ana@exemplo.com', id: 'z-1' };
  const ok = JSON.parse(montarDescricao(lead, { whatsapp: {
    ok: true, para: '+55 11 99999-9999', de: '+1 (689) 280-2039',
    enviados: ['mensagem de boas-vindas', 'link da calculadora'] } }));
  assert.equal(ok[0].props.backgroundColor, 'green');
  assert.equal(linhasDe(JSON.stringify(ok))[0],
    'WhatsApp automático enviado para +55 11 99999-9999 pelo número +1 (689) 280-2039: mensagem de boas-vindas, link da calculadora.');

  const nao = JSON.parse(montarDescricao(lead, { whatsapp: {
    ok: false, enviados: ['mensagem de boas-vindas'], motivo: 'o link não saiu' } }));
  assert.equal(nao[0].props.backgroundColor, 'red');
  assert.equal(linhasDe(JSON.stringify(nao))[0],
    'WhatsApp automático NÃO enviado: o link não saiu. Chegou a sair: mensagem de boas-vindas. Chamar a pessoa pelo WhatsApp à mão.');
  assert.equal(linhasDe(JSON.stringify(nao))[1], 'Nome: Ana');
});
