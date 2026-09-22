"""
Catálogo LEGÍVEL POR MÁQUINA da pasta `datasets/` (fora do repositório).

Por que existe: o catálogo do dono (`datasets/README.md`) é prosa — boa para
ler, inútil para o app perguntar "esta pasta tem licença conhecida?". Este
script varre as pastas de primeiro nível e grava, para cada uma, o que dá para
SABER olhando o disco (formato, contagens, DPI declarado nos cabeçalhos) e o
que dá para LER da prosa (cultura, origem, licença, citação, uso). Cada campo
lido de texto vem com `fonteDoCampo` dizendo de onde saiu — "README" (a prosa
do dono), "pasta" (um arquivo dentro da própria pasta: README.dataset.txt,
LICENSE, data.yaml, *_Citation_Request.txt) ou "heuristica" (deduzido do nome
ou da estrutura) — para ninguém confundir o que foi lido com o que foi chutado.

Regras que valem aqui:
- Só stdlib. Não abre imagem inteira: lê cabeçalhos (TIFF tag 282/296, PNG
  pHYs, JFIF/Exif, BMP) em até 5 arquivos por pasta, espalhados pela lista.
- `formatoDetectado` espelha `src/lib/datasets/formato.ts` (mesmos regex,
  mesma ordem) para dizer o que o APP vai reconhecer ao abrir `datasets/`.
  Fora da tabela do app entram só `tabular` (planilha sem imagem) e
  `desconhecido` (nada reconhecível).
- Licença NÃO é gate (decisão antiga do dono): é registro, e "desconhecida"
  é valor válido. `podeSerReferenciado` é true só quando origem E licença
  foram lidas (nunca deduzidas).
- Nome de pessoa que não é autor conhecido não entra no JSON: para as pastas
  do laboratório, nomes de subpasta são omitidos de propósito (alguém nomeia
  a pasta com o próprio nome, e o JSON vai para o repositório).
- Idempotente: sem data de geração, entradas em ordem de nome, chaves em
  ordem fixa. Rodar duas vezes dá o mesmo arquivo.

Uso:
  python scripts/gerar-catalogo-de-datasets.py [pasta datasets]
Saída:
  <datasets>/catalogo.json  e  public/exemplos/catalogo-de-datasets.json
"""
from __future__ import annotations

import json
import os
import re
import struct
import sys
import time
from pathlib import Path

RAIZ = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "datasets"
REPO = Path(__file__).resolve().parents[1]
SAIDA_DATASETS = RAIZ / "catalogo.json"
SAIDA_PUBLIC = REPO / "public" / "exemplos" / "catalogo-de-datasets.json"
README_DO_DONO = RAIZ / "README.md"
README_DOS_DOCS = REPO / "docs" / "datasets" / "README.md"

EXT_IMAGEM = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"}
EXT_TABELA = {".csv", ".xlsx", ".xls", ".arff"}
# Lixo de sincronização de nuvem: não é dado, não conta como "outros".
IGNORAR = {"desktop.ini", "thumbs.db", ".ds_store"}
AMOSTRA_DPI = 5

# Pastas do laboratório/doutorado: origem conhecida por quem trabalha aqui, mas
# sem licença escrita — e com subpastas que às vezes levam nome de gente.
PASTAS_DE_DOUTORADO = {"nelson_phd_images_orquid_enrico"}
PASTAS_DE_LABORATORIO = {
    "images", "mayara_images", "Orq_lab_semente", "orquid_mayara_10especies",
    "Mayara_DOC_Qualificacao_TZ_ORQ",
}

CHAVES_DE_CULTURA = [
    # (regex sobre nome da pasta + texto do README, chave)
    (r"orq|orchid|cattleya|epidendrum", "orquidea"),
    (r"soy|soja|glycine", "soja"),
    (r"wheat|trigo|durum|triticum", "trigo"),
    (r"\brice\b|arroz|oryza", "arroz"),
    (r"maize|milho|zea", "milho"),
    (r"coffee|caf[eé]", "cafe"),
    (r"peanut|amendoim|arachis", "amendoim"),
    (r"dry.?bean|feij[aã]o", "feijao"),
    (r"pumpkin|ab[oó]bora", "abobora"),
    (r"seed dataset|lzupsd|esp[eé]cies|seeds", "varias"),
]


# --- Varredura do disco --------------------------------------------------------

