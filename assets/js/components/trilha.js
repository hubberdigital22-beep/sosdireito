/* ============================================================
   SOS DIREITO — Trilha e bifurcação
   O motivo-assinatura: uma linha vinho que parte de um ponto
   comum e se divide em dois caminhos. Aparece na Home, no
   Bloco 3 do L-1A e na Etapa 7 de Como Funciona.
   ============================================================ */
(function () {
  'use strict';

  var motion = (window.SOS && window.SOS.motion) || { ativo: false };

  document.querySelectorAll('[data-bifurcacao]').forEach(function (raiz) {
    var caminhos = raiz.querySelectorAll('.caminho');
    var no       = raiz.querySelector('.bifurcacao__no');
    var tronco   = raiz.querySelector('.bifurcacao__tronco');
    var ramoA    = raiz.querySelector('.bifurcacao__ramo-a');
    var ramoB    = raiz.querySelector('.bifurcacao__ramo-b');

    if (!motion.ativo) return;

    var g = motion.gsap;

    [ramoA, ramoB].forEach(function (p) {
      if (!p) return;
      var c = motion.comprimentoDeTraco(p);
      g.set(p, { strokeDasharray: c, strokeDashoffset: c });
    });

    motion.sequencia({ trigger: raiz, start: 'top 78%' }, function (tl) {
      /* A ordem carrega o argumento: primeiro o ponto de partida comum,
         depois o tronco, só então os dois caminhos se separam. */
      if (no)     tl.to(no,     { scale: 1, duration: 0.36, ease: 'back.out(2.2)' });
      if (tronco) tl.to(tronco, { scaleY: 1, duration: 0.42, ease: 'power2.out' }, '-=0.10');
      if (ramoA)  tl.to(ramoA,  { strokeDashoffset: 0, duration: 0.85, ease: 'power2.inOut' }, '-=0.08');
      if (ramoB)  tl.to(ramoB,  { strokeDashoffset: 0, duration: 0.85, ease: 'power2.inOut' }, '<');

      if (caminhos.length) {
        tl.fromTo(caminhos,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 },
          '-=0.42'
        );
      }
    });
  });

  /* ---- Linha do tempo horizontal "26 anos" (página Sobre) ---- */
  document.querySelectorAll('[data-marco]').forEach(function (raiz) {
    var linha = raiz.querySelector('.marco__linha-preenchida');
    var valor = raiz.querySelector('.marco__valor');
    if (!motion.ativo) {
      if (linha) linha.style.transform = 'scaleX(1)';
      return;
    }

    motion.sequencia({ trigger: raiz, start: 'top 80%' }, function (tl) {
      if (linha) tl.to(linha, { scaleX: 1, duration: 1.2, ease: 'power2.inOut' });

      /* A contagem até 26 acontece junto com o traço, não depois. */
      if (valor) {
        var alvo = parseInt(valor.getAttribute('data-valor') || valor.textContent, 10) || 0;
        var contador = { n: 0 };
        tl.to(contador, {
          n: alvo,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: function () { valor.textContent = Math.round(contador.n); }
        }, '<');
      }
    });
  });
})();

/* ============================================================
   L-1A — Bloco 1 (identificação) e Bloco 2 (o termo)
   ============================================================ */
(function () {
  'use strict';

  var motion = (window.SOS && window.SOS.motion) || { ativo: false };
  if (!motion.ativo) return;
  var g = motion.gsap;

  /* Cada frase entra sozinha, com distância de rolagem generosa.
     A cadência é o ponto do bloco — não a animação. */
  document.querySelectorAll('[data-frase]').forEach(function (frase) {
    g.fromTo(frase,
      { opacity: 0, y: 26 },
      {
        opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: frase, start: 'top 82%', once: true }
      }
    );
  });

  /* O grifo cresce sob o termo na primeira vez que ele aparece na página. */
  document.querySelectorAll('[data-termo] .destaque-termo__grifo').forEach(function (grifo) {
    g.to(grifo, {
      scaleX: 1, duration: 0.7, ease: 'power2.out', delay: 0.15,
      scrollTrigger: { trigger: grifo.parentElement, start: 'top 84%', once: true }
    });
  });
})();
