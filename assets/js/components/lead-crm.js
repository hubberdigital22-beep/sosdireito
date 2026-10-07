/* ============================================================
   SOS DIREITO — Cópia do lead para o CRM
   O formulário de contato continua abrindo o WhatsApp sozinho (form.js).
   Este arquivo manda uma cópia do mesmo lead para /api/lead, que o guarda
   numa fila privada e o entrega ao CRM (o projeto de leads da SOS no JSYNQ).

   Nada aqui pode atrasar nem estragar o WhatsApp: o envio acontece DEPOIS
   que o form.js validou e abriu a conversa (o estado de sucesso acende), a
   resposta não é esperada e uma falha só vira aviso no console, sem alert e
   sem mexer no painel que a pessoa está vendo. Quem garante que o lead não
   se perde é o servidor, não o navegador.

   Mesmo gatilho do lead-tracking.js: fotografa os campos no submit (o form.js
   reseta o formulário no sucesso) e só dispara quando [data-form-sucesso]
   passa a data-visivel="true". Não toca em dataLayer nem em fbq: o rastreio
   continua sendo só o do lead-tracking.js.

   O servidor decide o que vai ao CRM (CAMPOS_NO_CRM em api/_lead.js) e
   descarta o resto. Aqui vai tudo o que o formulário tem, mais a atribuição
   (UTM e gclid) e a isca para robô (site_extra, escondida no HTML).
   ============================================================ */
(function () {
  'use strict';

  var form = document.querySelector('[data-form]');
  var sucesso = form && form.querySelector('[data-form-sucesso]');
  if (!form || !sucesso || !window.fetch) return;

  var snapshot = null;

  /* Fotografa no submit, em captura: roda antes do form.js e do reset. */
  form.addEventListener('submit', function () {
    var dados = new FormData(form);
    var corpo = {};
    dados.forEach(function (valor, nome) {
      if (typeof valor === 'string') corpo[nome] = valor;
    });
    corpo.attribution = (window.sdAttr ? window.sdAttr() : {}) || {};
    snapshot = corpo;
  }, true);

  function enviar(corpo) {
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      keepalive: true
    }).then(function (r) {
      if (!r.ok) console.warn('[SOS] /api/lead respondeu', r.status);
    }).catch(function (err) {
      console.warn('[SOS] /api/lead falhou:', err && err.message);
    });
  }

  /* O submit seguinte pode ser válido de novo, então a trava é só o
     snapshot: cada foto vira no máximo um envio. */
  new MutationObserver(function () {
    if (!snapshot) return;
    if (sucesso.getAttribute('data-visivel') !== 'true') return;
    var corpo = snapshot;
    snapshot = null;
    enviar(corpo);
  }).observe(sucesso, { attributes: true, attributeFilter: ['data-visivel'] });
})();
