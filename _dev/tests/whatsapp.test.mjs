/* Testes do que o site faz para o primeiro atendimento por WhatsApp, que sai
   de uma automação do JSYNQ disparada pela etiqueta "Site" do card: o
   telefone com código do país, a etiqueta só quando esse código é conhecido
   e o aviso no card quando a mensagem automática não pode sair.

   Rodar:  npm test
*/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { telefoneWhatsapp } from '../../api/_whatsapp.js';
import { validarLead, montarCard, contatoDeOutroCadastro, telefoneDoCrm, JSYNQ } from '../../api/_lead.js';

const linhasDe = (desc) => JSON.parse(desc).map((b) => b.content.map((c) => c.text).join(''));
const base = { nome: 'Maria Souza', email: 'maria@exemplo.com' };
const lead = (extra) => ({ ...validarLead({ ...base, ...extra }).lead, id: 'z-1' });

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

/* ---------- card ---------- */

const telefoneDoCard = (card) => card.customFields.find((c) => c.fieldId === 'phone')?.value;

test('card: telefone com país conhecido vai com "+" e o card ganha a etiqueta que dispara a mensagem', () => {
  const card = montarCard(lead({ telefone: '(11) 99999-9999' }));
  assert.equal(telefoneDoCard(card), '+5511999999999');
  assert.deepEqual(card.labels, [JSYNQ.etiquetaSite]);
  assert.doesNotMatch(card.desc, /WhatsApp automático/);

  const eua = montarCard(lead({ telefone: '(305) 555-0100', pais: 'United States' }));
  assert.equal(telefoneDoCard(eua), '+13055550100');
  assert.deepEqual(eua.labels, [JSYNQ.etiquetaSite]);
});

test('card: sem país conhecido não leva etiqueta (nada sai para número incompleto) e pede contato à mão', () => {
  const card = montarCard(lead({ telefone: '(305) 555-0100' }));
  assert.deepEqual(card.labels, []);
  assert.equal(telefoneDoCard(card), '(305) 555-0100');
  const desc = JSON.parse(card.desc);
  assert.equal(desc[0].props.backgroundColor, 'red');
  assert.equal(linhasDe(card.desc)[0],
    'WhatsApp automático não sai para este lead: não deu para saber o código do país do telefone "(305) 555-0100". Chamar a pessoa à mão.');

  const soEmail = montarCard(lead({}));
  assert.deepEqual(soEmail.labels, []);
  assert.match(linhasDe(soEmail.desc)[0], /a pessoa não deixou telefone/);
});

test('contato: o JSYNQ devolver o telefone no formato enviado (+55…) não vira "outro cadastro"', () => {
  const l = lead({ telefone: '(11) 99999-9999' });
  assert.equal(telefoneDoCrm(l), '+5511999999999');
  const gravado = (telefone) => ({ customFields: [
    { fieldId: 'contactName', value: l.nome }, { fieldId: 'email', value: l.email }, { fieldId: 'phone', value: telefone }] });
  assert.equal(contatoDeOutroCadastro(l, gravado('+5511999999999')), null);
  assert.equal(contatoDeOutroCadastro(l, gravado('(11) 99999-9999')), null);
  assert.ok(contatoDeOutroCadastro(l, gravado('+5521988887777')));
});
