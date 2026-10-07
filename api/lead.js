/**
 * Recebe o lead do formulário de /contato/ e cria o card no projeto
 * "SOS Direito · Leads do site", no JSYNQ da Hubber.
 *
 * O formulário continua abrindo o WhatsApp sozinho (form.js); esta rota é a
 * cópia que vai para o CRM. Quem chama é assets/js/components/lead-crm.js, sem
 * esperar resposta: nada aqui pode atrasar nem estragar o WhatsApp.
 *
 * O card é criado pela API do JSYNQ, que só responde 2xx depois de gravar.
 * O token é a credencial e por isso mora só na variável de ambiente, nunca no
 * navegador nem no repositório. Projeto, coluna e responsável ficam em JSYNQ,
 * no _lead.js.
 *
 * Ordem das coisas: guardar no Blob privado ANTES de tentar o JSYNQ, apagar de
 * lá só depois de ele confirmar. Se o JSYNQ estiver fora, o lead já está a
 * salvo e é reenviado pelo próximo envio ou pelo cron diário (drenar.js). Sem
 * Blob conectado, a fila vira no-op e a rota segue funcionando sem a rede de
 * proteção.
 *
 * Variáveis de ambiente (painel da Vercel, nunca no código):
 *   JSYNQ_API_TOKEN         token de API do JSYNQ, com escrita em projetos. O
 *                           dono do token assina os cards e precisa ser
 *                           integrante do projeto, que é privado.
 *   BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN   criadas pela Vercel ao conectar o
 *                           Blob ao projeto (a primeira é o store novo, via OIDC).
 *
 * O que vai para o CRM é decidido em CAMPOS_NO_CRM, em _lead.js.
 */

import {
  validarLead, montarCard, montarDescricao, contatoGravado, contatoDeOutroCadastro, JSYNQ,
} from './_lead.js';
import { fila as filaPadrao } from './_fila.js';

const API = 'https://api.jsynq.com';
const MAX_BODY = 64 * 1024; // 13 campos de texto e a atribuição cabem de sobra
const HOSTS = new Set(['www.sosdireito.com.br', 'sosdireito.com.br']);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function novoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Barra JavaScript de OUTRO site postando aqui: o navegador sempre manda o
   Origin verdadeiro. Não impede quem fala HTTP direto, que forja o cabeçalho;
   para isso há a isca, a validação e o teto de corpo. Fora de produção
   aceita localhost e os endereços de preview. */
function origemPermitida(req, ambiente) {
  const bruto = req.headers?.origin || req.headers?.referer || '';
  let host = '';
  try { host = new URL(bruto).hostname; } catch { return false; }
  if (HOSTS.has(host)) return true;
  if (ambiente.VERCEL_ENV === 'production') return false;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
}

function lerCorpo(req) {
  if (Number(req.headers?.['content-length']) > MAX_BODY) return { erro: 413 };
  let b = req.body;
  if (Buffer.isBuffer(b)) b = b.toString('utf8');
  if (typeof b === 'string') {
    if (b.length > MAX_BODY) return { erro: 413 };
    try { b = JSON.parse(b); } catch { return { erro: 400 }; }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { erro: 400 };
  if (JSON.stringify(b).length > MAX_BODY) return { erro: 413 };
  return { corpo: b };
}

/* Se o CRM e o Blob estiverem fora ao mesmo tempo, o log guarda o mínimo para
   a equipe retomar o contato à mão. Só o caminho de volta: nada de status
   imigratório nem de texto livre em log. */
function resumo(lead) {
  return `| ${lead.id} · ${lead.nome} · ${lead.email || '?'} · ${lead.telefone || '?'}`;
}

const AVISO_ATE_MS = 10000;
const AVISO_TIMEOUT_MS = 4000;

/* Depois de criado o card: se o JSYNQ o ligou a um contato que já existia
   (junta por e-mail ou telefone), os campos de contato mostram o cadastro
   antigo, e a descrição ganha um aviso no topo para quem atende. Só aviso: o
   lead já está gravado, então nada aqui muda o resultado da entrega. */
async function avisarSeJuntou(lead, criado, authorization) {
  const id = criado?._id;
  if (!id) return;
  const rota = `${API}/api/projects/${JSYNQ.projeto}/cards/${id}`;
  try {
    let card = criado;
    const g = contatoGravado(card);
    if (!g.nome && !g.email && !g.telefone) {
      // A resposta da criação veio sem os campos de contato: lê o card.
      const r = await fetch(rota, { headers: { authorization }, signal: AbortSignal.timeout(AVISO_TIMEOUT_MS) });
      if (!r.ok) return;
      const d = await r.json().catch(() => null);
      card = d?.card || d?.data?.card || d;
    }
    const antigo = contatoDeOutroCadastro(lead, card);
    if (!antigo) return;
    const r = await fetch(rota, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ desc: montarDescricao(lead, { aviso: antigo }) }),
      signal: AbortSignal.timeout(AVISO_TIMEOUT_MS),
    });
    if (r.ok) console.log('[lead] card', criado.slug || id, 'ligado a contato que já existia: aviso posto');
    else console.error('[lead] card', criado.slug || id, 'ligado a contato que já existia; aviso falhou:', r.status);
  } catch (err) {
    console.error('[lead] card', criado.slug || id, 'aviso de contato existente falhou:', err?.message);
  }
}

