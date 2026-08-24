/* ============================================================
   SOS DIREITO — Carrossel de prova social
   Rolagem nativa com scroll-snap; os botões são um atalho,
   não o único caminho. Navegável por teclado e por gesto.
   ============================================================ */
(function () {
  'use strict';

  document.querySelectorAll('[data-carrossel]').forEach(function (raiz) {
    var viewport = raiz.querySelector('.carrossel__viewport');
    var anterior = raiz.querySelector('[data-carrossel-anterior]');
    var proximo  = raiz.querySelector('[data-carrossel-proximo]');
    var slides   = raiz.querySelectorAll('.carrossel__slide');
    if (!viewport || !slides.length) return;

    function passo() {
      var slide = slides[0];
      var estilo = window.getComputedStyle(viewport.querySelector('.carrossel__trilho'));
      var gap = parseFloat(estilo.columnGap || estilo.gap) || 0;
      return slide.getBoundingClientRect().width + gap;
    }

    function atualizarBotoes() {
      var max = viewport.scrollWidth - viewport.clientWidth;
      var x = viewport.scrollLeft;
      if (anterior) anterior.disabled = x <= 2;
      if (proximo)  proximo.disabled  = x >= max - 2;
    }

    function mover(direcao) {
      viewport.scrollBy({ left: passo() * direcao, behavior: 'smooth' });
    }

    if (anterior) anterior.addEventListener('click', function () { mover(-1); });
    if (proximo)  proximo.addEventListener('click', function () { mover(1); });

    viewport.addEventListener('scroll', atualizarBotoes, { passive: true });
    window.addEventListener('resize', atualizarBotoes);
    atualizarBotoes();

    /* Setas do teclado quando o carrossel tem foco */
    viewport.setAttribute('tabindex', '0');
    viewport.setAttribute('role', 'region');
    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); mover(-1); }
    });
  });

  /* ---- Vídeos de caso: tocam mudos só quando visíveis ----
     Num mural cheio de mídia, deixar tudo rodando pesa demais. */
  var videos = document.querySelectorAll('video[data-auto-visivel]');
  if (videos.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        var v = entrada.target;
        if (entrada.isIntersecting) {
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.4 });
    Array.prototype.forEach.call(videos, function (v) { obs.observe(v); });
  }
})();
