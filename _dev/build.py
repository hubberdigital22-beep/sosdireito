#!/usr/bin/env python3
"""
SOS Direito — gerador de páginas estáticas.

Monta cada página a partir dos partials em _dev/partials/ e das fontes em
_dev/pages/. A SAÍDA é HTML estático puro: o site publicado não depende
deste script nem de nenhum passo de build. O gerador existe só para o
cabeçalho e o rodapé não precisarem ser editados à mão em 15 arquivos.

Uso:  python3 _dev/build.py
"""
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTIALS = os.path.join(RAIZ, '_dev', 'partials')
PAGES = os.path.join(RAIZ, '_dev', 'pages')

# Chaves de navegação → o item que recebe aria-current="page"
NAV = {
    'home': 'A_HOME', 'sobre': 'A_SOBRE', 'vistos': 'A_VISTOS', 'l1a': 'A_L1A',
    'como': 'A_COMO', 'casos': 'A_CASOS', 'faq': 'A_FAQ', 'blog': 'A_BLOG',
    'contato': 'A_CONTATO',
}


def versao_assets():
    """Versão curta derivada do arquivo de asset mais recente.

    Vira ?v=<ver> nos links de CSS e JS: força o navegador a buscar o
    arquivo novo depois de cada alteração, em desenvolvimento e em
    produção. Sem isso, o cache serve CSS velho silenciosamente.
    """
    recente = 0
    for pasta, _, arquivos in os.walk(os.path.join(RAIZ, 'assets')):
        for a in arquivos:
            if a.endswith(('.css', '.js', '.svg', '.woff2')):
                recente = max(recente, os.path.getmtime(os.path.join(pasta, a)))
    return format(int(recente), 'x')


def ler(caminho):
    with open(caminho, encoding='utf-8') as f:
        return f.read()


def parse_fonte(texto):
    """Separa o bloco de metadados do conteúdo. Delimitador: uma linha '---'."""
    if '\n---\n' not in texto:
        raise ValueError('fonte sem delimitador "---"')
    cabecalho, corpo = texto.split('\n---\n', 1)
    meta = {}
    chave = None
    for linha in cabecalho.split('\n'):
        if not linha.strip():
            continue
        if linha.startswith((' ', '\t')) and chave:      # continuação
            meta[chave] += ' ' + linha.strip()
        elif ':' in linha:
            chave, valor = linha.split(':', 1)
            chave = chave.strip()
            meta[chave] = valor.strip()
    return meta, corpo


def base_de(url):
    """Prefixo relativo para os assets, conforme a profundidade da URL."""
    profundidade = len([p for p in url.strip('/').split('/') if p])
    return '../' * profundidade


def montar(meta, corpo, partials, ver):
    url = meta.get('url', '/')
    base = meta['base'] if 'base' in meta else base_de(url)

    def recuar(txt):
        # O SVG entra recuado, para o HTML final ficar legível
        return '\n'.join('      ' + l for l in txt.strip().split('\n'))

    logo_recuado = recuar(partials['logo'])
    logo_vertical_recuado = recuar(partials['logo_vertical'])
    logo_monograma_recuado = recuar(partials['logo_monograma'])

    robots = meta.get('robots', '')
    if robots:
        robots = '<meta name="robots" content="%s">' % robots

    valores = {
        'VER': ver,
        'BASE': base,
        'URL': url,
        'TITLE': meta.get('title', 'SOS Direito'),
        'DESC': meta.get('desc', ''),
        'OG_TYPE': meta.get('og_type', 'website'),
        'ROBOTS': robots,
        'BODY_ATTR': (' class="%s"' % meta['body_class']) if meta.get('body_class') else '',
        'HEAD_EXTRA': meta.get('head_extra', ''),
        'SCRIPTS_EXTRA': meta.get('scripts_extra', ''),
        'SPRITE': partials['sprite'].strip(),
        'LOGO': logo_recuado,
        'LOGO_VERTICAL': logo_vertical_recuado,
        'LOGO_MONOGRAMA': logo_monograma_recuado,
    }
    for chave in NAV.values():
        valores[chave] = ''
    ativo = meta.get('nav')
    if ativo:
        if ativo not in NAV:
            raise ValueError('nav desconhecida: %s' % ativo)
        valores[NAV[ativo]] = ' aria-current="page"'

    html = partials['head'] + partials['header'] + corpo + partials['footer']

    def troca(m):
        chave = m.group(1)
        if chave not in valores:
            raise ValueError('placeholder sem valor: {{%s}}' % chave)
        return valores[chave]

    # Em passe único, um placeholder inserido por outro (o {{VER}} que vem
    # dentro de head_extra, por exemplo) não seria substituído. Repete até
    # estabilizar, com trava contra referência circular.
    for _ in range(5):
        novo = re.sub(r'\{\{(\w+)\}\}', troca, html)
        if novo == html:
            return novo
        html = novo
    raise ValueError('placeholders não estabilizaram — referência circular?')


def main():
    partials = {
        'head': ler(os.path.join(PARTIALS, 'head.html')),
        'header': ler(os.path.join(PARTIALS, 'header.html')),
        'footer': ler(os.path.join(PARTIALS, 'footer.html')),
        'logo': ler(os.path.join(PARTIALS, 'logo.html')),
        'logo_vertical': ler(os.path.join(PARTIALS, 'logo-vertical.html')),
        'logo_monograma': ler(os.path.join(PARTIALS, 'logo-monograma.html')),
        'sprite': ler(os.path.join(RAIZ, 'assets', 'icons', 'sprite.svg')),
    }

    if not os.path.isdir(PAGES):
        print('sem _dev/pages/ — nada a gerar')
        return 0

    ver = versao_assets()
    fontes = sorted(f for f in os.listdir(PAGES) if f.endswith('.html'))
    if not fontes:
        print('sem fontes em _dev/pages/')
        return 0

    for nome in fontes:
        texto = ler(os.path.join(PAGES, nome))
        try:
            meta, corpo = parse_fonte(texto)
            html = montar(meta, corpo, partials, ver)
        except ValueError as e:
            print('ERRO em %s: %s' % (nome, e), file=sys.stderr)
            return 1

        url = meta.get('url', '/')
        if meta.get('saida'):
            destino = os.path.join(RAIZ, meta['saida'])
        elif url != '/':
            destino = os.path.join(RAIZ, url.strip('/'), 'index.html')
        else:
            destino = os.path.join(RAIZ, 'index.html')
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, 'w', encoding='utf-8') as f:
            f.write(html)
        print('  %-46s → %s' % (nome, os.path.relpath(destino, RAIZ)))

    print('\n%d páginas geradas.' % len(fontes))
    return 0


if __name__ == '__main__':
    sys.exit(main())