def varrer(pasta: Path):
    """Lista caminhos relativos (com `/`), tamanho total e contagem por extensão.

    `os.scandir` recursivo e `entry.stat()`: no Windows o stat vem da própria
    listagem do diretório, então 140 mil arquivos custam segundos, não minutos.
    """
    caminhos: list[str] = []
    por_ext: dict[str, int] = {}
    total = 0
    pilha = [pasta]
    while pilha:
        atual = pilha.pop()
        try:
            with os.scandir(atual) as it:
                for e in it:
                    if e.is_dir(follow_symlinks=False):
                        pilha.append(Path(e.path))
                        continue
                    if e.name.lower() in IGNORAR:
                        continue
                    try:
                        total += e.stat(follow_symlinks=False).st_size
                    except OSError:
                        pass
                    rel = os.path.relpath(e.path, pasta).replace("\\", "/")
                    caminhos.append(rel)
                    ext = os.path.splitext(e.name)[1].lower()
                    por_ext[ext] = por_ext.get(ext, 0) + 1
        except OSError:
            continue
    caminhos.sort()
    return caminhos, total, por_ext


def eh_imagem(c: str) -> bool:
    return os.path.splitext(c)[1].lower() in EXT_IMAGEM


# --- Espelho de src/lib/datasets/formato.ts ------------------------------------

def classes_por_pasta(caminhos: list[str]):
    """Espelho de `pasta-por-classe.ts`: raiz/<classe>/<imagem>, ≥ 2 subpastas, sem imagem solta."""
    por_classe: dict[str, list[str]] = {}
    imagem_na_raiz = False
    for c in caminhos:
        if not eh_imagem(c):
            continue
        partes = c.split("/")
        if len(partes) < 2:
            imagem_na_raiz = True
            continue
        por_classe.setdefault(partes[0], []).append(c)
    if imagem_na_raiz or len(por_classe) < 2:
        return None
    return por_classe


def reconhecer_formato(caminhos: list[str]):
    """Mesma ordem e mesmos regex de `reconhecerFormato` (formato.ts)."""
    data_yaml = [c for c in caminhos if re.search(r"(^|/)data\.ya?ml$", c, re.I)]
    if data_yaml:
        imagens = sorted(c for c in caminhos if re.search(r"/images/", c) and eh_imagem(c))
        labels = [c for c in caminhos if re.search(r"/labels/", c) and re.search(r"\.txt$", c, re.I)]
        return "yolo", imagens, data_yaml + labels, []
    classes_csv = [c for c in caminhos if re.search(r"(^|/)_classes\.csv$", c, re.I)]
    if classes_csv:
        return "roboflow-multiclass", sorted(c for c in caminhos if eh_imagem(c)), sorted(classes_csv), []
    tem_scanned = any(re.search(r"(^|/)Scanned_[^/]*/", c, re.I) for c in caminhos)
    tem_seg = any(re.search(r"(^|/)Segmented_[^/]*/seed/", c, re.I) for c in caminhos)
    if tem_scanned and tem_seg:
        imagens = sorted(c for c in caminhos if re.search(r"(^|/)Scanned_[^/]*/", c, re.I) and eh_imagem(c))
        anot = sorted(c for c in caminhos if re.search(r"(^|/)Segmented_[^/]*/seed/", c, re.I) and eh_imagem(c))
        return "mascara-de-instancia", imagens, anot, []
    tem_images = any(re.search(r"(^|/)images/", c, re.I) for c in caminhos)
    tem_masks = any(re.search(r"(^|/)masks?/", c, re.I) for c in caminhos)
    if tem_images and tem_masks:
        imagens = sorted(c for c in caminhos if re.search(r"(^|/)images/", c, re.I) and eh_imagem(c))
        anot = sorted(c for c in caminhos if re.search(r"(^|/)masks?/", c, re.I) and eh_imagem(c))
        return "mascara-binaria", imagens, anot, []
    por_classe = classes_por_pasta(caminhos)
    if por_classe:
        imagens = sorted(x for xs in por_classe.values() for x in xs)
        return "pasta-por-classe", imagens, [], sorted(por_classe.keys())
    return "solto", sorted(c for c in caminhos if eh_imagem(c)), [], []


# --- Cabeçalhos de imagem (DPI declarado) sem abrir a imagem ---------------------

def _ler(f, n: int) -> bytes:
    b = f.read(n)
    if len(b) != n:
        raise EOFError
    return b


