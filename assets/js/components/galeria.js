/* ============================================================
   SOS DIREITO — Galeria de Casos de Sucesso
   Três responsabilidades:
   1) trocar o pôster pelo vídeo no clique — é o que garante que a
      página não baixe nenhum dos 31 MB de mp4 antes da interação;
   2) filtrar por tipo (tudo / vídeo / foto);
   3) servir o mural em lotes, para a parede não abrir com 30 peças.

   Se este arquivo não rodar, a página continua servindo: os pôsteres
   são <img>, as 30 peças aparecem todas e o painel de "ver mais"
   nasce hidden na marcação. O que se perde é a reprodução do vídeo.
   ============================================================ */
(function () {
  'use strict';

  var galeria = document.querySelector('[data-galeria]');
  if (!galeria) return;

  /* ---- Pôster -> vídeo ----
     O <video> não existe na marcação: nasce aqui. Delegado no
     contêiner, então vale também para as peças que só aparecem
     depois de um lote ser revelado. */
  galeria.addEventListener('click', function (ev) {
    var botao = ev.target.closest('.peca__acionar');
    if (!botao) return;

    var src = botao.getAttribute('data-video');
    if (!src) return;

    var peca = botao.closest('.peca');
    var video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    /* O rótulo acessível do botão já descrevia a cena; passa para o vídeo. */
    video.setAttribute('aria-label', botao.getAttribute('aria-label') || '');

    /* A fala é sobreposta: sobre o vídeo, cobriria os controles. */
    if (peca) peca.classList.add('peca--tocando');

    botao.replaceWith(video);
    video.focus({ preventScroll: true });
  });

  /* Um de cada vez. Numa parede de 17 depoimentos, dois áudios ao
     mesmo tempo viram barulho — e o segundo mp4 começa a baixar sem
     que ninguém esteja ouvindo o primeiro. 'play' não borbulha:
     a escuta vai na captura. */
  galeria.addEventListener('play', function (ev) {
    galeria.querySelectorAll('video').forEach(function (outro) {
      if (outro !== ev.target) outro.pause();
    });
  }, true);

  /* ---- Filtro + lotes ---- */
  var itens = Array.prototype.slice.call(galeria.querySelectorAll('.galeria__item'));
  var filtros = document.querySelectorAll('.galeria__filtro');
  var vazio = document.querySelector('.galeria__vazio');
  var painel = document.querySelector('.galeria__mais');
  var maisBtn = document.querySelector('[data-galeria-mais]');
  var conta = document.querySelector('[data-galeria-conta]');

  /* Em 6 colunas o primeiro lote precisa encher a largura; em 2, a
     mesma quantidade daria cinco telas de rolagem. Decidido uma vez,
     no carregamento: trocar o tamanho do lote durante um
     redimensionamento faria peças sumirem debaixo do dedo. */
  var LOTE = 12;
  var INICIAL = window.matchMedia('(min-width: 900px)').matches ? 18 : 12;

  /* Sem o painel na marcação não há como revelar o resto — nesse caso
     nada é escondido, em vez de deixar peças inalcançáveis. */
  var emLotes = !!(painel && maisBtn);
  var filtro = 'tudo';
  var mostrados = INICIAL;

  function daFiltro() {
    return itens.filter(function (li) {
      return filtro === 'tudo' || li.getAttribute('data-tipo') === filtro;
    });
  }

  /* `novos` = índice a partir do qual as peças acabaram de entrar;
     null quando a lista foi remontada do zero (troca de filtro). */
  function pintar(novos) {
    var lista = daFiltro();
    var ate = emLotes ? Math.min(mostrados, lista.length) : lista.length;

    itens.forEach(function (li) {
      li.hidden = true;
      li.classList.remove('galeria__item--novo');
      li.removeAttribute('tabindex');
    });
    lista.slice(0, ate).forEach(function (li) { li.hidden = false; });

    if (vazio) vazio.hidden = lista.length > 0;

    if (emLotes) {
      painel.hidden = lista.length === 0;
      maisBtn.hidden = ate >= lista.length;
      /* role="status" no contador: quem usa leitor de tela ouve
         "24 de 30" sem precisar sair para conferir. */
      if (conta) conta.textContent = ate + ' de ' + lista.length + ' registros';
    }

    if (novos != null) {
      lista.slice(novos, ate).forEach(function (li, i) {
        li.style.setProperty('--i', i);
        li.classList.add('galeria__item--novo');
      });
      /* Quem navega por teclado continua de onde parou, em vez de
         voltar para o topo do mural. preventScroll para não puxar a
         página debaixo de quem clicou com o mouse. */
      var primeiro = lista[novos];
      if (primeiro) {
        primeiro.tabIndex = -1;
        primeiro.focus({ preventScroll: true });
      }
    }

    /* A altura da página mudou; os gatilhos de rolagem precisam saber. */
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  filtros.forEach(function (botao) {
    botao.addEventListener('click', function () {
      filtro = botao.getAttribute('data-filtro');
      filtros.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b === botao));
      });
      mostrados = INICIAL;
      pintar(null);
    });
  });

  if (emLotes) {
    maisBtn.addEventListener('click', function () {
      var antes = Math.min(mostrados, daFiltro().length);
      mostrados += LOTE;
      pintar(antes);
    });
    pintar(null);
  }
})();
