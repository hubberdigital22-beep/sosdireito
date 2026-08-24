/* ============================================================
   SOS DIREITO — Banco de feedback dos Casos de Sucesso

   Transcrito do documento de direcionamento. A orientação é:
   observar o que a foto sugere (família, empresário, pessoa
   pública, pessoa comum) e escolher o feedback correspondente.

   Para pessoas públicas identificáveis, usa-se o nome real e,
   sempre que possível, a frase real dita por ela. Sem frase
   registrada, adapta-se uma das genéricas.

   Para VÍDEOS: assistir cada um e escrever uma legenda própria,
   que combine com o que acontece na cena. Nunca repetir o mesmo
   texto padrão em todos.

   Este arquivo é a fonte única: ao receber o banco de mídia da
   Gerusa, basta preencher `midia` em cada item de `galeria`.
   ============================================================ */
window.SOS = window.SOS || {};

window.SOS.casos = {

  /* Feedbacks genéricos, agrupados pelo que a foto sugere. */
  banco: {
    familia: [
      'Deu tudo certo pra mim e para os meus. Gratidão à SOS Direito por cada passo desse caminho.',
      'Hoje minha família está aqui graças ao cuidado da Diana e da equipe.',
      'Não tenho palavras para agradecer o que fizeram pela gente.'
    ],
    empresario: [
      'A SOS Direito entendeu exatamente o que minha empresa precisava para dar esse passo.',
      'Processo conduzido com segurança do início ao fim. Recomendo de olhos fechados.',
      'Hoje sigo expandindo meu negócio nos Estados Unidos, e tudo começou aqui.'
    ],
    pessoaComum: [
      'Graças a Deus, deu tudo certo. Muito feliz com esse resultado.',
      'Agradeço à SOS Direito por ter me auxiliado em cada etapa desse processo.',
      'Me senti mais seguro em cada decisão, sabendo que estava em boas mãos.'
    ]
  },

  /* Pessoa pública: nome sempre; frase real quando existir,
     senão uma genérica adaptada. Cliente comum nunca é identificado. */
  regraDeAutoria: {
    pessoaPublica: 'identifica com o nome',
    clienteComum: 'sem identificação'
  },

  /* A galeria publicada. `midia: null` = placeholder até o material
     chegar. Ao preencher, informar `tipo` ('imagem' | 'video'),
     `src`, `poster` (vídeos) e `alt`. */
  galeria: [
    { id: 1, perfil: 'familia',     formato: 'alto',  feedback: 0, autor: null, midia: null },
    { id: 2, perfil: 'empresario',  formato: 'baixo', feedback: 0, autor: null, midia: null },
    { id: 3, perfil: 'pessoaComum', formato: null,    feedback: 0, autor: null, midia: null },
    { id: 4, perfil: 'familia',     formato: null,    feedback: 1, autor: null, midia: null },
    { id: 5, perfil: 'empresario',  formato: 'alto',  feedback: 1, autor: null, midia: null },
    { id: 6, perfil: 'pessoaComum', formato: 'baixo', feedback: 1, autor: null, midia: null },
    { id: 7, perfil: 'familia',     formato: 'baixo', feedback: 2, autor: null, midia: null },
    { id: 8, perfil: 'empresario',  formato: null,    feedback: 2, autor: null, midia: null },
    { id: 9, perfil: 'pessoaComum', formato: 'alto',  feedback: 2, autor: null, midia: null }
  ]
};