def _ifd_tiff(f, base: int, ordem: str, offset_ifd: int):
    """Lê UM IFD e devolve {tag: valor} para os tags de resolução, mais o offset do próximo IFD."""
    f.seek(base + offset_ifd)
    (n,) = struct.unpack(ordem + "H", _ler(f, 2))
    entradas = _ler(f, 12 * n)
    (proximo,) = struct.unpack(ordem + "I", _ler(f, 4))
    tags: dict[int, float] = {}
    for i in range(n):
        tag, tipo, cont, val = struct.unpack(ordem + "HHII", entradas[12 * i: 12 * i + 12])
        if tag in (282, 283) and tipo == 5 and cont >= 1:
            f.seek(base + val)
            num, den = struct.unpack(ordem + "II", _ler(f, 8))
            tags[tag] = num / den if den else 0.0
        elif tag == 296 and tipo == 3:
            # SHORT cabe nos 4 bytes do campo, alinhado à esquerda na ordem do arquivo.
            tags[tag] = struct.unpack(ordem + "H", struct.pack(ordem + "I", val)[:2])[0]
    return tags, proximo


def dpi_de_tiff_em(f, base: int):
    """Resolução e número de páginas de um TIFF (arquivo ou bloco Exif em `base`)."""
    f.seek(base)
    cab = _ler(f, 4)
    ordem = "<" if cab[:2] == b"II" else ">" if cab[:2] == b"MM" else None
    if ordem is None:
        return None, 0
    (offset,) = struct.unpack(ordem + "I", _ler(f, 4))
    tags, proximo = _ifd_tiff(f, base, ordem, offset)
    paginas = 1
    # Contar páginas seguindo a cadeia de IFDs — só seeks, nunca pixels.
    visitados = {offset}
    while proximo and proximo not in visitados and paginas < 10_000:
        visitados.add(proximo)
        paginas += 1
        try:
            _, proximo = _ifd_tiff(f, base, ordem, proximo)
        except (EOFError, struct.error):
            break
    x = tags.get(282)
    if not x:
        return None, paginas
    unidade = tags.get(296, 2)
    if unidade == 3:
        x *= 2.54
    elif unidade == 1:
        return None, paginas  # "sem unidade": número sem significado físico
    return x, paginas


def dpi_declarado(caminho: Path):
    """DPI que o ARQUIVO declara (declaração, não medida) e páginas quando TIFF. None se não há."""
    try:
        with open(caminho, "rb") as f:
            assinatura = _ler(f, 8)
            f.seek(0)
            if assinatura[:2] in (b"II", b"MM"):
                return dpi_de_tiff_em(f, 0)
            if assinatura == b"\x89PNG\r\n\x1a\n":
                f.seek(8)
                while True:
                    tam, tipo = struct.unpack(">I4s", _ler(f, 8))
                    if tipo == b"pHYs":
                        px, py, unidade = struct.unpack(">IIB", _ler(f, 9))
                        return (px * 0.0254 if unidade == 1 else None), 1
                    if tipo in (b"IDAT", b"IEND"):
                        return None, 1
                    f.seek(tam + 4, 1)
            if assinatura[:2] == b"\xff\xd8":
                f.seek(2)
                jfif = None
                while True:
                    marcador = _ler(f, 2)
                    if marcador[0] != 0xFF:
                        break
                    m = marcador[1]
                    if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7:
                        continue
                    (tam,) = struct.unpack(">H", _ler(f, 2))
                    inicio = f.tell()
                    if m == 0xDA or m == 0xD9:
                        break
                    if m == 0xE0:
                        seg = _ler(f, min(tam - 2, 14))
                        if seg[:5] == b"JFIF\x00" and len(seg) >= 12:
                            unidade, xd = seg[7], struct.unpack(">H", seg[8:10])[0]
                            if unidade == 1 and xd:
                                jfif = float(xd)
                            elif unidade == 2 and xd:
                                jfif = xd * 2.54
                    elif m == 0xE1:
                        seg = _ler(f, 6)
                        if seg == b"Exif\x00\x00":
                            base = f.tell()
                            try:
                                x, _ = dpi_de_tiff_em(f, base)
                                if x:
                                    return x, 1
                            except (EOFError, struct.error):
                                pass
                    f.seek(inicio + tam - 2)
                return jfif, 1
            if assinatura[:2] == b"BM":
                f.seek(38)
                (ppm,) = struct.unpack("<i", _ler(f, 4))
                return (ppm * 0.0254 if ppm > 0 else None), 1
    except (OSError, EOFError, struct.error):
        return None, 0
    return None, 0


