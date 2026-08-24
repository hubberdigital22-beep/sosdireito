# Entrega — o que está pronto e o que falta

## Pronto

**10 páginas**, com a copy integral do documento, sem reescrita:
Início · Sobre · Tipos de Vistos · L-1A · Como Funciona · Casos de Sucesso ·
Perguntas Frequentes · Blog (+6 posts) · Contato · Calculadora.
Mais `404.html` e `styleguide.html`.

**Verificado na entrega:**

| Verificação | Resultado |
|---|---|
| Termos proibidos (advocacia / jurídico / advogado) | só a negação legítima na FAQ |
| Disclaimer no rodapé | 18/18 páginas |
| Disclaimer junto ao botão de envio | Contato e Calculadora |
| Valores em dólar fora da Calculadora | nenhum |
| Datas completas no corpo dos posts | nenhuma, só o ano |
| Title e meta description × PDF | 8/8 idênticos, palavra por palavra |
| Links internos quebrados | 0 |
| Overflow horizontal (13 páginas × 6 larguras) | 0 de 78 |
| Cobertura de acentos nas fontes | completa nas duas |
| Totais da Calculadora × site atual (80 combinações) | 80/80 idênticos |
| Acessibilidade (h1, headings, ARIA, labels, alt) | limpo nas 11 páginas |
| Contraste WCAG AA (11 páginas, todo texto) | 0 falhas |
| Sem JavaScript | conteúdo legível |
| `prefers-reduced-motion` | GSAP inativo, conteúdo visível |
| Dados estruturados | FAQPage (23), BreadcrumbList, Article ×6, ProfessionalService |

---

## Precisa de vocês

### Assets
- ✅ **Logo** — integrado. Três formas (horizontal no cabeçalho, vertical no
  rodapé, monograma disponível), todas em `currentColor`.
- ✅ **Tipografia** — Roses Bolero e Sweet Sans Pro instaladas, convertidas
  para WOFF2 com subset.
- **Fotos e vídeos dos Casos de Sucesso.** O mural está montado com 9 cards e
  os textos do banco de feedback do documento; falta a mídia. Ao enviar,
  indicar quem é pessoa pública (essas são identificadas pelo nome; cliente
  comum fica sem identificação, conforme o documento).
  Para os vídeos: legenda individual por vídeo, combinando com a cena — nunca
  o mesmo texto padrão em todos.
- **Fotografia de skyline ou ambiente executivo**, se já houver licenciada.
- **Pesos Regular e Bold da Sweet Sans Pro**, se o Pedro tiver — ver a seção
  de tipografia abaixo.

### Decisões
- **Frase da Diana para o Sobre.** A página está construída em torno de uma
  citação grande, no lugar que normalmente seria de um retrato. Hoje usa a
  sugestão do próprio documento ("Nunca fiz marketing na vida..."). Se houver
  uma frase real dela, é só trocar.
- **Endpoint do formulário de contato.**
- **Licença webfont.** Os arquivos vieram como `.otf`/`.ttf` de desktop e
  foram convertidos para WOFF2 para uso no site. Os bits de embedding das duas
  permitem (`fsType` 4 na Roses Bolero, 0 na Sweet Sans), mas famílias
  comerciais costumam vender a licença web separada da desktop. Vale conferir
  o contrato de compra antes de publicar.

---

## Correção: título fora do documento, azul em seção inteira

Duas correções de fidelidade ao documento, feitas depois de reler o
direcionamento com atenção redobrada nesses dois pontos.

**Título de página volta pra Roses Bolero.** A rodada anterior desta sessão
tinha movido TODO o texto do site pra Sweet Sans, inclusive h1 e h2 —
decisão minha, baseada num problema real de legibilidade que encontrei, mas
que ultrapassou o que o documento pede. Reli a pág. 3: *"a tipografia do
logo é a Roses Bolero. A fonte de corpo de texto do site (parágrafos, blog,
FAQ) fica a critério do Pedro definir"* — a fonte secundária é escopada
nominalmente a **corpo de texto**, não a título. Título de página não é
corpo de texto. Reverti: h1 e h2 (títulos reais de página e seção) usam
Roses Bolero; h3, h4 e títulos de componente (card, etapa, post, accordion)
seguem em Sweet Sans, mas agora por um motivo diferente — não é preferência
de leitura, é que nesses tamanhos (14–22px) o traço capilar da Roses Bolero
perde legibilidade real. Testei nas 12 páginas: h1 e h2 semânticos batem
Roses Bolero em todo lugar, títulos de componente seguem Sweet Sans.

