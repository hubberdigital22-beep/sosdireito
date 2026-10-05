/**
 * Recebe o lead do formulário de /contato/ e o entrega ao JSYNQ da SOS.
 *
 * O formulário continua abrindo o WhatsApp sozinho (form.js); esta rota é a
 * cópia que vai para o CRM. Quem chama é assets/js/components/lead-crm.js, sem
 * esperar resposta: nada aqui pode atrasar nem estragar o WhatsApp.
 *
 * O destino é um webhook do JSYNQ. A URL dele é a única credencial e por isso
 * mora só na variável de ambiente, nunca no navegador nem no repositório.
 *
 * Ordem das coisas: guardar no Blob privado ANTES de tentar o JSYNQ, apagar de
 * lá só depois de ele confirmar. Se o JSYNQ estiver fora, o lead já está a
 * salvo e é reenviado pelo próximo envio ou pelo cron diário (drenar.js). Sem
 * Blob conectado, a fila vira no-op e a rota segue funcionando sem a rede de
 * proteção.
 *
 * Variáveis de ambiente (painel da Vercel, nunca no código):
 *   JSYNQ_WEBHOOK_URL       URL do webhook do JSYNQ. Sem valor padrão.
 *   BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN   criadas pela Vercel ao conectar o
 *                           Blob ao projeto (a primeira é o store novo, via OIDC).
 *
 * O que vai para o CRM é decidido em CAMPOS_NO_CRM, em _lead.js.
 */

import { validarLead, montarPayload } from './_lead.js';
import { fila as filaPadrao } from './_fila.js';

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

/**
 * Uma entrega ao webhook. Usada pelo envio ao vivo e pelo reenvio da fila, para
 * os dois caminhos não divergirem com o tempo. Devolve true quando o JSYNQ
 * aceitou (qualquer 2xx).
 *
 * Três tentativas para falha de rede, tempo esgotado e 5xx, que costumam ser
 * passageiros. 4xx não repete: o mesmo corpo vai dar a mesma resposta, e o
 * item fica na fila para alguém olhar. A URL nunca vai para o log.
 */
export async function entregarLead(lead, url, { esperar = espera, tentativas = 3 } = {}) {
  const corpo = JSON.stringify(montarPayload(lead));
  for (let i = 0; i < tentativas; i++) {
    if (i) await esperar(i * 600);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: corpo,
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.error('[lead] tentativa', i + 1, 'falhou:', err?.message);
      continue;
    }
    if (res.ok) return true;
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

    const url = ambiente.JSYNQ_WEBHOOK_URL;
    if (url) {
      try {
        if (await entregar(lead, url)) {
          await fila.concluir(naFila);
          // O CRM respondeu, então é boa hora de empurrar o que ficou para trás.
          if (fila.ativa()) {
            const r = await fila.drenar('lead', (d) => entregar(d, url), 2);
            if (r.entregues) console.log('[lead] fila: reenviados', r.entregues);
          }
          return res.status(200).json({ ok: true, id: lead.id });
        }
      } catch (err) {
        console.error('[lead] falha ao falar com o JSYNQ:', err?.message, resumo(lead));
      }
    } else {
      console.error('[lead] JSYNQ_WEBHOOK_URL ausente: o lead não foi entregue.', resumo(lead));
    }

    // Aqui o CRM não aceitou. Com o lead na fila ele foi recebido de fato e
    // será entregue depois. Como o navegador não espera esta resposta, o
    // status serve só ao log e ao teste.
    if (naFila) {
      console.error('[lead] na fila para reenvio:', naFila);
      return res.status(200).json({ ok: true, pendente: true, id: lead.id });
    }
    console.error('[lead] NÃO foi possível entregar nem guardar:', resumo(lead));
    return res.status(url ? 502 : 503).json({ ok: false, error: url ? 'upstream' : 'not_configured' });
  };
}

export default criarHandler();
