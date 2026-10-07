/**
 * O telefone do lead no formato que o WhatsApp do JSYNQ usa.
 *
 * O primeiro atendimento por WhatsApp não sai daqui: é a automação do
 * projeto no JSYNQ, "Primeiro atendimento WhatsApp (leads do site)" (coluna
 * Leads, ícone de raio no quadro). Ela dispara quando nasce um card com a
 * etiqueta "Site" e manda, do número COMERCIAL EUA, a mensagem de
 * boas-vindas e o link da calculadora para o telefone do contato do card. As
 * rotas de WhatsApp do JSYNQ não aceitam token de API (medido em 07/10/2026),
 * por isso o servidor do site não tem como mandar a mensagem ele mesmo.
 *
 * O site só garante duas coisas para a automação funcionar: o telefone vai
 * para o card com o código do país, e a etiqueta só vai quando esse código é
 * conhecido. Sem ele, mensagem nenhuma sai e o card pede o contato à mão.
 */

/* O número que fala com o lead. Só aparece no texto do formulário e no
   card; quem escolhe o número de envio é a automação do JSYNQ. */
export const NUMERO_SOS_LEGIVEL = '+1 (689) 280-2039';

/* DDDs que existem no Brasil. Número de 10 ou 11 dígitos sem "+" só vira
   +55 se começar por um deles; o resto fica para a equipe chamar à mão, em
   vez de a mensagem ir para o número de outra pessoa. */
const DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * O telefone do lead só com dígitos e com o código do país, ou null quando
 * não dá para ter certeza do país.
 *
 * O campo é livre: o formulário formata no padrão brasileiro e aceita
 * número internacional começando com "+". Regras, na ordem:
 *   "+..."                                  → como veio (8 a 15 dígitos)
 *   País "United States" e 10 dígitos       → +1
 *   55 + DDD + número (12 ou 13 dígitos)    → como veio
 *   DDD válido + 8 ou 9 dígitos             → +55
 *   qualquer outra coisa                    → null
 */
export function telefoneWhatsapp(lead) {
  const bruto = String(lead?.telefone || '').trim();
  const d = bruto.replace(/\D/g, '');
  if (!d) return null;
  if (bruto.startsWith('+')) return d.length >= 8 && d.length <= 15 ? d : null;
  if (lead?.pais === 'United States') {
    if (d.length === 10) return '1' + d;
    if (d.length === 11 && d.startsWith('1')) return d;
  }
  if ((d.length === 12 || d.length === 13) && d.startsWith('55') && DDD.has(+d.slice(2, 4))) return d;
  if ((d.length === 10 || d.length === 11) && DDD.has(+d.slice(0, 2))) return '55' + d;
  return null;
}