def amostrar_dpi(pasta: Path, imagens: list[str]):
    """Até AMOSTRA_DPI imagens espalhadas pela lista ordenada — pega subpastas diferentes, sem sortear."""
    if not imagens:
        return None
    n = len(imagens)
    indices = sorted({round(i * (n - 1) / max(1, AMOSTRA_DPI - 1)) for i in range(min(AMOSTRA_DPI, n))})
    valores: dict[str, int] = {}
    paginas_max = 0
    amostradas = 0
    for i in indices:
        dpi, paginas = dpi_declarado(pasta / imagens[i])
        amostradas += 1
        paginas_max = max(paginas_max, paginas)
        chave = "sem" if dpi is None else str(int(round(dpi)))
        valores[chave] = valores.get(chave, 0) + 1
    saida = {"amostradas": amostradas, "valores": dict(sorted(valores.items()))}
    if paginas_max > 1:
        saida["paginasNoTiff"] = paginas_max
    return saida


# --- Leitura da prosa: README do dono e README dos docs -------------------------

def limpar_md(s: str) -> str:
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)  # [texto](url) → texto
    s = s.replace("**", "").replace("`", "")
    s = re.sub(r"(?<!\w)\*([^*]+)\*(?!\w)", r"\1", s)  # *itálico*
    return re.sub(r"\s+", " ", s).strip()


def urls_em(s: str) -> list[str]:
    achadas = re.findall(r"https?://[^\s)\]>]+", s)
    dois = [f"https://doi.org/{d}" for d in re.findall(r"\bDOI:\s*([0-9.]+/[^\s)\]]+)", s, re.I)]
    saida: list[str] = []
    for u in achadas + dois:
        u = u.rstrip(".,;")
        if u not in saida:
            saida.append(u)
    return saida


def ler_readme_do_dono(texto: str):
    """Tabela da seção 1 (por nome de pasta) + blocos da seção 2 + bullets da 3.2."""
    tabela: dict[str, dict] = {}
    for linha in texto.splitlines():
        m = re.match(r"^\|\s*\[`([^`]+)`\]\([^)]*\)([^|]*)\|(.*)\|\s*$", linha)
        if not m:
            continue
        nome = m.group(1).strip().rstrip("/")
        celulas = [limpar_md(c) for c in m.group(3).split("|")]
        if len(celulas) < 4:
            continue
        tabela[nome] = {
            "cultura": celulas[0],
            "formato": celulas[1],
            "quantidade": celulas[2],
            "uso": celulas[3],
        }

    blocos: dict[str, dict] = {}
    secao = re.split(r"^###\s+", texto, flags=re.M)
    for b in secao[1:]:
        titulo, _, corpo = b.partition("\n")
        if not re.match(r"2\.\d", titulo):
            continue
        nomes = re.findall(r"`([^`]+)`", titulo)
        if not nomes:
            continue
        origem = None
        m = re.search(r"\*\*Origem\*\*:\s*(.+)", corpo)
        if m:
            origem = limpar_md(m.group(1))
        artigo = None
        m = re.search(r"\*\*Artigo\*\*:\s*(.+)", corpo)
        if m:
            artigo = limpar_md(m.group(1))
        urls = urls_em(corpo)
        for i, nome in enumerate(nomes):
            url = urls[i] if len(urls) == len(nomes) else (urls[0] if len(urls) == 1 else None)
            # Bloco que descreve DUAS pastas (2.7: os dois cafés) tem uma frase de
            # origem para as duas; a URL casada pela ordem é o que distingue cada uma.
            blocos[nome] = {"origem": url if (len(nomes) > 1 and url) else origem,
                            "artigo": artigo, "url": url, "texto": limpar_md(corpo)}

    kaggle_baixados: set[str] = set()
    em_32 = re.search(r"### 3\.2(.*?)(?=^---|^## )", texto, re.S | re.M)
    if em_32:
        for nome in re.findall(r"✅\s*\*\*\[`([^`]+)`\]", em_32.group(1)):
            kaggle_baixados.add(nome)
    return tabela, blocos, kaggle_baixados


