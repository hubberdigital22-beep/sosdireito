# SOS Direito — Site

Site institucional da SOS Direito, construído a partir do documento
`SOS_Direito_Direcionamento_Web_Designer.pdf` (Sthefany Fordein, agosto/2026).

**Stack:** HTML, CSS e JavaScript puros + GSAP (com ScrollTrigger).
Sem framework, sem dependência de runtime, sem passo de build para publicar.

---

## Como publicar

Suba a pasta inteira em qualquer hospedagem estática. Não há nada a compilar:
todo `index.html` no repositório é o arquivo final servido ao navegador.

Requisito único: o servidor precisa resolver `/sobre/` para `/sobre/index.html`
(comportamento padrão de Apache, Nginx, Netlify, Vercel, Cloudflare Pages e S3
com index document configurado).

Configure também a página de erro 404 para `/404.html`.

---

## Estrutura

```
/                        Início
/sobre/                  Sobre
/vistos/                 Tipos de Vistos
/vistos/l-1a/            L-1A          ← página mais importante do site
/como-funciona/          Como Funciona
/casos-de-sucesso/       Casos de Sucesso
/perguntas-frequentes/   Perguntas Frequentes
/blog/                   Blog + 6 posts em /blog/<slug>/
/contato/                Contato
/calculadora/            Calculadora   ← fora do menu, acessada só por CTA
/404.html                Erro 404
/styleguide.html         Referência interna de componentes (noindex)

assets/css/    tokens · base · layout · components · pages/*
assets/js/     vendor (GSAP) · motion · components/* · data/*
assets/fonts/  Inter self-hosted (woff2, latin + latin-ext)
assets/icons/  sprite.svg — 33 ícones lineares
assets/img/    monograma + mídia

_dev/          Fontes de autoria. NÃO é necessário para publicar.
```

---

## Onde mexer em cada coisa

| O que mudar | Arquivo |
|---|---|
| Cores, tipografia, espaçamento, sombras | `assets/css/tokens.css` |
| Arquivos de fonte | `assets/fonts/*.woff2` + `@font-face` em `tokens.css` |
| Logo | `assets/img/logo-*.svg` e `_dev/partials/logo*.html` |
| Endereço, telefone, e-mail, redes sociais | `assets/js/config.js` **e** `_dev/partials/footer.html` |
| Destino do formulário de contato | `FORM_ENDPOINT` em `assets/js/config.js` |
| Valores e taxas da calculadora | `assets/js/data/taxas.js` |
| Banco de feedback dos Casos de Sucesso | `assets/js/data/casos.js` |
| Conteúdo dos posts | `_dev/conteudo/posts.py`, depois rodar o gerador |

### Formulário de contato

O envio já está pronto: validação, máscara de telefone e estados de
carregando/erro/sucesso. Falta só o destino. Em `assets/js/config.js`:

```js
FORM_ENDPOINT: 'https://formspree.io/f/SEU_ID',   // ou o backend de vocês
```

Sem endpoint configurado, o envio é simulado e o estado de sucesso aparece —
o fluxo continua testável em desenvolvimento.

---

## Editar cabeçalho e rodapé

O site é HTML estático puro: cabeçalho e rodapé existem, iguais, em cada
arquivo. Para não editar 18 arquivos à mão, há um gerador em `_dev/`.

```bash
python3 _dev/build.py        # regenera todas as páginas
python3 _dev/gerar_blog.py   # regenera o índice e os 6 posts
```

- Fontes das páginas: `_dev/pages/*.html`
- Cabeçalho, rodapé, `<head>` e logo: `_dev/partials/`
- Conteúdo dos posts: `_dev/conteudo/posts.py`

O gerador só monta os arquivos. **O site publicado não depende dele** — se
preferir editar os `index.html` diretamente, funciona; só lembre de manter
cabeçalho e rodapé sincronizados entre as páginas.

O `?v=<hash>` nos links de CSS e JS é cache-busting, derivado da data de
modificação dos assets. Ele se atualiza sozinho a cada build.

---

## Tipografia

O briefing define dois papéis: *"a tipografia do logo é a Roses Bolero"* e
*"a fonte de corpo de texto do site (parágrafos, blog, FAQ) fica a critério
do Pedro"* — a Sweet Sans, escopada nominalmente ao texto corrido. O site
segue essa divisão à risca:

| Papel | Fonte | Pesos |
|---|---|---|
| Títulos de página e seção (h1, h2) | **Roses Bolero** | 400 (único) |
| h3, h4, títulos de componente, corpo, interface | **Sweet Sans Pro** | Thin 200, Medium 500 |
| Marca (SVG, traçado convertido) | **Roses Bolero** | — |

"Título de componente" é qualquer rótulo pequeno marcado com heading por
hierarquia de documento mas que funciona como interface, não como título de
página — card de visto, card de post, etapa da timeline, pergunta do
accordion. A lista completa de seletores está em `base.css`, junto do
motivo: nesses tamanhos (14–22px) o traço capilar da Roses Bolero perde
legibilidade real — não é preferência de leitura, é o desenho ficando
pequeno demais pro traço sobreviver. Esse limiar foi testado a 60px e a
78px antes de ser fixado.

Dois momentos NÃO seguem essa regra de heading porque não são heading: a
citação da Diana no Sobre e o Bloco 1 do L-1A (as frases isoladas em tipo
grande) usam Sweet Sans deliberadamente — testados em Roses Bolero, os dois
perdiam peso visual para o texto corrido ao lado. A classe `.em-display`
fica disponível em `base.css` para qualquer novo momento que precise da
fonte da marca fora de heading.

