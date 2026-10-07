/* ============================================================
   SOS DIREITO — Formulário
   Validação, máscaras e estados de envio.

   O destino é /api/lead (FORM_ENDPOINT): o servidor guarda o lead,
   cria o card no CRM e manda o primeiro atendimento pelo WhatsApp da
   SOS. O formulário não abre WhatsApp nenhum; espera a resposta do
   servidor e só então mostra o sucesso, porque agora ele é o único
   caminho do lead.
   ============================================================ */
(function () {
  'use strict';

  var cfg = (window.SOS && window.SOS.config) || {};

  var MENSAGENS = {
    obrigatorio: 'Este campo é obrigatório.',
    email: 'Informe um e-mail válido.',
    telefone: 'Informe um telefone válido, com DDD.',
    ano: 'Informe o ano com 4 dígitos.',
    anoFuturo: 'O ano não pode ser no futuro.',
    data: 'Informe uma data válida.'
  };

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    } else if (valor && controle.getAttribute('data-mascara') === 'ano') {
      if (!/^\d{4}$/.test(valor)) erro = MENSAGENS.ano;
      else if (+valor > new Date().getFullYear()) erro = MENSAGENS.anoFuturo;
    } else if (valor && controle.type === 'date') {
      /* O navegador já barra data impossível, mas em campo type=date sem
         suporte nativo o valor chega como texto solto. */
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) erro = MENSAGENS.data;
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

    /* País: 253 opções vindas de assets/js/data/paises.js. Ficam fora do
       HTML porque a lista é longa e é dado, não marcação. */
    form.querySelectorAll('[data-paises]').forEach(function (sel) {
      var lista = (window.SOS && window.SOS.paises) || [];
      if (!lista.length) return;
      var frag = document.createDocumentFragment();
      lista.forEach(function (nome) {
        var o = document.createElement('option');
        o.value = nome;
        o.textContent = nome;
        frag.appendChild(o);
      });
      sel.appendChild(frag);
    });

    /* Ano: só dígitos, no máximo 4 */
    form.querySelectorAll('[data-mascara="ano"]').forEach(function (input) {
      input.addEventListener('input', function () {
        input.value = input.value.replace(/\D/g, '').slice(0, 4);
      });
    });

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

      /* A resposta leva alguns segundos (card e WhatsApp). O botão já não
         aceita clique nesse tempo, mas Enter num campo enviaria de novo:
         seria um segundo card e uma segunda mensagem para a pessoa. */
      if (botao && botao.getAttribute('data-carregando') === 'true') return;

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

    /* Tudo o que o formulário tem, mais a origem do clique (UTM e gclid)
       e a isca para robô. O servidor decide o que vai ao CRM. */
    var corpo = {};
    new FormData(form).forEach(function (valor, nome) {
      if (typeof valor === 'string') corpo[nome] = valor;
    });
    corpo.attribution = (window.sdAttr ? window.sdAttr() : {}) || {};

    /* O texto de sucesso tem duas versões: a mensagem automática está a
       caminho do WhatsApp da pessoa, ou a equipe vai chamar em seguida
       (telefone sem código de país conhecido, ou lead na fila do servidor). */
    function concluir(ok, whatsapp) {
      if (botao) botao.removeAttribute('data-carregando');
      if (ok && sucesso) {
        var versao = whatsapp === 'automatico' ? 'automatico' : 'depois';
        sucesso.querySelectorAll('[data-whatsapp]').forEach(function (el) {
          el.hidden = el.getAttribute('data-whatsapp') !== versao;
        });
      }
      var alvo = ok ? sucesso : falha;
      if (alvo) {
        alvo.setAttribute('data-visivel', 'true');
        alvo.setAttribute('role', 'status');
        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (ok) form.reset();
    }

    if (!cfg.FORM_ENDPOINT) {
      console.error('[SOS] Sem FORM_ENDPOINT — o lead não tem destino.');
      concluir(false);
      return;
    }

    /* keepalive: se a pessoa sair da página antes da resposta, o envio
       continua. Só falha de verdade (rede, servidor fora) mostra o erro,
       para a pessoa tentar de novo em vez de achar que foi. */
    fetch(cfg.FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corpo),
      keepalive: true
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          concluir(r.ok && d.ok !== false, d.whatsapp);
        });
      })
      .catch(function () { concluir(false); });
  }
})();
