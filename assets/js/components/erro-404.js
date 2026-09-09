/* ============================================================
   SOS DIREITO — Rastreamento da página 404

   Não está no documento de instalação de rastreamento: entra
   porque, em semana de lançamento de campanha, a URL de anúncio
   digitada errada é o erro mais caro e o mais difícil de achar.
   O clique é cobrado, a pessoa cai no 404, e nada no relatório
   diz qual endereço quebrou.

   O campo que resolve o diagnóstico é o referrer:

     referrer_interno = true   → link quebrado dentro do site
     referrer vazio + gclid    → URL do anúncio errada (clique pago perdido)
     referrer externo          → link de terceiro apontando para cá

   Só entra no 404.html, via scripts_extra.
   ============================================================ */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];

  /* Hospedagem estática (Netlify, Vercel, Pages) serve o 404.html no
     lugar, sem redirecionar: location.pathname continua sendo o endereço
     que a pessoa tentou, que é justamente o que interessa. Se o host
     redirecionar, o caminho quebrado se perde e sobra "/404.html" — daí
     caminho_preservado sai false e a origem tem que ser lida no referrer. */
  var perdido = /^\/404(\.html)?$/.test(location.pathname);
  var ref = document.referrer || '';

  window.dataLayer.push({
    event: 'sd_404',
    caminho_quebrado: location.pathname + location.search,
    caminho_preservado: !perdido,
    referrer: ref || '(direto)',
    referrer_interno: ref.indexOf(location.origin + '/') === 0,
    attribution: window.sdAttr ? window.sdAttr() : {}
  });
})();
