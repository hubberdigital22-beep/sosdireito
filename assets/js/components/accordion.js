/* ============================================================
   SOS DIREITO — Accordion
   Mesmo componente no L-1A (Bloco 6), no glossário de Como
   Funciona e na página de Perguntas Frequentes.
   ============================================================ */
(function () {
  'use strict';

  var motion = (window.SOS && window.SOS.motion) || { ativo: false };

  function iniciar(raiz) {
    var gatilhos = raiz.querySelectorAll('[data-accordion-gatilho]');
    /* data-accordion="exclusivo" fecha os irmãos ao abrir um item */
    var exclusivo = raiz.getAttribute('data-accordion') === 'exclusivo';

    Array.prototype.forEach.call(gatilhos, function (gatilho) {
      var painel = document.getElementById(gatilho.getAttribute('aria-controls'));
      if (!painel) return;

      /* A primeira pergunta do L-1A já nasce aberta: é a objeção mais
         forte da página e precisa ser vista sem clique. */
      var iniciaAberto = gatilho.getAttribute('aria-expanded') === 'true';
      painel.style.height = iniciaAberto ? 'auto' : '0px';

      gatilho.addEventListener('click', function () {
        var estaAberto = gatilho.getAttribute('aria-expanded') === 'true';

        if (exclusivo && !estaAberto) {
          Array.prototype.forEach.call(gatilhos, function (outro) {
            if (outro !== gatilho && outro.getAttribute('aria-expanded') === 'true') {
              alternar(outro, document.getElementById(outro.getAttribute('aria-controls')), false);
            }
          });
        }

        alternar(gatilho, painel, !estaAberto);
      });
    });
  }

  function alternar(gatilho, painel, abrir) {
    gatilho.setAttribute('aria-expanded', String(abrir));

    if (!motion.ativo) {
      painel.style.height = abrir ? 'auto' : '0px';
      return;
    }

    var g = motion.gsap;
    g.killTweensOf(painel);

    if (abrir) {
      g.set(painel, { height: 'auto' });
      var alvo = painel.offsetHeight;
      g.fromTo(painel,
        { height: 0 },
        {
          height: alvo,
          duration: 0.42,
          ease: 'power2.out',
          onComplete: function () { painel.style.height = 'auto'; }
        }
      );
    } else {
      g.fromTo(painel,
        { height: painel.offsetHeight },
        { height: 0, duration: 0.34, ease: 'power2.inOut' }
      );
    }
  }

  document.querySelectorAll('[data-accordion]').forEach(iniciar);
})();