def ler_readme_dos_docs(texto: str):
    """docs/datasets/README.md: tabela da seção 3 ('Origem & Licença') e o `**Origem:** url` dos blocos da seção 2."""
    saida: dict[str, dict] = {}
    for b in re.split(r"^###\s+", texto, flags=re.M)[1:]:
        m = re.search(r"\*\*Origem:\*\*\s*(https?://\S+)", b)
        if not m:
            continue
        for nome in re.findall(r"`[^`]*?([^`/]+)/?`", b):
            saida.setdefault(nome.strip(), {"licenca": None, "url": None})["url"] = m.group(1).rstrip(".,;")
    for linha in texto.splitlines():
        m = re.match(r"^\|\s*`([^`]+)`[^|]*\|(.*)\|\s*$", linha)
        if not m:
            continue
        celulas = m.group(2).split("|")
        if len(celulas) < 4:
            continue
        bruto = celulas[3]
        lic = re.search(r"\((CC[^)]*|Public Domain)\)", bruto)
        urls = urls_em(bruto)
        e = saida.setdefault(m.group(1).strip(), {"licenca": None, "url": None})
        e["licenca"] = lic.group(1).strip() if lic else e["licenca"]
        e["url"] = e["url"] or (urls[0] if urls else None)
    return saida


# --- Arquivos dentro da própria pasta -------------------------------------------

def ler_texto(p: Path, maximo: int = 200_000) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")[:maximo]
    except OSError:
        return ""


def extrair_citacao(texto: str) -> str | None:
    """Parágrafo citável depois de 'Citation Request' / 'Relevant Papers' — o que tem ano ou DOI.

    Os txt de citação não seguem um layout: às vezes a referência vem logo abaixo
    do título, às vezes depois de "See the articles…". Procura-se o primeiro
    parágrafo que pareça uma referência (ano entre parênteses ou DOI).
    """
    partes = re.split(r"(?im)^\s*(?:Citation Requests?(?:\s*/\s*Acknowledgements)?|Relevant Papers)\s*:?[ \t]*(?:\n|$)", texto)
    for trecho in partes[1:]:
        for par in re.split(r"\n\s*\n", trecho.strip()):
            par = re.sub(r"\s+", " ", par).strip()
            if re.search(r"\(20\d\d\)|https?://doi\.org", par, re.I) and len(par) > 40:
                return par
    return None


def metadados_da_pasta(pasta: Path, caminhos: list[str]):
    """O que os arquivos da pasta dizem: licença, URL, citação, classes do data.yaml."""
    saida = {"licenca": None, "url": None, "citacao": None, "classes": []}
    citacoes: list[str] = []
    # Roboflow: README.dataset.txt tem a URL e "License: X"; data.yaml tem `names` e roboflow.license.
    for c in caminhos:
        if c.lower() == "readme.dataset.txt":
            t = ler_texto(pasta / c)
            m = re.search(r"^License:\s*(.+)$", t, re.M)
            if m:
                saida["licenca"] = m.group(1).strip()
            us = urls_em(t)
            if us:
                saida["url"] = us[0]
            m = re.search(r"originally created by \[([^\]]+)\]", t)
            if m:
                citacoes.append(f"Criado por {m.group(1).strip()} (Roboflow Universe)")
        elif re.search(r"(^|/)data\.ya?ml$", c, re.I) and not saida["classes"]:
            t = ler_texto(pasta / c)
            m = re.search(r"^\s*names:\s*\[(.*)\]\s*$", t, re.M)
            if m:
                saida["classes"] = [s.strip().strip("'\"") for s in m.group(1).split(",") if s.strip()]
            m = re.search(r"^\s*license:\s*(.+)$", t, re.M)
            if m and not saida["licenca"]:
                saida["licenca"] = m.group(1).strip()
            m = re.search(r"^\s*url:\s*(\S+)$", t, re.M)
            if m and not saida["url"]:
                saida["url"] = m.group(1).strip()
        elif re.match(r"(?i)^readme(\.md|\.txt)?$", c):
            t = ler_texto(pasta / c)
            m = re.search(r"License[^\n]*?(CC[- ]BY[-A-Z ]*(?:\s*\d\.\d)?)", t, re.I)
            if m and not saida["licenca"]:
                saida["licenca"] = m.group(1).replace("--", "-").replace("%20", " ").strip()
        elif re.match(r"(?i)^licen[cs]e", os.path.basename(c)) and not saida["licenca"]:
            # O NOME do arquivo já diz a licença (LICENSE-CC-BY-NC-SA); o conteúdo confirma.
            m = re.search(r"CC[-_ ]BY[-_A-Z]*", os.path.basename(c), re.I)
            t = ler_texto(pasta / c, 4000)
            versao = re.search(r"\b(\d\.\d) International\b", t)
            if m:
                # "LICENSE-CC-BY-NC-SA" → "CC BY-NC-SA", e a versão vem do texto legal.
                curto = re.sub(r"^CC[-_ ]", "CC ", m.group(0).upper().replace("_", "-"))
                saida["licenca"] = f"{curto} {versao.group(1)}" if versao else curto
            else:
                v = re.search(r"(CC BY[-A-Z ]*\s*\d\.\d|Attribution[-\w ]* \d\.\d)", t)
                saida["licenca"] = v.group(1).strip() if v else "ver arquivo LICENSE"
        elif c.lower().endswith(".txt") and re.search(r"(?i)citation|info", os.path.basename(c)):
            # "…_Citation_Request.txt", "… Info and Citation.txt" — em qualquer nível.
            t = ler_texto(pasta / c, 40_000)
            cit = extrair_citacao(t)
            if cit and cit not in citacoes:
                citacoes.append(cit)
            us = [u for u in urls_em(t) if "doi.org" in u]
            if us and not saida["url"]:
                saida["url"] = us[0]
    if citacoes:
        saida["citacao"] = " | ".join(citacoes)
    return saida


