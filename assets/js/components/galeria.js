/* ============================================================
   SOS DIREITO — Galeria de Casos de Sucesso
   Duas responsabilidades: trocar o pôster pelo vídeo no clique e
   filtrar por tipo. Se este arquivo não rodar, a página continua
   servindo: os pôsteres são <img> e as fotos aparecem todas.
   ============================================================ */
(function () {
  'use strict';

  var galeria = document.querySelector('[data-galeria]');
  if (!galeria) return;

  /* ---- Pôster -> vídeo ----
     O <video> não existe na marcação: nasce aqui. É o que garante
     que a página não baixe nenhum dos 31 MB antes do clique. */
  galeria.addEventListener('click', function (ev) {
    var botao = ev.target.closest('.peca__acionar');
    if (!botao) return;

    var src = botao.getAttribute('data-video');
    if (!src) return;

    var video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    /* O rótulo acessível do botão já descrevia a cena; passa para o vídeo. */
    video.setAttribute('aria-label', botao.getAttribute('aria-label') || '');

    botao.replaceWith(video);
    video.focus({ preventScroll: true });
  });

  /* ---- Filtros ---- */
  var filtros = document.querySelectorAll('.galeria__filtro');
  var itens = galeria.querySelectorAll('.galeria__item');
  var vazio = document.querySelector('.galeria__vazio');

  filtros.forEach(function (botao) {
    botao.addEventListener('click', function () {
      var alvo = botao.getAttribute('data-filtro');

      filtros.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === botao));
      });

      var visiveis = 0;
      itens.forEach(function (li) {
        var mostra = alvo === 'tudo' || li.getAttribute('data-tipo') === alvo;
        li.hidden = !mostra;
        if (mostra) visiveis++;
      });

      if (vazio) vazio.hidden = visiveis > 0;

      /* O masonry por colunas é recalculado pelo próprio navegador,
         mas o ScrollTrigger precisa saber que a altura mudou. */
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  });
})();
