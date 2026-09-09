/* ============================================================
   SOS DIREITO — Configuração central
   Dados institucionais e integrações ficam só aqui.
   Validados com o cliente em 19/08/2026.
   ============================================================ */
window.SOS = window.SOS || {};

window.SOS.config = {
  /* ---- Dados institucionais (validados em 19/08/2026) ---- */
  empresa: {
    nome: 'SOS Direito',
    assinatura: 'SOS Direito | Imigração Estratégica',
    endereco: '323 Sunny Isles Blvd, 7º andar, Sunny Isles, FL 33160, EUA',
    telefone: '+1 (786) 301-3817',
    telefoneLink: '+17863013817',
    email: 'info@sosdireito.com.br',
    horario: 'Segunda a sexta: 10h às 18h · Sábado e domingo: fechado',
    site: 'https://sosdireito.com.br'
  },

  /* ---- Compliance: texto obrigatório, não alterar ---- */
  disclaimer: 'SOS Direito é uma assessoria imigratória. Não prestamos serviços advocatícios.',

  /* ---- Redes sociais ---- */
  sociais: {
    instagram: 'https://www.instagram.com/sosdireito/',
    facebook: 'https://www.facebook.com/sosdireito/',
    linkedin: 'https://www.linkedin.com/company/sosdireito/'
  },

  /* ---- Formulário ----
     O destino do formulário é o WhatsApp: os campos viram uma mensagem
     pronta em wa.me, aberta no submit. Não há backend.

     ATENÇÃO: o número abaixo é de TESTE. Trocar pelo oficial antes de
     subir — é o único lugar do site onde ele aparece. */
  WHATSAPP: {
    numero: '5549988875550',
    saudacao: 'Olá! Vim pelo site da SOS Direito.'
  },

  /* Só entra em cena se WHATSAPP.numero ficar vazio. Mantido para o
     caso de o destino virar um backend no futuro. */
  FORM_ENDPOINT: null,
  FORM_METODO: 'POST'
};