# --- Anotações e classes --------------------------------------------------------

def descrever_anotacoes(pasta: Path, caminhos: list[str], formato: str, anotacao: list[str]):
    tipos: list[str] = []
    if formato == "yolo":
        # Caixa tem 5 números por linha; polígono tem mais. Basta olhar UM label não vazio.
        for c in anotacao:
            if c.lower().endswith(".txt"):
                linhas = [l for l in ler_texto(pasta / c, 4000).splitlines() if l.strip()]
                if linhas:
                    tipos.append("poligonos" if len(linhas[0].split()) > 5 else "caixas")
                    break
        tipos.append("classes (data.yaml)")
    elif formato == "roboflow-multiclass":
        tipos.append("classes por imagem (_classes.csv)")
    elif formato == "mascara-de-instancia":
        tipos.append("mascara de instancia (canal alfa dos recortes)")
    elif formato == "mascara-binaria":
        tipos.append("mascara binaria")
    elif formato == "pasta-por-classe":
        tipos.append("classe = nome da subpasta")
    if any(c.endswith("_segmentations.json") for c in caminhos):
        tipos.append("json de segmentacao (Orchid Seed Analyzer)")
    if any(os.path.splitext(c)[1].lower() in EXT_TABELA and "_classes.csv" not in c.lower() for c in caminhos):
        tipos.append("planilha")
    return tipos


def formato_da_subpasta(caminhos: list[str], omitir_nomes: bool):
    """Quando a raiz tem UMA subpasta e o formato só aparece dentro dela (maize/MaizeData/<var>).

    O app, ao abrir `datasets/`, vê 'solto'; ao abrir a subpasta, vê outra coisa.
    Registrar os dois evita a pergunta "por que o catálogo diz solto se tem classe?".
    """
    primeiras = sorted({c.split("/")[0] for c in caminhos if "/" in c and eh_imagem(c)})
    if any(eh_imagem(c) for c in caminhos if "/" not in c):
        return None
    splits = {"train", "valid", "val", "test"}
    if len(primeiras) == 1 or (primeiras and all(p.lower() in splits for p in primeiras)):
        subs = primeiras  # uma subpasta-mãe, ou só train/valid/test (café: train/<torra>)
    else:
        return None
    classes_uniao: list[str] = []
    formatos: set[str] = set()
    for sub in subs:
        dentro = [c[len(sub) + 1:] for c in caminhos if c.startswith(sub + "/")]
        formato, _, _, classes = reconhecer_formato(dentro)
        formatos.add(formato)
        for k in classes:
            if k not in classes_uniao:
                classes_uniao.append(k)
    if len(formatos) != 1 or "solto" in formatos:
        return None
    return {"subpasta": None if omitir_nomes else "|".join(subs), "formato": formatos.pop(),
            "classes": [] if omitir_nomes else sorted(classes_uniao)}


# --- Heurísticas ----------------------------------------------------------------

def chave_de_cultura(nome: str, texto_readme: str | None) -> str:
    """Chave curta para agrupar (a mesma família de chaves do catálogo de exemplos)."""
    alvo = f"{nome} {texto_readme or ''}".lower()
    achadas: list[str] = []
    for padrao, chave in CHAVES_DE_CULTURA:
        if re.search(padrao, alvo) and chave not in achadas:
            achadas.append(chave)
    especificas = [c for c in achadas if c != "varias"]
    if len(especificas) > 1:
        return "varias"  # "Feijão, Abóbora e Arroz": não é de UMA cultura
    return especificas[0] if especificas else (achadas[0] if achadas else "desconhecida")


