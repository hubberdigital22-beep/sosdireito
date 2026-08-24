/* ============================================================
   SOS DIREITO — Decoração de fundo
   Parallax lento do monograma e a barra de credibilidade.
   Tudo aqui é ornamento: se não rodar, nada se perde.
   ============================================================ */
(function () {
  'use strict';

  var motion = (window.SOS && window.SOS.motion) || { ativo: false };

  /* ---- Barra de credibilidade ----
     O filete cresce e as frases entram em sequência. */
  document.querySelectorAll('[data-credibilidade]').forEach(function (barra) {
    var itens = barra.querySelectorAll('.barra-credibilidade__item');

    if (!motion.ativo) {
      barra.setAttribute('data-animada', 'true');
      return;
    }

    var g = motion.gsap;
    g.fromTo(itens,
      { opacity: 0, y: 10 },
      {
        opacity: 1, y: 0, duration: 0.7, stagger: 0.12,
        scrollTrigger: {
          trigger: barra,
          start: 'top 92%',
          once: true,
          onEnter: function () { barra.setAttribute('data-animada', 'true'); }
        }
      }
    );
  });

  /* ---- Hero da Home: monograma e título por frase ----
     A primeira impressão do site. O monograma entra com uma leve
     aproximação; o título chega em três frases, não em bloco único;
     o convite de rolagem fecha a sequência. Sem GSAP ou com movimento
     reduzido, o CSS de base.css já entrega tudo visível — isto é só
     a entrada. */
  document.querySelectorAll('.hero--home').forEach(function (hero) {
    if (!motion.ativo) return;
    var g = motion.gsap;

    var monograma = hero.querySelector('.hero__cena .monograma-fundo');
    var frases = hero.querySelectorAll('.hero__frase');
    var rolar = hero.querySelector('.hero__rolar');

    var tl = g.timeline({ delay: 0.15 });

    if (monograma) {
      g.set(monograma, { opacity: 0, scale: 0.94, transformOrigin: '50% 50%' });
      tl.to(monograma, { opacity: 1, scale: 1, duration: 1.05, ease: 'power2.out' }, 0);
    }

    if (frases.length) {
      tl.fromTo(frases,
        { opacity: 0, y: '0.4em' },
        { opacity: 1, y: '0em', duration: 0.65, ease: 'power3.out', stagger: 0.17 },
        0.1
      );
    }

    /* O convite de rolagem só ganha vida depois que o resto do hero
       pousou — nunca disputa atenção com o título ou os CTAs.
       A opacidade do elemento real é tween do GSAP (como o resto do
       site); [data-pronto] só liga as pseudo-elementos do traço, que
       o GSAP não alcança. */
    if (rolar) {
      tl.to(rolar, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 2.6);
      tl.call(function () { rolar.setAttribute('data-pronto', 'true'); }, null, 2.6);
    }
  });

  /* ---- Monograma com deriva lenta ----
     Movimento pequeno de propósito: dá profundidade sem chamar atenção. */
  if (!motion.ativo) return;
  var g = motion.gsap;

  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var intensidade = parseFloat(el.getAttribute('data-parallax')) || 60;
    g.to(el, {
      yPercent: intensidade / 4,
      ease: 'none',
      scrollTrigger: {
        trigger: el.parentElement || el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1
      }
    });
  });
})();
