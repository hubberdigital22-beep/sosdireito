/* ============================================================
   SOS DIREITO — Calculadora

   Réplica funcional da calculadora do site atual (Opção B do
   documento: total estimado exposto). As fórmulas abaixo
   reproduzem exatamente as do calculadora2.html em produção —
   qualquer combinação de entradas gera o mesmo total.

   Os valores vivem em assets/js/data/taxas.js.
   ============================================================ */
(function () {
  'use strict';

  var T = (window.SOS && window.SOS.taxas);
  var raiz = document.querySelector('[data-calculadora]');
  if (!T || !raiz) return;

  var el = function (id) { return document.getElementById(id); };

  var campos = {
    visto:     el('calc-visto'),
    processo:  raiz.querySelectorAll('input[name="tipo_processo"]'),
    adultos:   el('calc-adultos'),
    criancas:  el('calc-criancas'),
    conjuge:   el('calc-conjuge')
  };

  var grupos = {
    adultos:  el('calc-grupo-adultos'),
    conjuge:  el('calc-grupo-conjuge'),
    criancas: el('calc-grupo-criancas')
  };

  var saida = {
    painel:      el('calc-resultado'),
    total:       el('calc-total'),
    linhas:      el('calc-linhas'),
    tabelas:     el('calc-tabelas'),
    disclaimers: el('calc-disclaimers')
  };

  function dinheiro(v) {
    return 'US$ ' + v.toLocaleString('en-US',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function ehL1(v) { return v === 'L1' || v === 'L1R'; }

  /* O L-1 pergunta cônjuge e filhos dependentes; as categorias EB
     perguntam quantas pessoas acima e abaixo de 14 anos. */
  function ajustarCampos() {
    var v = campos.visto.value;
    var l1 = ehL1(v);

    grupos.adultos.hidden = l1;
    grupos.conjuge.hidden = !l1;

    el('calc-rotulo-criancas').textContent = l1
      ? 'Quantos filhos dependentes fazem parte do processo?'
      : 'Quantas pessoas MENORES de 14 anos fazem parte do processo?';

    esconderResultado();
  }

  function esconderResultado() {
    saida.painel.hidden = true;
    raiz.setAttribute('data-calculado', 'false');
  }

  /* ---------- Fórmulas ---------- */

  function calcularEB1(sub, adultos, criancas, processo) {
    var h = T.honorarios[sub];
    var total = 0;
    var linhas = [];

    linhas.push(['Na assinatura do contrato',
      'Faixa estimada de honorários profissionais, taxas, impostos e tarifas imigratórios.',
      h.assinatura]);
    linhas.push(['Cheques, Money Orders ou Autorizações de Débito (ACH)',
      'Valor estimado, podendo ser alterado a qualquer momento pelo USCIS sem aviso prévio.',
      T.composicoes.ebCheques]);
    linhas.push(['Fee de Impressão, Envio, Correio e Impostos', null, h.impressao]);

    var pessoas = adultos + criancas;
    var protocolo = T.protocolo.honorarioEB1 + T.protocolo.titular;
    if (pessoas > 0) protocolo += (pessoas - 1) * T.protocolo.dependenteEB1;
    linhas.push(['No dia do protocolo',
      'Faixa estimada de honorários profissionais, taxas, impostos e tarifas imigratórios e impostos federais.',
      protocolo]);

    /* Consular: sem ajuste de status, não entra no total (igual à produção,
       que troca o valor por "N/A - Processo Consular" e some com a linha
       opcional de Honorários de Ajuste de Status). */
    var ajuste = 0;
    if (processo === 'ajuste') {
      ajuste = Math.max(1, adultos) * T.ajusteEB1.adulto + criancas * T.ajusteEB1.crianca;
      linhas.push(['Ajuste de Status',
        'Valor estimado, podendo ser alterado a qualquer momento pelo USCIS sem aviso prévio.',
        ajuste]);
    } else {
      linhas.push(['Ajuste de Status', null, 'N/A — Processo Consular']);
    }

    linhas.push(['Na aprovação eletrônica da I-140',
      'Valor estimado de honorários profissionais.', h.aprovacao]);

    total = h.assinatura + T.composicoes.ebCheques + h.impressao + protocolo + ajuste + h.aprovacao;

    return {
      total: total, linhas: linhas,
      opcional: processo === 'ajuste',
      tabelas: ['eb', 'ajuste']
    };
  }

  function calcularEB2(adultos, criancas) {
    var h = T.honorarios.EB2;
    var linhas = [];

    linhas.push(['Na assinatura do contrato',
      'Faixa estimada de honorários profissionais, taxas, impostos e tarifas imigratórios.',
      h.assinatura]);
    linhas.push(['Cheques, Money Orders ou Autorizações de Débito (ACH)',
      'Valor estimado, podendo ser alterado a qualquer momento pelo USCIS sem aviso prévio.',
      T.composicoes.ebCheques]);
    linhas.push(['Fee de Impressão, Envio, Correio e Impostos', null, h.impressao]);

    var pessoas = adultos + criancas;
    var protocolo = pessoas === 0
      ? T.protocolo.titular
      : Math.max(1, adultos) * T.protocolo.adultoEB2 + criancas * T.protocolo.criancaEB2;
    linhas.push(['No dia do protocolo',
      'Faixa estimada de honorários profissionais, taxas, impostos e tarifas imigratórios e impostos federais.',
      protocolo]);

    /* No EB-2 o ajuste de status não entra no total: é serviço adicional. */
    linhas.push(['Ajuste de Status',
      'Serviço adicional ao contrato, não incluído neste total.', null]);

    linhas.push(['Na aprovação eletrônica da I-140',
      'Valor estimado de honorários profissionais.', h.aprovacao]);

    return {
      total: h.assinatura + T.composicoes.ebCheques + h.impressao + protocolo + h.aprovacao,
      linhas: linhas, opcional: false, tabelas: ['eb', 'ajuste']
    };
  }

  function calcularL1(sub, criancas, comConjuge) {
    var h = T.honorarios[sub];
    var c = T.composicoes;
    var cheques = c.l1ChequesBase + (comConjuge ? c.l1Conjuge : 0) + criancas * c.l1Dependente;
    var linhas = [];

    linhas.push(['Na assinatura do contrato',
      'Faixa estimada de honorários profissionais, taxas, impostos e tarifas imigratórios.',
      h.assinatura]);
    linhas.push(['No dia do protocolo',
      'Faixa estimada de honorários profissionais, taxas, impostos e tarifas imigratórios e impostos federais.',
      T.protocolo.titular]);
    linhas.push(['Cheques, Money Orders ou Autorizações de Débito (ACH)',
      'Valor estimado, podendo ser alterado a qualquer momento pelo USCIS sem aviso prévio.',
      cheques]);
    linhas.push(['Fee de Impressão, Envio, Correio e Impostos', null, h.impressao]);

    var total = h.assinatura + T.protocolo.titular + cheques + h.impressao;

    /* A renovação não tem a etapa de 48h após a aprovação. */
    if (h.aprovacao > 0) {
      linhas.push(['48h após a aprovação eletrônica da I-129',
        'Valor estimado de honorários profissionais.', h.aprovacao]);
      total += h.aprovacao;
    }

    return {
      total: total, linhas: linhas, opcional: false,
      tabelas: ['l1'], cheques: cheques, conjuge: comConjuge, criancas: criancas
    };
  }

  function calcular() {
    var v = campos.visto.value;
    if (!v) return;

    var processo = 'ajuste';
    Array.prototype.forEach.call(campos.processo, function (r) {
      if (r.checked) processo = r.value;
    });

    var adultos  = parseInt(campos.adultos.value, 10) || 0;
    var criancas = parseInt(campos.criancas.value, 10) || 0;

    var r;
    if (v === 'EB1A' || v === 'EB1C') r = calcularEB1(v, adultos, criancas, processo);
    else if (v === 'EB2')             r = calcularEB2(adultos, criancas);
    else                              r = calcularL1(v, criancas, campos.conjuge.checked);

    render(r, v);
  }

  /* ---------- Render ---------- */

  function render(r, visto) {
    saida.total.textContent = dinheiro(r.total);

    saida.linhas.innerHTML = r.linhas.map(function (l) {
      var valor;
      if (typeof l[2] === 'string') valor = '<span class="calc-linha__na">' + l[2] + '</span>';
      else if (l[2] === null) valor = '<span class="calc-linha__na">Não incluído</span>';
      else valor = dinheiro(l[2]);
      return '<div class="calc-linha">' +
        '<div><p class="calc-linha__rotulo">' + l[0] + '</p>' +
        (l[1] ? '<p class="calc-linha__nota">' + l[1] + '</p>' : '') + '</div>' +
        '<p class="calc-linha__valor">' + valor + '</p></div>';
    }).join('');

    if (r.opcional) {
      saida.linhas.innerHTML +=
        '<div class="calc-linha calc-linha--opcional">' +
        '<div><p class="calc-linha__rotulo">Honorários de Ajuste de Status (opcional)</p>' +
        '<p class="calc-linha__nota">Não incluído no total acima.</p></div>' +
        '<p class="calc-linha__valor">' + dinheiro(T.opcionalAjuste) + '</p></div>';
    }

    saida.tabelas.innerHTML = montarTabelas(r, visto);

    saida.painel.hidden = false;
    raiz.setAttribute('data-calculado', 'true');
    saida.disclaimers.hidden = false;

    var motion = (window.SOS && window.SOS.motion) || { ativo: false };
    if (motion.ativo) {
      motion.gsap.fromTo(saida.painel,
        { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    }
    saida.painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function tabela(titulo, nota, linhas, total, rotuloTotal) {
    var html = '<div class="calc-tabela"><h3 class="calc-tabela__titulo">' + titulo + '</h3>';
    if (nota) html += '<p class="calc-tabela__nota">' + nota + '</p>';
    html += '<dl class="calc-tabela__lista">';
    linhas.forEach(function (l) {
      html += '<div class="calc-tabela__linha"><dt>' + l[0] + '</dt>' +
              '<dd>USD $ ' + l[1].toLocaleString('en-US',
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</dd></div>';
    });
    if (total != null) {
      html += '<div class="calc-tabela__linha calc-tabela__linha--total">' +
              '<dt>' + (rotuloTotal || 'Total') + '</dt><dd>USD $ ' +
              total.toLocaleString('en-US',
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</dd></div>';
    }
    return html + '</dl></div>';
  }

  function montarTabelas(r, visto) {
    var f = T.formularios, c = T.composicoes;
    var nota = 'Payable to: U.S. Department of Homeland Security. Valor estimado, podendo ser ' +
               'alterado a qualquer momento pelo USCIS sem aviso prévio.';
    var out = '';

    if (r.tabelas.indexOf('l1') > -1) {
      var linhas = [
        [f.i129.rotulo, f.i129.valor],
        [f.i907.rotulo, f.i907.valor],
        [f.supplemental.rotulo, f.supplemental.valor],
        [f.asilo.rotulo, f.asilo.valor],
        [f.asilo.rotulo, f.asilo.valor]
      ];
      if (r.conjuge) linhas.push(['I-539 + Supplemental Fee — Cônjuge', c.l1Conjuge]);
      if (r.criancas > 0) {
        linhas.push(['I-539 — ' + (r.criancas === 1 ? 'Dependente (1 filho)'
                                                    : 'Dependentes (' + r.criancas + ' filhos)'),
                     r.criancas * c.l1Dependente]);
      }
      out += tabela('Cheques ou débito (ACH) a serem emitidos pelo peticionário',
                    nota, linhas, r.cheques, 'Total dos cheques');

      if (!r.conjuge && r.criancas === 0) {
        out += '<p class="nota nota--neutra calc-adicionais">' +
          '<strong>Taxas adicionais, se aplicável:</strong> cônjuge — I-539 (USD $ 470,00) + ' +
          'Supplemental Fee (USD $ 500,00) = USD $ 970,00. Cada filho dependente — ' +
          'I-539 (USD $ 470,00).</p>';
      }
    }

    if (r.tabelas.indexOf('eb') > -1) {
      out += tabela('Cheques, money orders ou débito (ACH)', nota, [
        [f.i907.rotulo, f.i907.valor],
        [f.i140.rotulo, f.i140.valor],
        [f.asilo.rotulo, 600]
      ], c.ebCheques);
    }

    if (r.tabelas.indexOf('ajuste') > -1) {
      var pago = 'Será pago por um cheque de cada taxa, para cada membro da família.';
      out += tabela('Ajuste de Status — 14 anos ou mais', pago, [
        [f.i485_14mais.rotulo, f.i485_14mais.valor],
        [f.i765.rotulo, f.i765.valor],
        [f.i131.rotulo, f.i131.valor],
        [f.asilo.rotulo, f.asilo.valor]
      ], c.ajuste14Mais, 'Total por pessoa');
      out += tabela('Ajuste de Status — menores de 14 anos', pago, [
        [f.i485_menor14.rotulo, f.i485_menor14.valor],
        [f.i765.rotulo, f.i765.valor],
        [f.i131.rotulo, f.i131.valor],
        [f.asilo.rotulo, f.asilo.valor]
      ], c.ajusteMenor14, 'Total por pessoa');
    }

    return out;
  }

  /* ---------- Serviços de terceiros ---------- */
  var listaTerceiros = el('calc-terceiros');
  if (listaTerceiros) {
    listaTerceiros.innerHTML = T.terceiros.map(function (t) {
      return '<div class="estimativas__item"><span class="estimativas__fase">' + t.servico +
             '</span><span class="estimativas__prazo">' + t.faixa + '</span></div>';
    }).join('');
  }

  /* ---------- Ligações ---------- */
  campos.visto.addEventListener('change', ajustarCampos);
  [campos.adultos, campos.criancas, campos.conjuge].forEach(function (c) {
    if (c) c.addEventListener('change', esconderResultado);
  });
  Array.prototype.forEach.call(campos.processo, function (r) {
    r.addEventListener('change', esconderResultado);
  });

  var conjugeRotulo = el('calc-conjuge-rotulo');
  if (campos.conjuge && conjugeRotulo) {
    campos.conjuge.addEventListener('change', function () {
      conjugeRotulo.textContent = campos.conjuge.checked ? 'Sim' : 'Não';
    });
  }

  raiz.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!campos.visto.value) {
      campos.visto.closest('.campo').setAttribute('data-invalido', 'true');
      campos.visto.focus();
      return;
    }
    campos.visto.closest('.campo').setAttribute('data-invalido', 'false');
    calcular();
  });

  ajustarCampos();

  /* Exposto para a verificação automatizada comparar os totais
     contra a calculadora atual. */
  window.SOS.calcularParaTeste = function (visto, adultos, criancas, conjuge, processo) {
    if (visto === 'EB1A' || visto === 'EB1C') return calcularEB1(visto, adultos, criancas, processo).total;
    if (visto === 'EB2') return calcularEB2(adultos, criancas).total;
    return calcularL1(visto, criancas, !!conjuge).total;
  };
})();
