/* ============================================================
   SOS DIREITO — Cabeçalho e navegação
   ============================================================ */
(function () {
  'use strict';

  var cabecalho = document.querySelector('[data-cabecalho]');
  var toggle    = document.querySelector('[data-nav-toggle]');
  var nav       = document.querySelector('[data-nav]');
  if (!cabecalho) return;

  /* ---- Estado ao rolar ---- */
  var ultimoEstado = null;
  function aoRolar() {
    var rolado = window.scrollY > 8;
    if (rolado !== ultimoEstado) {
      cabecalho.setAttribute('data-rolado', String(rolado));
      ultimoEstado = rolado;
    }
  }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  /* ---- Menu móvel ---- */
  if (!toggle || !nav) return;

  var aberto = false;

  function abrir() {
    aberto = true;
    nav.setAttribute('data-menu-movel', '');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    document.body.setAttribute('data-menu-aberto', 'true');
  }

  function fechar() {
    aberto = false;
    nav.removeAttribute('data-menu-movel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    document.body.removeAttribute('data-menu-aberto');
  }

  toggle.addEventListener('click', function () {
    aberto ? fechar() : abrir();
  });

  /* Fecha ao navegar */
  nav.addEventListener('click', function (e) {
    if (aberto && e.target.closest('a')) fechar();
  });

  /* Fecha no Esc, devolvendo o foco ao botão */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && aberto) {
      fechar();
      toggle.focus();
    }
  });

  /* Ao voltar para desktop o menu não pode ficar preso aberto */
  var mq = window.matchMedia('(min-width: 1280px)');
  var aoMudar = function (e) { if (e.matches && aberto) fechar(); };
  mq.addEventListener ? mq.addEventListener('change', aoMudar) : mq.addListener(aoMudar);
})();