**Azul-tinta sai de seção inteira, vira bloco contido.** A pág. 3 diz:
*"Azul-tinta ... Secundária, **blocos institucionais**, nunca como cor
principal"* — "blocos", não "seções". Eu tinha dois lugares com
`.secao--azul` ocupando a largura inteira da viewport:

- **L-1A Bloco 5** — o documento pede *"fundo azul-tinta em vez de
  marfim"* aqui, então a cor está certa, só o alcance dela estava errado.
  Virou um painel arredondado, contido dentro do container, com marfim
  visível nas bordas — mesmo padrão que o componente `.faixa` já usava
  corretamente em "Mais do que o visto" (Home) e "Assessoria Tributária"
  (Vistos).
- **Fechamento do Sobre ("O que nos guia")** — aqui o azul era invenção
  minha, o documento não pede cor nenhuma nesse bloco. Voltou a ser
  `marfim2`, o tom de alternância já usado no resto do site.

Depois da correção, `.secao--azul` não aparece mais como fundo de seção em
lugar nenhum do site — só como painel contido ou componente pequeno
(swatch da paleta, nota, badge).

---

## Por que título pequeno não usa Roses Bolero

Registro histórico: na primeira integração das fontes, o site ficou com o
título de página lendo fraco. Investiguei e o problema não era cor — o
contraste medido era 12:1, passa em AA com folga. É **óptico**: a Roses
Bolero é uma fonte de logotipo, de traço capilar, e em tamanho pequeno ela
cobre pouca área — o olho lê como apagada mesmo em vinho profundo.

Cheguei a mover TODO o texto do site pra Sweet Sans por causa disso,
inclusive títulos — foi longe demais e voltei atrás (ver correção acima).
O que sobrevive dessa investigação, e que continua valendo: a citação da
Diana no Sobre e o Bloco 1 do L-1A, quando testados em Roses Bolero,
perdiam visualmente para o texto corrido ao lado — não são headings
semânticos, são momentos narrativos à parte, e ficaram deliberadamente em
Sweet Sans por essa razão específica, não por regra geral de título.

A classe `.em-display` fica disponível em `base.css` para qualquer novo
momento em Roses Bolero fora de heading.

---

## A ilustração que não era da marca

Havia um círculo com um "S" dentro aparecendo como marca d'água de fundo em
sete páginas. **Era uma forma que eu desenhei na Fase 0**, antes dos assets
chegarem, como placeholder — e ela ficou para trás quando o material real
entrou. Você tinha razão: não tinha nada a ver com a identidade.

Agora a marca d'água usa o **monograma real** (`logo-monograma.svg`), em
opacidade ~5%, sangrando pela borda para não sentar atrás do texto. O arquivo
inventado foi apagado do projeto e o símbolo correspondente saiu do sprite de
ícones.

---

## O que as fontes trouxeram de restrição

Duas coisas apareceram ao integrar os arquivos. Nenhuma bloqueia nada — o
sistema foi desenhado em volta delas — mas você precisa saber.

### 1. Não veio nenhum peso negrito

A Sweet Sans Pro chegou só em **Thin (200)** e **Medium (500)**. Não há
Regular nem Bold. Na prática, pedir `font-weight: 700` no CSS não produz
negrito: o navegador entrega o Medium.

Deixei o negrito sintético desligado de propósito (`font-synthesis: none`) —
ele funciona borrando o contorno, e numa geométrica fina o resultado é feio.
A hierarquia do site passou a vir de **tamanho, cor, entrelinha e caixa alta
com tracking**, que é como uma família geométrica costuma ser usada mesmo.

