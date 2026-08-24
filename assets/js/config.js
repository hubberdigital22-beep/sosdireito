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
     Trocar FORM_ENDPOINT pela URL do serviço (Formspree, Netlify,
     backend próprio). Com null, o envio é simulado e o estado de
     sucesso aparece, para o fluxo ser testável em desenvolvimento. */
  FORM_ENDPOINT: null,
  FORM_METODO: 'POST'
};
