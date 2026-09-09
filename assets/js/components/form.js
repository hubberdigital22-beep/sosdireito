/* ============================================================
   SOS DIREITO — Formulário
   Validação, máscara de telefone e estados de envio.
   O destino sai de SOS.config.FORM_ENDPOINT: sem endpoint
   configurado, o envio é simulado para o fluxo ser testável.
   ============================================================ */
(function () {
  'use strict';

  var cfg = (window.SOS && window.SOS.config) || {};

  var MENSAGENS = {
    obrigatorio: 'Este campo é obrigatório.',
    email: 'Informe um e-mail válido.',
    telefone: 'Informe um telefone válido, com DDD.'
  };

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---- Destino WhatsApp ----
     O formulário não tem backend: os campos viram uma mensagem pronta
     em wa.me. A ordem abaixo é a ordem em que a mensagem é lida no
     celular — nome e telefone primeiro, texto livre por último. */
  var ROTULOS = {
    nome: 'Nome',
    email: 'E-mail',
    telefone: 'Telefone',
    tempo_de_atividade: 'Tempo de atividade da empresa',
    funcionarios_clt: 'Funcionários CLT',
    mensagem: 'Mensagem'
  };
  var ORDEM = ['nome', 'email', 'telefone', 'tempo_de_atividade',
               'funcionarios_clt', 'mensagem'];

  function montarMensagem(form) {
    var wa = cfg.WHATSAPP || {};
    var linhas = [wa.saudacao || 'Olá! Vim pelo site da SOS Direito.', ''];

    ORDEM.forEach(function (nome) {
      var el = form.elements[nome];
      if (!el) return;
      var v = (el.value || '').trim();
      if (!v) return;
      if (nome === 'mensagem') {
        /* Texto livre por último e com teto: URL muito longa quebra em
           parte dos aparelhos. */
        linhas.push('', ROTULOS[nome] + ':', v.slice(0, 600));
      } else {
        linhas.push(ROTULOS[nome] + ': ' + v);
      }
    });

    /* Atribuição no fim da mensagem. O marcador [ref: ...] é o mesmo que
       o Bloco 4 procura antes de injetar o gclid, então o link de
       fallback não recebe o gclid duas vezes. */
    var a = (window.sdAttr ? window.sdAttr() : {}) || {};
    var origem = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ');
    if (origem) linhas.push('', 'Origem: ' + origem);
    if (a.gclid) linhas.push((origem ? '' : '\n') + '[ref: ' + a.gclid + ']');

    return linhas.join('\n');
  }

  function linkWhatsapp(form) {
    var numero = (((cfg.WHATSAPP || {}).numero) || '').replace(/\D/g, '');
    if (!numero) return '';
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(montarMensagem(form));
  }

  /* ---- Máscara de telefone ----
     Aceita número brasileiro (com ou sem DDI) e internacional.
     Nunca bloqueia a digitação: formata o que dá e deixa passar. */
  function mascararTelefone(valor) {
    var internacional = valor.trim().charAt(0) === '+';
    var d = valor.replace(/\D/g, '');

    if (internacional) {
      /* Fora do padrão brasileiro, só agrupa em blocos legíveis. */
      if (d.startsWith('55')) {
        var br = d.slice(2, 13);
        var fmt = '+55';
        if (br.length) fmt += ' (' + br.slice(0, 2);
        if (br.length > 2) fmt += ') ' + br.slice(2, br.length > 10 ? 7 : 6);
        if (br.length > 6) fmt += '-' + br.slice(br.length > 10 ? 7 : 6, 11);
        return fmt;
      }
      return '+' + d.slice(0, 15).replace(/(\d{1,3})(\d{0,4})(\d{0,4})(\d{0,4})/,
        function (_, a, b, c, e) {
          return [a, b, c, e].filter(Boolean).join(' ');
        });
    }

    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function validarCampo(controle) {
    var campo = controle.closest('.campo');
    if (!campo) return true;

    var valor = (controle.value || '').trim();
    var erroEl = campo.querySelector('.campo__erro');
    var erro = '';

    if (controle.required && !valor) {
      erro = MENSAGENS.obrigatorio;
    } else if (valor && controle.type === 'email' && !RE_EMAIL.test(valor)) {
      erro = MENSAGENS.email;
    } else if (valor && controle.getAttribute('data-mascara') === 'telefone') {
      var digitos = valor.replace(/\D/g, '').length;
      if (digitos < 10) erro = MENSAGENS.telefone;
    }

    campo.setAttribute('data-invalido', String(!!erro));
    controle.setAttribute('aria-invalid', String(!!erro));
    if (erroEl) erroEl.textContent = erro;
    return !erro;
  }

  document.querySelectorAll('[data-form]').forEach(function (form) {
    var botao     = form.querySelector('[type="submit"]');
    var sucesso   = form.querySelector('[data-form-sucesso]');
    var falha     = form.querySelector('[data-form-erro]');
    var controles = form.querySelectorAll('.campo__controle');

    /* Máscara de telefone conforme digita */
    form.querySelectorAll('[data-mascara="telefone"]').forEach(function (input) {
      input.addEventListener('input', function () {
        var pos = input.selectionStart === input.value.length;
        input.value = mascararTelefone(input.value);
        if (pos) input.setSelectionRange(input.value.length, input.value.length);
      });
    });

    /* Valida na saída do campo; depois de errar, revalida enquanto digita */
    Array.prototype.forEach.call(controles, function (c) {
      c.addEventListener('blur', function () { validarCampo(c); });
      c.addEventListener('input', function () {
        var campo = c.closest('.campo');
        if (campo && campo.getAttribute('data-invalido') === 'true') validarCampo(c);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (sucesso) sucesso.setAttribute('data-visivel', 'false');
      if (falha)   falha.setAttribute('data-visivel', 'false');

      var valido = true;
      var primeiroInvalido = null;
      Array.prototype.forEach.call(controles, function (c) {
        if (!validarCampo(c)) {
          valido = false;
          if (!primeiroInvalido) primeiroInvalido = c;
        }
      });

      if (!valido) {
        if (primeiroInvalido) {
          primeiroInvalido.focus();
          primeiroInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      enviar(form, botao, sucesso, falha);
    });
  });

  function enviar(form, botao, sucesso, falha) {
    if (botao) botao.setAttribute('data-carregando', 'true');

    var dados = new FormData(form);

    function concluir(ok) {
      if (botao) botao.removeAttribute('data-carregando');
      var alvo = ok ? sucesso : falha;
      if (alvo) {
        alvo.setAttribute('data-visivel', 'true');
        alvo.setAttribute('role', 'status');
        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (ok) form.reset();
    }

    /* Caminho normal: abre o WhatsApp com a mensagem montada.
       O window.open acontece dentro do gesto de submit, senão o
       bloqueador de pop-up mata a aba. Se ainda assim for bloqueado,
       o estado de sucesso traz o link para abrir na mão. */
    var url = linkWhatsapp(form);
    if (url) {
      var link = sucesso && sucesso.querySelector('[data-form-whatsapp]');
      if (link) link.href = url;
      window.open(url, '_blank', 'noopener');
      concluir(true);
      return;
    }

    /* Sem número de WhatsApp e sem endpoint, não há para onde mandar:
       mostra a falha em vez de fingir sucesso. */
    if (!cfg.FORM_ENDPOINT) {
      console.error('[SOS] Sem WHATSAPP.numero e sem FORM_ENDPOINT — o lead não tem destino.');
      concluir(false);
      return;
    }

    fetch(cfg.FORM_ENDPOINT, {
      method: cfg.FORM_METODO || 'POST',
      body: dados,
      headers: { Accept: 'application/json' }
    })
      .then(function (r) { concluir(r.ok); })
      .catch(function () { concluir(false); });
  }
})();