Os pesos estão atrás de tokens (`--peso-fino`, `--peso-corpo`,
`--peso-display`), então **se o Pedro tiver os pesos Regular e Bold, é só
mandar**: eu adiciono dois `@font-face` e o sistema inteiro absorve, sem
refazer nada.

### 2. Nenhuma das duas tem itálico

O documento pede a citação da Diana "em itálico". Como não existe itálico
real em nenhuma das duas fontes, a alternativa seria o navegador inclinar o
desenho artificialmente — evitei isso, é uma distorção visível em qualquer
tipografia.

**O que fiz:** a citação ficou em caixa reta, em vinho e em corpo grande
(tamanho de h2), com um filete acima. Está em Sweet Sans, não em Roses
Bolero — testei as duas: em Roses Bolero ela perdia peso visual para o
texto corrido ao lado, e o documento pede que a citação seja o elemento
dominante da página, no lugar que seria de um retrato. O mesmo vale para os
depoimentos dos Casos de Sucesso, onde as aspas fazem o trabalho de
sinalizar "isto é uma fala".

Se preferirem tentar a Roses Bolero aqui mesmo assim, é trocar uma linha
em `assets/css/components.css` (`.citacao__texto`) — mas recomendo ver
antes como está.

---

## Sobre a cor do logo

Os arquivos entregues usam **#65010e** (vinho) e **#f7efe7** (marfim). A paleta
aprovada no documento de direcionamento é **#570615** e **#f4eee7**. São
valores próximos, mas diferentes.

Converti os três SVGs para `fill="currentColor"`, então **a cor do logo no
site vem do CSS e é sempre a da paleta aprovada**. Isso mantém tudo coerente e
tem um bônus: uma forma só serve para qualquer fundo, em vez de três arquivos
por lockup.

Vale só confirmar com o Pedro qual dos dois pares é o oficial, para os
criativos não saírem de um jeito e o site de outro.

### Validações antes de publicar
- **Post 5 do blog** ("Suspensão de vistos de imigrante em 2026") precisa da
  validação técnica da Diana, como o documento exige. Os 6 posts estão como
  rascunho, com `noindex`, e fora do sitemap até a liberação editorial.

---

## Ponto de atenção na Calculadora

Encontrei uma **inconsistência herdada do site atual** que vale a Diana decidir.

No cálculo de ajuste de status das categorias EB-1A e EB-1C, a calculadora em
produção cobra **USD 2.400,00 por menor de 14 anos**. Mas a tabela de taxas
exibida na mesma página soma **USD 2.140,00**:

```
I-485 (menor de 14)   950,00
I-765                 260,00
I-131                 630,00
Taxa de Asilo         300,00
                    ─────────
                    2.140,00
```

Ou seja, o total estimado e a tabela logo abaixo discordam em USD 260,00 por
criança.

**O que fiz:** mantive **2.400,00**, para que os totais batam exatamente com os
da calculadora atual — foi o que a Opção B pediu. A divergência está anotada em
`assets/js/data/taxas.js`, no campo `ajusteEB1`.

**O que precisa acontecer:** a Diana define qual dos dois é o valor correto.
Depois disso, é uma linha em `taxas.js`:

```js
ajusteEB1: {
  adulto: 2630,
  crianca: 2400,              // ← trocar para 2140 se a tabela estiver certa
  criancaConformeTabela: 2140
}
```

Enquanto não houver decisão, o site continua se comportando exatamente como o
atual.

---

## Diferença deliberada em relação ao site atual

Um texto do disclaimer da calculadora antiga dizia que o ajuste de status pode
ser "contratado junto ao **escritório**". Troquei por "contratado junto à
**assessoria**", porque a regra de compliance nº 1 do documento proíbe esse
termo no site inteiro. É a única alteração de conteúdo que fiz em relação ao
original — todo o resto foi replicado.

---

## Uma armadilha do material, para registro

O print de referência da timeline (pág. 17 do PDF) traz "Validação da advogada".
A copy oficial do documento reescreveu isso como **"Etapa 1 — Validação com a
nossa equipe"**, e foi essa que usei. Se alguém for comparar o site com os
prints de referência, é esperado que difiram nesse ponto.
