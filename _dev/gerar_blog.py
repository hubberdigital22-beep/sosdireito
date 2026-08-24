#!/usr/bin/env python3
"""Gera as fontes do blog (índice + 6 posts) a partir de _dev/conteudo/posts.py."""
import json, os, re, sys, html

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, '_dev', 'conteudo'))
from posts import POSTS

PAGES = os.path.join(RAIZ, '_dev', 'pages')


def tempo_de_leitura(corpo):
    """Minutos, a 200 palavras por minuto, arredondando para cima."""
    texto = re.sub(r'<[^>]+>', ' ', corpo)
    palavras = len(texto.split())
    return max(1, round(palavras / 200 + 0.5))


AVISO = '''      <div class="aviso-rascunho">
        <svg aria-hidden="true" style="width:1.25rem;height:1.25rem;flex-shrink:0;color:var(--vinho)"><use href="#i-aviso"></use></svg>
        <span>
          <strong>Rascunho — não publicado.</strong>
          Texto escrito a partir do briefing e pendente de revisão editorial. A página está com
          <code>noindex</code> e não entra no sitemap até a liberação.{extra}
        </span>
      </div>
'''

EXTRA_VALIDAR = (' <strong>Este post exige validação técnica da Diana antes de ir ao ar</strong>, '
                 'conforme marcado no documento de direcionamento.')


def gerar_post(p):
    minutos = tempo_de_leitura(p['corpo'])
    ld = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": p['titulo'],
        "description": p['desc'],
        "articleSection": p['categoria'],
        "inLanguage": "pt-BR",
        "publisher": {"@type": "Organization", "name": "SOS Direito"},
        "mainEntityOfPage": "https://sosdireito.com.br/blog/%s/" % p['slug'],
    }
    aviso = AVISO.format(extra=EXTRA_VALIDAR if p['validar'] else '')

    return '''url: /blog/{slug}/
nav: blog
title: {titulo} | SOS Direito
desc: {desc}
og_type: article
robots: noindex, nofollow
head_extra: <link rel="stylesheet" href="../../assets/css/pages/blog.css?v={{{{VER}}}}">
 <script type="application/ld+json">{ld}</script>
---

<section class="secao secao--densa">
  <div class="container">
    <article class="artigo">
      <ol class="migalhas">
        <li><a href="../../">Início</a></li>
        <li><a href="../">Blog</a></li>
        <li><span aria-current="page">{categoria}</span></li>
      </ol>

{aviso}
      <header class="artigo__cabecalho">
        <div class="artigo__meta">
          <span class="selo selo--contorno">{categoria}</span>
          <span>{ano}</span>
          <span>·</span>
          <span>{minutos} min de leitura</span>
        </div>
        <h1>{titulo}</h1>
      </header>

      <div class="artigo__corpo">{corpo}
      </div>

      <footer class="artigo__rodape">
        <hr class="filete">
        <p class="texto-suave" style="font-size:var(--fs-sm)">
          SOS Direito é uma assessoria imigratória. Este conteúdo é informativo e não substitui a
          análise do seu caso.
        </p>
        <div class="acoes" style="margin-top:var(--sp-5)">
          <a class="btn" href="../../contato/">Fale com a nossa equipe</a>
          <a class="link-seta" href="../">Ver todos os posts</a>
        </div>
      </footer>
    </article>
  </div>
</section>
'''.format(slug=p['slug'], titulo=html.escape(p['titulo'], quote=False), desc=p['desc'],
           ld=json.dumps(ld, ensure_ascii=False, separators=(',', ':')),
           categoria=p['categoria'], ano=p['ano'], minutos=minutos,
           corpo=p['corpo'].rstrip(), aviso=aviso)


CATEGORIAS = ['Atualizações Regulatórias', 'Educação sobre o L-1A', 'Casos e Histórias']


def gerar_indice():
    cards = []
    for p in POSTS:
        minutos = tempo_de_leitura(p['corpo'])
        cards.append('''        <li>
          <a class="post-card" href="{slug}/">
            <div class="post-card__meta">
              <span class="selo selo--contorno">{categoria}</span>
              <span class="post-card__data">{ano} · {minutos} min de leitura</span>
            </div>
            <h2 class="post-card__titulo">{titulo}</h2>
            <p class="post-card__resumo">{resumo}</p>
            <span class="post-card__rodape"><span class="link-seta">Ler o post</span></span>
          </a>
        </li>'''.format(slug=p['slug'], categoria=p['categoria'], ano=p['ano'],
                        minutos=minutos, titulo=html.escape(p['titulo'], quote=False),
                        resumo=p['resumo']))

    chips = '\n'.join(
        '          <li><span class="selo selo--neutro">%s</span></li>' % c for c in CATEGORIAS)

    return '''url: /blog/
nav: blog
title: Blog | SOS Direito
desc: Conteúdo sobre imigração estratégica para os Estados Unidos: atualizações regulatórias, educação sobre o L-1A e histórias de quem já fez esse caminho.
head_extra: <link rel="stylesheet" href="../assets/css/pages/blog.css?v={{{{VER}}}}">
---

<section class="hero hero--interno secao--marfim">
  <div class="container">
    <div class="hero__conteudo">
      <span class="eyebrow" data-revelar>Blog</span>
      <h1 class="hero__titulo" data-revelar data-revelar-delay="0.06">
        Imigração estratégica, explicada sem atalho
      </h1>
      <p class="hero__texto" data-revelar data-revelar-delay="0.12">
        Atualizações regulatórias, educação sobre o L-1A e histórias de quem já fez esse caminho.
      </p>
      <ul class="categorias" role="list" data-revelar data-revelar-delay="0.18">
{chips}
      </ul>
    </div>
  </div>
</section>

<section class="secao secao--sem-topo">
  <div class="container">
    <p class="nota nota--neutra" style="margin-bottom:var(--sp-8)">
      <strong>Rascunhos em revisão.</strong> Os seis posts abaixo foram escritos a partir dos
      briefings e estão com <code>noindex</code> até a liberação editorial.
    </p>

    <ul class="grid grid--3 lista-posts" role="list" data-revelar="grupo">
{cards}
    </ul>
  </div>
</section>
'''.format(chips=chips, cards='\n'.join(cards))


def main():
    with open(os.path.join(PAGES, '09-blog.html'), 'w', encoding='utf-8') as f:
        f.write(gerar_indice())
    for i, p in enumerate(POSTS, 1):
        nome = '10-%d-post-%s.html' % (i, p['slug'])
        with open(os.path.join(PAGES, nome), 'w', encoding='utf-8') as f:
            f.write(gerar_post(p))
    print('blog: índice + %d posts' % len(POSTS))


if __name__ == '__main__':
    main()
