/* Confere se um token do JSYNQ tem tudo o que o /api/lead usa, ANTES de ele
   ir para a Vercel. Não cria nem muda card: cada teste é uma chamada sobre um
   card que não existe, que o JSYNQ recusa por esse motivo (404) e não por
   falta de permissão (401/403).

   O WhatsApp não entra aqui: a mensagem automática sai de uma automação do
   projeto no JSYNQ (ver api/_whatsapp.js), e as rotas de WhatsApp do JSYNQ
   não aceitam token de API (medido em 07/10/2026).

   Rodar na raiz do projeto:  node _dev/conferir-token.mjs
   O token é digitado sem aparecer na tela (ou vem de JSYNQ_API_TOKEN).
*/
import readline from 'node:readline';
import { JSYNQ } from '../api/_lead.js';
import { API } from '../api/lead.js';

const CARD_QUE_NAO_EXISTE = '000000000000000000000000';

function perguntarEscondido(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(pergunta)) process.stdout.write(s); };
    rl.question(pergunta, (r) => { rl.close(); process.stdout.write('\n'); resolve(r.trim()); });
  });
}

const bruto = process.env.JSYNQ_API_TOKEN || await perguntarEscondido('Cole o token do JSYNQ (não aparece na tela) e tecle Enter: ');
if (!bruto) { console.log('Nenhum token informado.'); process.exit(1); }
const authorization = /^bearer\s/i.test(bruto) ? bruto : `Bearer ${bruto}`;

async function chamar(metodo, caminho, corpo) {
  try {
    const r = await fetch(API + caminho, {
      method: metodo,
      headers: { authorization, ...(corpo ? { 'content-type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    return { status: r.status, texto: await r.text().catch(() => '') };
  } catch (err) {
    return { status: 0, texto: err?.message || 'erro de rede' };
  }
}

const negado = (s) => s === 401 || s === 403;
const trecho = (t) => String(t).replace(/\s+/g, ' ').slice(0, 160);
let falhas = 0;
function anotar(nome, r, falta) {
  const ok = !negado(r.status) && r.status !== 0;
  if (!ok) falhas += 1;
  console.log(`${ok ? '✔' : '✖'} ${nome}\n    ${ok
    ? `passou (o JSYNQ respondeu ${r.status} para um card que não existe, como esperado)`
    : `recusado (${r.status}): ${falta}. ${trecho(r.texto)}`}`);
}

console.log('\nConferindo o token contra o JSYNQ (nada é criado nem mudado)...\n');
const cards = `/api/projects/${JSYNQ.projeto}/cards/${CARD_QUE_NAO_EXISTE}`;
anotar('Cards (leitura) no projeto "SOS Direito · Leads do site"', await chamar('GET', cards),
  'falta cards:read, ou o dono do token não é integrante do projeto');
anotar('Cards (escrita) no projeto', await chamar('PUT', cards, { desc: '[]' }), 'falta cards:write');

console.log(falhas
  ? `\n${falhas} problema(s) acima. Não troque o token na Vercel ainda.`
  : '\nTudo certo: este token cobre o que o site usa.');