ROTULO_DA_CULTURA = {
    "orquidea": "Orquídea", "soja": "Soja", "trigo": "Trigo", "arroz": "Arroz", "milho": "Milho",
    "cafe": "Café", "amendoim": "Amendoim", "feijao": "Feijão", "abobora": "Abóbora",
    "varias": "Várias espécies", "desconhecida": "desconhecida",
}


def origem_heuristica(nome: str, caminhos: list[str]):
    if nome in PASTAS_DE_DOUTORADO:
        return "doutorado"
    if nome in PASTAS_DE_LABORATORIO:
        return "laboratório"
    if re.search(r"\.v\d+(i|-release)\.", nome) or any(c.lower() == "readme.roboflow.txt" for c in caminhos):
        return "Roboflow Universe"
    return "desconhecida"


# --- Montagem -------------------------------------------------------------------

def catalogar(pasta: Path, tabela, blocos, kaggle_baixados, docs):
    nome = pasta.name
    caminhos, tamanho, por_ext = varrer(pasta)
    formato, imagens, anotacao, classes = reconhecer_formato(caminhos)
    tem_tabela = any(os.path.splitext(c)[1].lower() in EXT_TABELA for c in caminhos)
    if not imagens and formato == "solto":
        formato = "tabular" if tem_tabela else "desconhecido"

    de_lab = nome in PASTAS_DE_LABORATORIO or nome in PASTAS_DE_DOUTORADO
    da_pasta = metadados_da_pasta(pasta, caminhos)
    linha = tabela.get(nome)
    bloco = blocos.get(nome)
    no_docs = docs.get(nome)
    fonte: dict[str, str] = {}

    # cultura
    if linha and linha["cultura"]:
        cultura, fonte["cultura"] = linha["cultura"], "README"
    else:
        cultura, fonte["cultura"] = ROTULO_DA_CULTURA[chave_de_cultura(nome, None)], "heuristica"
    chave = chave_de_cultura(nome, " ".join(filter(None, [linha["cultura"] if linha else None, bloco["texto"] if bloco else None])))

    # origem + url
    url = None
    if bloco and (bloco["origem"] or bloco["artigo"]):
        origem = bloco["origem"] or bloco["artigo"]
        url = bloco["url"]
        fonte["origem"] = "README"
    elif nome in kaggle_baixados:
        origem, fonte["origem"] = "Kaggle", "README"
    elif da_pasta["url"] or da_pasta["citacao"]:
        origem = da_pasta["url"] or da_pasta["citacao"]
        fonte["origem"] = "pasta"
    elif no_docs and no_docs["url"]:
        origem, fonte["origem"] = no_docs["url"], "README"
    else:
        origem, fonte["origem"] = origem_heuristica(nome, caminhos), "heuristica"
        if de_lab:
            # Sabe-se de onde veio (é a nossa bancada); só não está escrito em lugar nenhum.
            fonte["origem"] = "heuristica"
    if not url:
        url = da_pasta["url"] or (no_docs["url"] if no_docs else None)
        if not url and bloco:
            url = bloco["url"]

    # licença — só o que está ESCRITO; senão "desconhecida"
    if da_pasta["licenca"]:
        licenca, fonte["licenca"] = da_pasta["licenca"], "pasta"
    elif no_docs and no_docs["licenca"]:
        licenca, fonte["licenca"] = no_docs["licenca"], "README"
    else:
        licenca, fonte["licenca"] = "desconhecida", "heuristica"

    # citação
    if bloco and bloco["artigo"]:
        citacao, fonte["citacao"] = bloco["artigo"], "README"
    elif da_pasta["citacao"]:
        citacao, fonte["citacao"] = da_pasta["citacao"], "pasta"
    else:
        citacao, fonte["citacao"] = None, "heuristica"

    uso = linha["uso"] if linha else None
    fonte["usoNoSeedCounter"] = "README" if uso else "heuristica"

    if not classes and da_pasta["classes"]:
        classes = da_pasta["classes"]
    if formato == "roboflow-multiclass" and not classes:
        for c in anotacao:
            cab = ler_texto(pasta / c, 4000).splitlines()
            if cab:
                classes = [s.strip() for s in cab[0].split(",")[1:] if s.strip()]
                break
    if de_lab:
        classes = []  # subpasta pode ter nome de gente; contagem sim, nome não

    contagem_img = {ext: n for ext, n in sorted(por_ext.items()) if ext in EXT_IMAGEM}
    outros = {ext or "(sem extensao)": n for ext, n in sorted(por_ext.items()) if ext not in EXT_IMAGEM}

    conhece_origem = fonte["origem"] in ("README", "pasta") and origem not in (None, "desconhecida")
    conhece_licenca = licenca != "desconhecida"

    observacoes: list[str] = []
    sub = formato_da_subpasta(caminhos, de_lab)
    if sub and sub["formato"] == formato and sub["classes"] in ([], classes):
        sub = None  # a subpasta não conta nada que a raiz já não conte
    if sub:
        observacoes.append(
            "ao abrir datasets/ o app vê '%s'; ao abrir a subpasta%s vê '%s'"
            % (formato, "" if sub["subpasta"] is None else f" '{sub['subpasta']}'", sub["formato"])
        )
    if de_lab:
        observacoes.append("nomes de subpasta omitidos de propósito (pasta do laboratório)")
    if formato == "yolo" and "viavel" in classes:
        # A ordem do treino é contra-intuitiva e já causou dois bugs; fica dita aqui também.
        observacoes.append("YOLO: índice 0 = %s, 1 = %s (ver src/lib/classe-do-modelo.ts)" % tuple(classes[:2]))

    return {
        "nome": nome,
        "caminhoRelativo": nome,
        "formatoDetectado": formato,
        "imagens": {"total": len(imagens) if formato not in ("tabular", "desconhecido") else 0,
                    "porExtensao": contagem_img},
        "outrosArquivos": outros,
        "anotacoes": descrever_anotacoes(pasta, caminhos, formato, anotacao),
        "classes": classes,
        "cultura": cultura,
        "culturaChave": chave,
        "origem": origem,
        "url": url,
        "licenca": licenca,
        "citacao": citacao,
        "podeSerReferenciado": bool(conhece_origem and conhece_licenca),
        "usoNoSeedCounter": uso,
        "segundoReadme": {"formato": linha["formato"], "quantidade": linha["quantidade"]} if linha else None,
        "tamanhoBytes": tamanho,
        "dpiDeclarado": amostrar_dpi(pasta, imagens),
        "formatoDaSubpasta": sub,
        "observacoes": observacoes,
        "fonteDoCampo": fonte,
    }


