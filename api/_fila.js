/**
 * Fila de entrega para o JSYNQ.
 *
 * O JSYNQ é onde a equipe recebe, mas é serviço de terceiro e sai do ar. Para
 * que nenhum lead se perca nessas horas, toda submissão é gravada aqui ANTES
 * de tentar o CRM. Só sai da fila quando o JSYNQ confirma, então o Blob guarda
 * dado pessoal só pela janela de falha, não como arquivo.
 *
 * Os arquivos têm nome, e-mail, telefone e dados de imigração, então o
 * armazenamento é privado: sem o token não há URL que abra.
 *
 * Enquanto não existir um Blob conectado ao projeto, tudo aqui vira no-op e as
 * funções seguem se comportando como antes. Publicar sem o armazenamento não
 * quebra nada, só não protege.
 *
 * Variável de ambiente: a Vercel cria BLOB_READ_WRITE_TOKEN (store antigo) ou
 * BLOB_STORE_ID (store novo, que autentica por OIDC) ao conectar um Blob store
 * ao projeto. O SDK aceita os dois, então a fila liga com qualquer um.
 *
 * Mesmo desenho de hubber-site/api/_fila.js. A diferença é `criarFila`, que
 * deixa trocar o armazenamento por um falso e assim testar a fila inteira sem
 * rede.
 */

import { put, list, del, get } from '@vercel/blob';

const blobReal = { put, list, del, get };

export function criarFila({
  blob = blobReal,
  ativa = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID),
} = {}) {
  const caminhoDe = (tipo, id) => `pendentes/${tipo}/${id}.json`;

  /* Grava a submissão e devolve o caminho, para quem chamou poder concluir
     depois. O id vem dos dados quando existir: é o mesmo que aparece no card,
     e o prefixo de tempo faz a listagem sair do mais antigo para o mais novo.
     Um erro aqui não pode derrubar o envio: é melhor seguir sem rede de
     proteção do que recusar o lead na cara da pessoa. */
  async function guardar(tipo, dados) {
    if (!ativa()) return null;
    const id = dados?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const caminho = caminhoDe(tipo, id);
    try {
      await blob.put(caminho, JSON.stringify({ tipo, id, criadoEm: new Date().toISOString(), dados }), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
      return caminho;
    } catch (err) {
      console.error('[fila] não consegui guardar:', err?.message);
      return null;
    }
  }

  /* Some com o item depois que o JSYNQ confirmou. Se esta remoção falhar, o
     item fica pendente e será entregue de novo mais tarde: gera um card
     repetido, que é bem menos grave que perder o lead. */
  async function concluir(caminho) {
    if (!ativa() || !caminho) return;
    try {
      await blob.del(caminho);
    } catch (err) {
      console.error('[fila] entregue mas não consegui remover da fila:', caminho, err?.message);
    }
  }

  /* Tenta entregar o que ficou para trás, do mais antigo para o mais novo.
     `entregar` recebe os dados originais e devolve true quando o JSYNQ aceitou.
     O limite existe porque isto roda junto de um envio real: drenar demais
     faria a função demorar. O cron chama com um limite maior, sem ninguém
     esperando. */
  async function drenar(tipo, entregar, limite = 3) {
    if (!ativa()) return { pendentes: 0, entregues: 0 };
    let blobs = [];
    try {
      ({ blobs } = await blob.list({ prefix: `pendentes/${tipo}/`, limit: limite }));
    } catch (err) {
      console.error('[fila] não consegui listar:', err?.message);
      return { pendentes: 0, entregues: 0 };
    }

    let entregues = 0;
    for (const b of blobs) {
      try {
        const r = await blob.get(b.pathname, { access: 'private' });
        if (r?.statusCode !== 200) continue;
        const item = JSON.parse(await new Response(r.stream).text());
        if (await entregar(item.dados)) {
          await concluir(b.pathname);
          entregues += 1;
        }
      } catch (err) {
        console.error('[fila] falha ao reenviar', b.pathname, err?.message);
      }
    }
    return { pendentes: blobs.length, entregues };
  }

  /* Quantos leads estão presos e há quanto tempo o mais velho espera. Serve
     para o cron avisar no log quando a fila para de andar, que é o sintoma de
     um problema que ninguém viu ainda. */
  async function resumo(tipo) {
    if (!ativa()) return { total: 0, maisAntigo: null };
    try {
      const { blobs } = await blob.list({ prefix: `pendentes/${tipo}/`, limit: 1000 });
      const datas = blobs.map((b) => new Date(b.uploadedAt).getTime()).filter(Number.isFinite);
      return {
        total: blobs.length,
        maisAntigo: datas.length ? new Date(Math.min(...datas)).toISOString() : null,
      };
    } catch (err) {
      console.error('[fila] não consegui contar os pendentes:', err?.message);
      return { total: 0, maisAntigo: null };
    }
  }

  return { ativa, guardar, concluir, drenar, resumo };
}

export const fila = criarFila();