/**
 * Uma entrega ao JSYNQ: cria o card. Usada pelo envio ao vivo e pelo reenvio
 * da fila, para os dois caminhos não divergirem com o tempo. Devolve true
 * quando o JSYNQ gravou (qualquer 2xx).
 *
 * Três tentativas para falha de rede, tempo esgotado e 5xx, que costumam ser
 * passageiros. 4xx não repete: o mesmo corpo vai dar a mesma resposta (token
 * inválido, dono do token fora do projeto), e o item fica na fila até alguém
 * corrigir. O token nunca vai para o log.
 */
export async function entregarLead(lead, token, {
  esperar = espera, tentativas = 3, agora = Date.now,
} = {}) {
  const inicio = agora();
  const url = `${API}/api/projects/${JSYNQ.projeto}/cards`;
  // Espaço ou quebra de linha colados junto do token no painel da Vercel
  // fariam o JSYNQ recusar a credencial e todo lead parar na fila.
  const limpo = String(token).trim();
  const authorization = /^bearer\s/i.test(limpo) ? limpo : `Bearer ${limpo}`;
  const corpo = JSON.stringify(montarCard(lead));
  for (let i = 0; i < tentativas; i++) {
    if (i) await esperar(i * 600);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization },
        body: corpo,
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.error('[lead] tentativa', i + 1, 'falhou:', err?.message);
      continue;
    }
    if (res.ok) {
      const dados = await res.json().catch(() => null);
      // 2xx que diz no corpo que não gravou não pode tirar o lead da fila.
      if (dados?.status === false || dados?.success === false) {
        console.error('[lead] JSYNQ respondeu', res.status, 'sem gravar:',
          String(dados.message || dados.error || '').slice(0, 120));
        return false;
      }
      // A API devolve o card sob "newCard"; os outros nomes ficam de reserva.
      const card = dados?.newCard || dados?.card || dados?.data?.card || dados;
      console.log('[lead] card criado:', card?.slug || card?._id || '?', '· envio', lead.id);
      // O aviso cabe no tempo da função só se a criação foi rápida. Sem ele o
      // lead está salvo do mesmo jeito; estourar o tempo deixaria o item na
      // fila e o reenvio criaria card repetido.
      if (agora() - inicio < AVISO_ATE_MS) await avisarSeJuntou(lead, card, authorization);
      return true;
    }
    console.error('[lead] tentativa', i + 1, 'devolveu', res.status,
      (await res.text().catch(() => '')).slice(0, 120));
    if (res.status < 500) return false;
  }
  return false;
}

export function criarHandler({
  fila = filaPadrao,
  ambiente = process.env,
  entregar = entregarLead,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    if (!origemPermitida(req, ambiente)) {
      return res.status(403).json({ ok: false, error: 'origin' });
    }

    const lido = lerCorpo(req);
    if (lido.erro) {
      return res.status(lido.erro).json({ ok: false, error: lido.erro === 413 ? 'too_large' : 'invalid_json' });
    }
    const body = lido.corpo;

    // Isca para robô: campo escondido preenchido. Responde como sucesso para o
    // robô não aprender nada com a diferença entre aceitar e recusar.
    if (typeof body.site_extra === 'string' && body.site_extra.trim()) {
      return res.status(200).json({ ok: true });
    }

    const { lead, problemas } = validarLead(body);
    if (problemas.length) {
      return res.status(422).json({ ok: false, error: 'validation', campos: problemas });
    }
    lead.id = novoId();

    // Guardar vem antes de entregar. Se o JSYNQ estiver fora, o lead já está a
    // salvo e entra na fila em vez de sumir.
    const naFila = await fila.guardar('lead', lead);

    const token = ambiente.JSYNQ_API_TOKEN;
    if (token) {
      try {
        if (await entregar(lead, token)) {
          await fila.concluir(naFila);
          // O CRM respondeu, então é boa hora de empurrar o que ficou para trás.
          if (fila.ativa()) {
            const r = await fila.drenar('lead', (d) => entregar(d, token), 2);
            if (r.entregues) console.log('[lead] fila: reenviados', r.entregues);
          }
          return res.status(200).json({ ok: true, id: lead.id });
        }
      } catch (err) {
        console.error('[lead] falha ao falar com o JSYNQ:', err?.message, resumo(lead));
      }
    } else {
      console.error('[lead] JSYNQ_API_TOKEN ausente: o lead não foi entregue.', resumo(lead));
    }

    // Aqui o CRM não aceitou. Com o lead na fila ele foi recebido de fato e
    // será entregue depois. Como o navegador não espera esta resposta, o
    // status serve só ao log e ao teste.
    if (naFila) {
      console.error('[lead] na fila para reenvio:', naFila);
      return res.status(200).json({ ok: true, pendente: true, id: lead.id });
    }
    console.error('[lead] NÃO foi possível entregar nem guardar:', resumo(lead));
    return res.status(token ? 502 : 503).json({ ok: false, error: token ? 'upstream' : 'not_configured' });
  };
}

export default criarHandler();