def main():
    inicio = time.time()
    # Console do Windows em cp1252 não imprime "→" nem "á"; o JSON continua UTF-8.
    sys.stdout.reconfigure(errors="replace")
    if not RAIZ.is_dir():
        sys.exit(f"pasta de datasets não encontrada: {RAIZ}")
    texto_dono = ler_texto(README_DO_DONO, 2_000_000)
    tabela, blocos, kaggle = ler_readme_do_dono(texto_dono)
    docs = ler_readme_dos_docs(ler_texto(README_DOS_DOCS, 2_000_000)) if README_DOS_DOCS.exists() else {}

    entradas = []
    for pasta in sorted((p for p in RAIZ.iterdir() if p.is_dir()), key=lambda p: p.name.lower()):
        e = catalogar(pasta, tabela, blocos, kaggle, docs)
        entradas.append(e)
        print(f"[ok] {e['nome']:45s} {e['formatoDetectado']:22s} {e['imagens']['total']:6d} img  "
              f"{e['tamanhoBytes'] / 1e9:5.2f} GB  lic={e['licenca']}  ref={e['podeSerReferenciado']}")

    catalogo = {
        "versao": 1,
        "geradoPor": "scripts/gerar-catalogo-de-datasets.py",
        "raiz": "datasets/",
        "fontes": {
            "README": ["datasets/README.md", "docs/datasets/README.md"],
            "pasta": ["README.dataset.txt", "data.yaml", "LICENSE*", "README.md", "*Citation*.txt"],
        },
        "formatos": ["yolo", "roboflow-multiclass", "mascara-de-instancia", "mascara-binaria",
                     "pasta-por-classe", "solto", "tabular", "desconhecido"],
        "entradas": entradas,
    }
    texto = json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n"
    for destino in (SAIDA_DATASETS, SAIDA_PUBLIC):
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(texto, encoding="utf-8", newline="\n")
    ref = sum(1 for e in entradas if e["podeSerReferenciado"])
    print(f"\n{len(entradas)} pastas, {ref} referenciáveis, {time.time() - inicio:.1f} s -> {SAIDA_DATASETS} e {SAIDA_PUBLIC}")


if __name__ == "__main__":
    main()
