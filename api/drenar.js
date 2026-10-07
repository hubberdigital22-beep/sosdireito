/**
 * Reenvia para o JSYNQ o que ficou pendente na fila.
 *
 * Existem dois caminhos de reenvio, de propósito. Cada lead novo já drena dois
 * itens, o que resolve sozinho enquanto houver movimento no site. Este aqui é o
 * que cobre o caso sem movimento: o cron chama uma vez por dia (vercel.json).
 *
 * Variáveis de ambiente:
 *   CRON_SECRET       obrigatório. A Vercel o manda como "Authorization:
 *                     Bearer ..." nas chamadas do cron. Sem ele a rota recusa,
 *                     para não ficar um endpoint aberto disparando trabalho a
 *                     pedido de qualquer um.
 *   JSYNQ_API_TOKEN   o mesmo de lead.js.
 */

import { timingSafeEqual } from 'node:crypto';
import { fila as filaPadrao } from './_fila.js';
import { entregarLead } from './lead.js';

function igual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function criarHandler({
  fila = filaPadrao,
  ambiente = process.env,
  entregar = entregarLead,
} = {}) {
  return async function handler(req, res) {
    const segredo = ambiente.CRON_SECRET;
    if (!segredo) {
      console.error('[drenar] CRON_SECRET ausente: rota desligada.');
      return res.status(503).json({ ok: false, error: 'not_configured' });
    }
    if (!igual(req.headers?.authorization || '', `Bearer ${segredo}`)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    if (!fila.ativa()) return res.status(200).json({ ok: true, fila: 'inativa' });

    const token = ambiente.JSYNQ_API_TOKEN;
    if (!token) {
      console.error('[drenar] JSYNQ_API_TOKEN ausente.');
      return res.status(503).json({ ok: false, error: 'not_configured' });
    }

    const r = await fila.drenar('lead', (d) => entregar(d, token), 50);
    const resto = await fila.resumo('lead');
    // Fila que não anda é sintoma de problema que ninguém viu ainda.
    if (resto.total) console.error('[drenar] ainda pendentes em lead:', resto.total, 'mais antigo:', resto.maisAntigo);

    const saida = { lead: { ...r, restantes: resto.total, maisAntigo: resto.maisAntigo } };
    console.log('[drenar]', JSON.stringify(saida));
    return res.status(200).json({ ok: true, filas: saida });
  };
}

export default criarHandler();
