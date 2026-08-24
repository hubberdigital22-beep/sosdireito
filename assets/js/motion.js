/* ============================================================
   SOS DIREITO — Núcleo de movimento
   Registra o GSAP, respeita prefers-reduced-motion e expõe os
   reveals padrão. Movimento a serviço da leitura, nunca decorativo.
   ============================================================ */
(function () {
  'use strict';

  window.SOS = window.SOS || {};

  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var temGSAP = typeof window.gsap !== 'undefined';

  /* Sem GSAP ou com movimento reduzido: o conteúdo entra pronto.
     A classe deixa o CSS revelar tudo imediatamente. */
  if (!temGSAP || reduzido) {
    document.documentElement.classList.add('js-sem-motion');
    window.SOS.motion = { ativo: false, revelar: function () {}, gsap: null };
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  gsap.defaults({ ease: 'power3.out', duration: 0.9 });

  var M = {
    ativo: true,
    gsap: gsap,

    /* Reveal padrão: fade + subida curta, uma vez só. */
    revelar: function (alvos, opcoes) {
      var els = typeof alvos === 'string' ? gsap.utils.toArray(alvos) : alvos;
      if (!els || !els.length) return;
      opcoes = opcoes || {};

      return gsap.fromTo(els,
        { opacity: 0, y: opcoes.y != null ? opcoes.y : 22 },
        {
          opacity: 1,
          y: 0,
          duration: opcoes.duration || 0.9,
          stagger: opcoes.stagger != null ? opcoes.stagger : 0.09,
          delay: opcoes.delay || 0,
          scrollTrigger: opcoes.imediato ? undefined : {
            trigger: opcoes.trigger || els[0],
            start: opcoes.start || 'top 84%',
            once: true
          }
        }
      );
    },

    /* Desenho de traço SVG conforme a rolagem. É o mecanismo por trás
       da trilha vinho, das bifurcações e do trilho da timeline. */
    desenharTraco: function (path, opcoes) {
      if (!path) return;
      opcoes = opcoes || {};
      var comprimento = M.comprimentoDeTraco(path);

      gsap.set(path, { strokeDasharray: comprimento, strokeDashoffset: comprimento });

      return gsap.to(path, {
        strokeDashoffset: 0,
        ease: opcoes.scrub ? 'none' : 'power2.inOut',
        duration: opcoes.duration || 1.4,
        delay: opcoes.delay || 0,
        scrollTrigger: {
          trigger: opcoes.trigger || path,
          start: opcoes.start || 'top 78%',
          end: opcoes.end || 'bottom 62%',
          scrub: opcoes.scrub ? (opcoes.scrub === true ? 0.6 : opcoes.scrub) : false,
          once: !opcoes.scrub
        }
      });
    },

    /* Sequência presa a um gatilho de rolagem.
       A timeline é montada ANTES de receber o ScrollTrigger: criar
       um gatilho sobre uma timeline ainda vazia faz o GSAP considerá-la
       concluída na hora e, com `once`, matá-la antes dos tweens entrarem. */
    sequencia: function (opcoes, construir) {
      opcoes = opcoes || {};
      var scrub = opcoes.scrub;
      var tl = gsap.timeline({ paused: !scrub });

      construir(tl);

      ScrollTrigger.create({
        trigger: opcoes.trigger,
        start: opcoes.start || 'top 76%',
        end: opcoes.end || 'bottom top',
        scrub: scrub || false,
        animation: scrub ? tl : undefined,
        once: !scrub,
        onEnter: scrub ? undefined : function () { tl.play(); }
      });

      return tl;
    },

    /* Comprimento de traço para animação de dash.
       Com vector-effect="non-scaling-stroke" o dash é medido em pixels
       de tela, não em unidades do viewBox — e o SVG das bifurcações é
       esticado na horizontal. A folga garante que o traço cubra o
       caminho inteiro em qualquer largura. */
    comprimentoDeTraco: function (path) {
      return path.getTotalLength() * 1.25;
    },

    atualizar: function () { ScrollTrigger.refresh(); }
  };

  window.SOS.motion = M;

  /* ---- Reveals declarativos ----
     Qualquer elemento com [data-revelar] entra sozinho.
     data-revelar="grupo" agrupa filhos em stagger. */
  function iniciarReveals() {
    gsap.utils.toArray('[data-revelar]').forEach(function (el) {
      var modo = el.getAttribute('data-revelar');
      var atraso = parseFloat(el.getAttribute('data-revelar-delay')) || 0;

      if (modo === 'grupo') {
        var filhos = Array.prototype.slice.call(el.children);
        if (!filhos.length) return;
        gsap.set(el, { opacity: 1 });
        M.revelar(filhos, { trigger: el, delay: atraso });
      } else {
        M.revelar([el], { trigger: el, stagger: 0, delay: atraso });
      }
    });
  }

  /* As fontes mudam a altura do texto; recalcular evita gatilhos errados. */
  function aoCarregarFontes() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      iniciarReveals();
      aoCarregarFontes();
    });
  } else {
    iniciarReveals();
    aoCarregarFontes();
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
