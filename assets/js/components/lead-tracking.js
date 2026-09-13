/* ============================================================
   SOS DIREITO — Rastreamento de lead (contato)
   Equivalente do Bloco 5 do documento de instalação de rastreamento,
   adaptado do site antigo (formulário do CRM dentro de um <iframe>)
   para o formulário próprio deste site.

   ⚠️  REGRA QUE NÃO PODE SER QUEBRADA
   O documento é explícito: status imigratório, data de entrada nos
   EUA e validade da I-94 são categoria sensível na política do Google
   e NÃO podem ser enviados. Esses campos existem no formulário e vão
   para o WhatsApp — que é o lead chegando na equipe — mas nunca entram
   no dataLayer. O texto livre também fica de fora: a pessoa pode
   descrever a própria situação imigratória ali dentro.

   O que sobe é só a lista abaixo, que é exatamente a do documento:
   pais, origem_declarada, area_atuacao, graduacao, horario_contato.

   O que muda em relação ao documento:
   - Não há iframe nem CRM. O alvo observado é o [data-form-sucesso]
     do próprio formulário.
   - O destino do lead é o WhatsApp. Não existe confirmação de
     servidor: o momento mais próximo de "o lead aconteceu" é o
     handoff, depois da validação, quando o WhatsApp é aberto com a
     mensagem montada. É esse momento que acende o estado de sucesso.
   - E-mail e telefone são opcionais neste formulário (como no CRM),
     então user_data pode ir vazio — as chaves sem valor são omitidas
     em vez de subirem como string vazia.

   O que NÃO muda: a conversão só dispara quando o estado de sucesso
   aparece — nunca no clique do botão. Disparar no clique conta
   tentativa que falhou como conversão e faz o Google Ads otimizar
   pra gente que não virou lead.

   Meta Pixel: ele NÃO está dentro do GTM (é carregado direto no
   head.html), então nenhum gatilho do container chega à Meta. O Lead
   sai daqui, no mesmo instante e com a mesma trava do sd_lead_submit,
   para Google e Meta contarem exatamente os mesmos leads. Para a Meta
   vai só o valor do lead: área, graduação e horário são texto livre,
   onde a pessoa pode ter escrito qualquer coisa. Se o Pixel um dia for
   para dentro do GTM, esta chamada tem que sair daqui — senão o Lead
   conta duas vezes.
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
      pais: val('pais'),
      origem_declarada: val('origem'),
      area_atuacao: val('area_atuacao'),
      graduacao: val('graduacao'),
      horario_contato: val('melhor_horario')
    };
  }, true);

  var obs = new MutationObserver(function () {
    if (jaEnviou || !snapshot) return;
    if (sucesso.getAttribute('data-visivel') !== 'true') return;
    jaEnviou = true;

    var evento = {
      event: 'sd_lead_submit',
      form_name: 'contato',
      lead_value: 200,
      currency: 'USD',
      pais: snapshot.pais,
      origem_declarada: snapshot.origem_declarada,
      area_atuacao: snapshot.area_atuacao,
      graduacao: snapshot.graduacao,
      horario_contato: snapshot.horario_contato,
      attribution: window.sdAttr ? window.sdAttr() : {}
    };

    /* Conversões aprimoradas: só entra o que a pessoa preencheu. */
    var user = {};
    if (snapshot.email) user.email_address = snapshot.email;
    if (snapshot.telefone) user.phone_number = snapshot.telefone;
    if (user.email_address || user.phone_number) evento.user_data = user;

    window.dataLayer.push(evento);

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', {
        content_name: evento.form_name,
        value: evento.lead_value,
        currency: evento.currency
      });
    }

    snapshot = null;
    obs.disconnect();
  });
  obs.observe(sucesso, { attributes: true, attributeFilter: ['data-visivel'] });
})();