### A restrição de pesos

A Sweet Sans veio só com **Thin (200)** e **Medium (500)**. Não há Regular nem
Bold: pedir `font-weight: 700` no CSS entrega Medium.

O negrito sintético está desligado de propósito (`font-synthesis: none`) — ele
funciona borrando o contorno, e numa geométrica fina o resultado é feio. A
hierarquia vem de **tamanho, cor, entrelinha e caixa alta com tracking**.

Os pesos são declarados por token (`--peso-fino`, `--peso-corpo`,
`--peso-display`), nunca por número solto. **Se o Pedro tiver os pesos Regular
e Bold, é só mandar** — dois `@font-face` e o sistema absorve sem refatoração.

### Sem itálico

Nenhuma das duas famílias tem itálico real. Onde o briefing pedia itálico
(citação da Diana, depoimentos), o texto ficou em caixa reta: a distinção vem
do tamanho, da cor e das aspas. Inclinar artificialmente estragaria o desenho.

### Glifos ausentes

`→ ← ✓` não existem em nenhuma das duas. O `.link-seta` desenha a seta por
máscara SVG (token `--seta` em `tokens.css`), então ela acompanha a cor do
texto e nunca cai num fallback do sistema.

---

## Logo

Três formas, em `assets/img/`:

| Arquivo | Uso | Proporção |
|---|---|---|
| `logo-monograma.svg` | cabeçalho e marca d'água de fundo | ~2,2:1 |
| `logo-vertical.svg` | rodapé | ~1,4:1 |
| `logo-horizontal.svg` | disponível, não usado hoje | ~4,6:1 |

A **marca d'água** das seções (`.monograma-fundo`) usa o monograma real, em
opacidade ~5%, sangrando pela borda para não sentar atrás do texto. Ela também
é máscara CSS, então acompanha a cor da seção — vinho sobre marfim, marfim
sobre as seções escuras.

O logo é aplicado como **máscara CSS**, não como SVG inline:

```css
.logo__marca {
  background: currentColor;                                  /* ← a cor */
  mask: url('../img/logo-horizontal.svg') center / contain no-repeat;
}
```

Duas razões. A cor vem do CSS, então uma forma só serve para qualquer fundo
(marfim sobre vinho, vinho sobre marfim) e o logo usa sempre a paleta
aprovada. E o arquivo é buscado uma vez e fica em cache para as 18 páginas —
inline, os mesmos ~35 KB de path se repetiriam em cada HTML, somando 630 KB.

O `viewBox` de cada arquivo foi apertado na caixa real do desenho: os
originais vinham num quadro de 1920×1080 com muito vazio em volta, o que
faria o logo aparecer minúsculo dentro do próprio espaço.

Para trocar de forma, basta a classe: `.logo__marca--vertical`,
`.logo__marca--monograma`.

---

## Cor: azul-tinta nunca é fundo de seção inteira

Regra do briefing (pág. 3): *"Azul-tinta ... Secundária, **blocos
institucionais**, nunca como cor principal."* "Blocos", não "seções" — a
cor é usada em painéis contidos, nunca como fundo de página de ponta a
ponta.

Na prática: `.faixa` (painel arredondado, inset dentro do container) é o
componente certo para conteúdo institucional em azul-tinta. `.secao--azul`
existe no CSS mas não é usado como fundo de seção em nenhuma página — se
alguém precisar de um bloco institucional novo, o padrão é `.faixa`, não
`.secao--azul`. Vinho segue liberado como fundo de seção inteira (CTAs de
fechamento) — a regra restringe só o azul.

---

## Regras de compliance travadas no código

Foram verificadas na entrega e precisam continuar valendo:

1. Nunca "escritório de advocacia", "assessoria jurídica" ou "advogado".
   Sempre **assessoria imigratória**. A única ocorrência legítima é a resposta
   da FAQ que nega a pergunta.
2. O disclaimer *"SOS Direito é uma assessoria imigratória. Não prestamos
   serviços advocatícios."* está no rodapé das **18** páginas, e repetido em
   destaque junto ao botão de envio do formulário de Contato e da Calculadora.
3. **Nenhum valor em dólar** nas 9 páginas institucionais. A Calculadora é a
   única exceção, autorizada pela Diana (Opção B do documento).
4. Foto da Diana só em cards de prova social — nunca capa, nunca no Sobre.
5. Em post de blog, nunca data completa no corpo. Só o ano.
6. O formulário de dados sensíveis do site antigo (nome dos pais, histórico de
   endereço, biometria, SSN) **não existe** neste repositório, por decisão do
   documento. Ele segue como ferramenta interna.

---

## Acessibilidade e movimento

- Um `<h1>` por página, sem saltos de nível de heading.
- Accordions com `<button>`, `aria-expanded` e `aria-controls` válidos.
- Skip link, foco visível em vinho, `lang="pt-BR"`.
- **Sem JavaScript, o site continua legível.** O estado inicial escondido
  depende da classe `.js`, adicionada por um script síncrono no `<head>`.
- Com `prefers-reduced-motion: reduce`, o GSAP não é acionado e todo o
  conteúdo entra no estado final.

---

## Pendências

Ver `ENTREGA.md` para o que ainda depende de material ou decisão do cliente.
