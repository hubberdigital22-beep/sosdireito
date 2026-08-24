/* ============================================================
   SOS DIREITO — Timeline de etapas
   Marcadores numerados ligados por linha vinho contínua que se
   desenha conforme a rolagem. Cada marcador acende quando a
   linha chega nele. Sem número de dia colado na etapa.
   ============================================================ */
(function () {
  'use strict';

  var motion = (window.SOS && window.SOS.motion) || { ativo: false };

  document.querySelectorAll('[data-timeline]').forEach(function (raiz) {
    var preenchido = raiz.querySelector('.timeline__trilho-preenchido');
    var etapas     = Array.prototype.slice.call(raiz.querySelectorAll('.etapa'));
    if (!etapas.length) return;

    /* A linha termina no último marcador, não no fim do último card:
       um traço sobrando depois da Etapa 8 sugere etapa que não existe. */
    var trilho = raiz.querySelector('.timeline__trilho');
    if (trilho) {
      var ajustarTrilho = function () {
        var ultimo = etapas[etapas.length - 1].querySelector('.etapa__marcador');
        if (!ultimo) return;
        var base = raiz.getBoundingClientRect().top;
        var fim = ultimo.getBoundingClientRect();
        trilho.style.height = (fim.top - base + fim.height / 2) + 'px';
        trilho.style.bottom = 'auto';
      };
      ajustarTrilho();
      window.addEventListener('resize', ajustarTrilho);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarTrilho);
    }

    /* Sem movimento, tudo já nasce no estado final. */
    if (!motion.ativo) {
      if (preenchido) preenchido.style.transform = 'scaleY(1)';
      etapas.forEach(function (e) { e.setAttribute('data-ativa', 'true'); });
      return;
    }

    var g = motion.gsap;

    /* A linha acompanha a rolagem — é o fio condutor da página. */
    if (preenchido) {
      g.to(preenchido, {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: raiz,
          start: 'top 62%',
          end: 'bottom 78%',
          scrub: 0.5
        }
      });
    }

    /* Cada marcador acende quando a linha o alcança, e apaga ao voltar. */
    etapas.forEach(function (etapa) {
      var marcador = etapa.querySelector('.etapa__marcador');
      ScrollTrigger.create({
        trigger: marcador || etapa,
        start: 'top 62%',
        onEnter:     function () { etapa.setAttribute('data-ativa', 'true'); },
        onLeaveBack: function () { etapa.setAttribute('data-ativa', 'false'); }
      });

      var corpo = etapa.querySelector('.etapa__corpo');
      if (corpo) {
        g.fromTo(corpo,
          { opacity: 0, x: 24 },
          {
            opacity: 1, x: 0, duration: 0.75,
            scrollTrigger: { trigger: etapa, start: 'top 82%', once: true }
          }
        );
      }
    });

    /* A bifurcação aprovado / RFE fecha a Etapa 7. */
    var ramificacoes = raiz.querySelectorAll('.ramificacao');
    if (ramificacoes.length) {
      g.fromTo(ramificacoes,
        { opacity: 0, y: 14 },
        {
          opacity: 1, y: 0, duration: 0.65, stagger: 0.14,
          scrollTrigger: { trigger: ramificacoes[0], start: 'top 86%', once: true }
        }
      );
    }
  });
})();
