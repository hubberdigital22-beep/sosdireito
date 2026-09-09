/* ============================================================
   SOS DIREITO — Rastreamento de lead (contato)
   Equivalente do Bloco 5 do documento de instalação de rastreamento,
   adaptado do site antigo (formulário do CRM dentro de um <iframe>)
   para o formulário próprio deste site.

   O que muda em relação ao documento e por quê:

   - Não há iframe nem CRM. O alvo observado deixa de ser
     #success-message dentro do iframe e passa a ser o
     [data-form-sucesso] do próprio formulário.
   - O destino do lead é o WhatsApp. Não existe confirmação de
     servidor: o momento mais próximo de "o lead aconteceu" é o
     handoff, depois da validação, quando o WhatsApp é aberto com a
     mensagem montada. É esse momento que acende o estado de sucesso.
   - Os campos qualificadores deste formulário são outros
     (tempo_de_atividade, funcionarios_clt no lugar de pais,
     area_atuacao, graduacao...). O nome do evento, lead_value,
     currency e user_data seguem iguais aos do documento.

   O que NÃO muda: a conversão só dispara quando o estado de sucesso
   aparece — nunca no clique do botão. Disparar no clique conta
   tentativa que falhou como conversão e faz o Google Ads otimizar
   pra gente que não virou lead.
   ============================================================ */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  var form = document.querySelector('[data-form]');
  var sucesso = form && form.querySelector('[data-form-sucesso]');
  if (!form || !sucesso) return;

  function normalizaTelefone(raw) {
    var d = (raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.charAt(0) === '0') d = d.slice(1);
    if (d.length <= 11) d = '55' + d; // numero brasileiro sem DDI
    return '+' + d;
  }

  var snapshot = null;
  var jaEnviou = false;

  /* Fotografa os campos no submit — form.js reseta o form no sucesso */
  form.addEventListener('submit', function () {
    var dados = new FormData(form);
    var val = function (n) { return (dados.get(n) || '').toString().trim(); };
    snapshot = {
      email: val('email').toLowerCase(),
      telefone: normalizaTelefone(val('telefone')),
      tempo_de_atividade: val('tempo_de_atividade'),
      funcionarios_clt: val('funcionarios_clt')
    };
  }, true);

  var obs = new MutationObserver(function () {
    if (jaEnviou || !snapshot) return;
    if (sucesso.getAttribute('data-visivel') !== 'true') return;
    jaEnviou = true;

    window.dataLayer.push({
      event: 'sd_lead_submit',
      form_name: 'contato',
      lead_value: 200,
      currency: 'USD',
      tempo_de_atividade: snapshot.tempo_de_atividade,
      funcionarios_clt: snapshot.funcionarios_clt,
      user_data: { // conversoes aprimoradas
        email_address: snapshot.email,
        phone_number: snapshot.telefone
      },
      attribution: window.sdAttr ? window.sdAttr() : {}
    });
    snapshot = null;
    obs.disconnect();
  });
  obs.observe(sucesso, { attributes: true, attributeFilter: ['data-visivel'] });
})();
