"""
Gera os exemplos REAIS embutidos no app: recortes reduzidos de cada dataset
da pasta `datasets/`, com metadados, em `public/exemplos/` + `catalogo.json`.

Por que um script e não copiar à mão: são ~90 imagens de 20 e tantos conjuntos,
e o que interessa é a REGRA de escolha (determinística: primeira por ordem de
nome, uma por classe) e a proveniência gravada junto — para qualquer um
regenerar e para o app dizer de onde cada exemplo veio.

Escala. Três situações, e o JSON diz qual é (`escalaDe`):
- "regua-medida": só `digitalizar_scan` — a régua da própria digitalização
  foi medida (docs/datasets/auditoria-de-medida.md). É o único valor MEDIDO.
- "dpi-declarado": o cabeçalho do arquivo declara um DPI (TIFF 282/296,
  JFIF/Exif) e o conjunto foi marcado para usá-lo como escala INICIAL — é
  declaração, não medida, e a nota diz isso; a régua na imagem é a conferência.
  Só vale para as digitalizações do laboratório; um PNG com "96 dpi" gravado
  por editor de imagem também declara DPI, e por isso o uso é por conjunto.
- null: sem escala; o app pede calibração.
`dpiDeclarado` é gravado em TODO exemplo cujo arquivo traz o número, mesmo
quando não vira escala — é informação, não veredito.

Nome de gente. Subpasta das pastas do laboratório às vezes leva o nome de
quem digitalizou; o JSON vai para o repositório, então essas subpastas entram
como `subpasta-N` (N = posição em ordem de nome). Reproduzível sem expor nome.

Uso:  python scripts/gerar-exemplos-reais.py [caminho da pasta datasets]
Requer: Pillow, numpy (sem OpenCV).
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # digitalizações de 6800×9359 passam do limite padrão

RAIZ = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "datasets"
SAIDA = Path(__file__).resolve().parents[1] / "public" / "exemplos"
LADO_MAX = 1024          # maior lado do exemplo; digitalização cheia não cabe no bundle
BYTES_MAX = 1_400_000    # acima disso reduz mais um degrau
EXT = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp")
# Constante, não `date.today()`: rodar duas vezes tem que dar o mesmo JSON.
GERADO_EM = "2026-09-21"

# µm/px conhecidos. Só o scanner do laboratório tem DPI declarado; o resto
# fica None e o app pede calibração. O "800–950 DPI" da soja não é um número.
UM_POR_PX_3600DPI = 25400 / 3600  # 7,0556
# digitalizar0001.jpg medido pela régua do próprio scanner (C3.2, 16/09): 1864 px
# por 10 mm → 5,365 µm/px (DPI efetivo ≈ 4735, não os 3600 declarados). Vale
# para as digitalizações "digitalizarXXXX"; para as outras do grupo o DPI não
# foi confirmado e fica sem escala.
UM_POR_PX_MEDIDO_SCAN = 10_000 / 1864.0

# Pastas cujas subpastas não entram pelo nome no JSON (ver docstring).
PASTAS_DO_LABORATORIO = {"Orq_lab_semente", "nelson_phd_images_orquid_enrico", "images", "Mayara_DOC_Qualificacao_TZ_ORQ"}
# Subpasta que pode aparecer pelo nome: só termo técnico, nunca nome de pessoa.
SUBPASTA_NEUTRA = re.compile(r"^(tz|imagens_recortadas_\w+|digitalizar_scan|test|train|valid|images|labels)$", re.I)

ORIGEM_DOUTORADO = "Prof. Nelson B. Machado Neto — GPEOrq"
ORIGEM_LABORATORIO = "laboratório — GPEOrq"
ORIGEM_ROBOFLOW_ORQ = "Roboflow Universe sementes-de-orquideas v8 (recortes 946 px feitos pelo Orchid Seed Analyzer)"


def imagens(pasta: Path):
    return sorted(p for p in pasta.rglob("*") if p.suffix.lower() in EXT and p.is_file())


def pastas_folha_com_imagens(pasta: Path):
    folhas = {}
    for p in imagens(pasta):
        folhas.setdefault(p.parent, p)  # primeira por ordem de nome
    return folhas


# --- Estratégias de escolha ---------------------------------------------------

def primeiras(pasta: Path, n: int, sub: str | None = None, padrao: str | None = None, so_raiz: bool = False):
    """As N primeiras por ordem de nome. `so_raiz` ignora subpastas — `digitalizar0001.jpg` existe em várias."""
    base = pasta / sub if sub else pasta
    xs = imagens(base)
    if so_raiz:
        xs = [p for p in xs if p.parent == base]
    if padrao:
        xs = [p for p in xs if re.search(padrao, p.name)]
    return [(p, {}) for p in xs[:n]]


def por_pasta(pasta: Path, n: int, sub: str | None = None, so: list[str] | None = None):
    base = pasta / sub if sub else pasta
    folhas = pastas_folha_com_imagens(base)
    out = []
    for dir_, p in sorted(folhas.items(), key=lambda kv: str(kv[0]).lower()):
        classe = dir_.name
        if so and classe not in so:
            continue
        out.append((p, {"classesDaImagem": [classe]}))
        if len(out) >= n:
            break
    return out


def multiclass(pasta: Path, n_por_classe: int = 1):
    """Roboflow multiclass: `<split>/_classes.csv` com `filename, c1, c2, …` one-hot."""
    out, vistos = [], {}
    for csvp in sorted(pasta.rglob("_classes.csv")):
        with open(csvp, newline="", encoding="utf-8") as f:
            linhas = list(csv.reader(f))
        cab = [c.strip() for c in linhas[0]]
        for l in linhas[1:]:
            if not l or not l[0].strip():
                continue
            nome = l[0].strip()
            classes = [cab[i] for i in range(1, len(cab)) if i < len(l) and l[i].strip() == "1"]
            # Uma imagem pode ter várias classes marcadas; ela entra UMA vez,
            # nomeada pela primeira classe ainda não coberta, e cobre todas.
            novas = [c for c in classes if vistos.get(c, 0) < n_por_classe]
            p = csvp.parent / nome
            if novas and p.exists():
                for c in classes:
                    vistos[c] = vistos.get(c, 0) + 1
                out.append((p, {"classesDaImagem": classes, "classeEscolhida": novas[0]}))
        if vistos and all(v >= n_por_classe for v in vistos.values()):
            break
    return out


def paginas_do_tiff(pasta: Path, nome: str):
    """Uma entrada por página de um TIFF de várias — a página vira o `#n` do rótulo."""
    p = pasta / nome
    if not p.exists():
        return []
    with Image.open(p) as im:
        n = getattr(im, "n_frames", 1)
    return [(p, {"pagina": i}) for i in range(n)]


def recortes_com_deteccao(pasta: Path, n_por_scan: int):
    """Os N recortes 946 px com MAIS sementes detectadas, por digitalização.

    `imagens_recortadas_analisadas/<nome>_segmentations.json` é a saída do
    Orchid Seed Analyzer e traz `counts.total`. Recorte de borda tem zero ou
    uma semente; o que interessa aqui é o caso difícil — sementes encostadas —
    e ele mora nos recortes cheios. Ordem: mais sementes primeiro, índice do
    recorte como desempate, para a escolha ser reproduzível.
    """
    analisadas = pasta / "imagens_recortadas_analisadas"
    originais = pasta / "imagens_recortadas_originais"
    candidatos = []
    for j in sorted(analisadas.glob("*_segmentations.json")):
        scan, indice = j.name.rsplit("_", 2)[0], int(j.name.rsplit("_", 2)[1])
        original = originais / f"{scan}_{indice}.png"
        if not original.exists():
            continue
        with open(j, encoding="utf-8") as f:
            d = json.load(f)
        total = int((d.get("counts") or {}).get("total", len(d.get("segmentations", []))))
        candidatos.append((scan, -total, indice, original))
    out, por_scan = [], {}
    for scan, _, _, original in sorted(candidatos):
        if por_scan.get(scan, 0) >= n_por_scan:
            continue
        por_scan[scan] = por_scan.get(scan, 0) + 1
        out.append((original, {}))
    return out


# --- Catálogo de conjuntos ----------------------------------------------------
# Cada entrada: pasta relativa a `datasets/`, escolha, e metadados que valem
# para todo exemplo do conjunto. `licenca` é registro, não gate (Enrico, 13/09).
# `escala`: "regua-medida" (umPorPixel fixo, medido), "dpi-declarado" (lê o
# cabeçalho do arquivo e usa como escala inicial) ou None (sem escala).
# `janela`: critério automático — "borda" (energia de alta frequência) ou "tz"
# (borda de mancha avermelhada sobre fundo azul, fora da régua).
# `janelas`: janela fixa por arquivo (chave = caminho como vai no JSON), para
# os casos em que o critério automático escolhe a régua ou o rótulo — olhada
# na digitalização inteira e registrada aqui para o exemplo ser reproduzível.

CONJUNTOS = [
    dict(slug="gpeorq-scan", recorte=1536, janelas={"images/digitalizar_scan/digitalizar0001.jpg": (4000, 2700), "images/digitalizar_scan/digitalizar0002.jpg": (3000, 3400)}, pasta="images/digitalizar_scan", escolha=lambda p: primeiras(p, 2, padrao=r"^digitalizar\d+\.jpg$"),
         rotulo="Orquídea — digitalização GPEOrq", cultura="orquidea", especie="Cattleya (GPEOrq)", tipo="digitalizacao",
         escala="regua-medida", umPorPixel=UM_POR_PX_MEDIDO_SCAN, notaEscala="medida pela régua da própria digitalização (1864 px / 10 mm, DPI efetivo ≈ 4735 — não os 3600 declarados; docs/datasets/auditoria-de-medida.md)",
         origem="GPEOrq / GPSEM", licenca="material do grupo", url=None,
         dica="Digitalização real de bandeja com sementes de orquídea; há régua no scanner para conferir a escala."),
    dict(slug="gpeorq-tig", recorte=1536, pasta="images", escolha=lambda p: primeiras(p, 1, padrao=r"^1_Tig1\.png$"),
         rotulo="Orquídea — Tigrina (GPEOrq)", cultura="orquidea", especie="Cattleya tigrina", tipo="digitalizacao",
         escala=None, umPorPixel=None, notaEscala="DPI não confirmado (a auditoria achou ≈ 4735 em digitalizarXXXX, não 3600); calibrar por referência",
         origem="GPEOrq / GPSEM", licenca="material do grupo", url=None, dica="Recorte de digitalização do grupo."),
    dict(slug="gpeorq-purp", recorte=1536, pasta="images", escolha=lambda p: primeiras(p, 1, padrao=r"^2_Purp1\.png$"),
         rotulo="Orquídea — Purpurata (GPEOrq)", cultura="orquidea", especie="Cattleya purpurata", tipo="digitalizacao",
         escala=None, umPorPixel=None, notaEscala="DPI não confirmado (a auditoria achou ≈ 4735 em digitalizarXXXX, não 3600); calibrar por referência",
         origem="GPEOrq / GPSEM", licenca="material do grupo", url=None, dica="Recorte de digitalização do grupo."),
    dict(slug="nelson-tz", recorte=1536, janelas={"nelson_phd_images_orquid_enrico/DFhandPSOL1.tif": (2600, 1200)}, pasta="nelson_phd_images_orquid_enrico", escolha=lambda p: primeiras(p, 2, padrao=r"\.tif$"),
         rotulo="Orquídea — tetrazólio (doutorado)", cultura="orquidea", especie="Orquídea (doutorado)", tipo="digitalizacao",
         escala="dpi-declarado", umPorPixel=None, notaEscala="DPI declarado no TIFF (3600) usado como escala inicial — declaração, não medida; confira na régua",
         origem=ORIGEM_DOUTORADO, licenca="material do grupo", url=None,
         dica="Sementes encostadas de verdade e tetrazólio real — o caso difícil."),
    # Os recortes 946 px do doutorado, exatamente como o Orchid Seed Analyzer os
    # cortou — é o "teste de fogo" de encostadas. O PNG não carrega DPI: a
    # digitalização de origem declara 3600, mas o recorte em si não diz nada.
    dict(slug="nelson-tz-recorte", pasta="nelson_phd_images_orquid_enrico", escolha=lambda p: recortes_com_deteccao(p, 5),
         rotulo="Orquídea — tetrazólio, recorte (doutorado)", cultura="orquidea", especie="Orquídea (doutorado)", tipo="recorte",
         escala=None, umPorPixel=None, notaEscala="recorte 946 px sem DPI no arquivo; a digitalização de origem declara 3600 DPI; calibrar por referência",
         origem=ORIGEM_DOUTORADO, licenca="material do grupo", url=None,
         dica="Recorte 946 px com sementes encostadas e coradas."),
    dict(slug="orquidea-roboflow", pasta="Sementes de Orquideas", escolha=lambda p: primeiras(p, 8, sub="test/images"),
         rotulo="Orquídea — Cattleya (Roboflow)", cultura="orquidea", especie="Cattleya", tipo="recorte",
         escala=None, umPorPixel=None, notaEscala="recorte 946 px do Orchid Seed Analyzer, sem DPI no arquivo; sem escala",
         origem=ORIGEM_ROBOFLOW_ORQ, licenca="CC BY 4.0", url="https://universe.roboflow.com/sementes-de-orqudea/sementes-de-orquideas",
         dica="Anotado viável/inviável por tetrazólio; é o conjunto de treino do modelo embarcado."),
    # TZ em dez espécies de orquídea: um TIFF de dez páginas, uma espécie por
    # página. O nome do arquivo não diz qual espécie é qual — então não se diz.
    dict(slug="tz-10especies", recorte=1024, janela="tz", pasta="orquid_mayara_10especies", escolha=lambda p: paginas_do_tiff(p, "10 espécies.tif"),
         rotulo="Orquídea — tetrazólio, 10 espécies", cultura="orquidea", especie=None, tipo="digitalizacao",
         escala="dpi-declarado", umPorPixel=None, notaEscala="DPI declarado no TIFF (3200) usado como escala inicial — declaração, não medida; confira na régua",
         origem=ORIGEM_LABORATORIO, licenca="material do grupo", url=None,
         dica="Uma página por espécie; lâmina sobre fundo azul, sementes coradas."),
    dict(slug="tz-lab", recorte=1536, janela="tz", janelas={"Orq_lab_semente/TZ/digitalizar0003.jpg": (9000, 1500), "Orq_lab_semente/TZ/digitalizar0005.jpg": (8000, 1400), "Orq_lab_semente/TZ/digitalizar0006.jpg": (7500, 1100)}, pasta="Orq_lab_semente", escolha=lambda p: primeiras(p, 6, sub="TZ"),
         rotulo="Orquídea — tetrazólio (laboratório)", cultura="orquidea", especie=None, tipo="digitalizacao",
         escala="dpi-declarado", umPorPixel=None, notaEscala="DPI declarado no JPEG (4800) usado como escala inicial — declaração, não medida; confira na régua",
         origem=ORIGEM_LABORATORIO, licenca="material do grupo", url=None,
         dica="Digitalização a 4800 DPI declarados, com régua na lâmina."),
    dict(slug="tz-lab-b", recorte=1536, janela="tz", janelas={"Orq_lab_semente/subpasta-3/digitalizar0001.jpg": (7000, 2500), "Orq_lab_semente/subpasta-3/digitalizar0002.jpg": (8000, 2300)}, pasta="Orq_lab_semente", escolha=lambda p: [x for sub in sorted(q for q in p.iterdir() if q.is_dir()) if re.match(r"(?i)^tz .", sub.name) for x in primeiras(sub, 2)][:4],
         rotulo="Orquídea — tetrazólio, lote B (laboratório)", cultura="orquidea", especie=None, tipo="digitalizacao",
         escala="dpi-declarado", umPorPixel=None, notaEscala="DPI declarado no JPEG (4800) usado como escala inicial — declaração, não medida; confira na régua",
         origem=ORIGEM_LABORATORIO, licenca="material do grupo", url=None,
         dica="Outro lote de lâminas coradas, mesmo scanner."),
    dict(slug="tz-lab-2400", recorte=1024, janela="tz", pasta="Orq_lab_semente", escolha=lambda p: primeiras(p, 2, padrao=r"^Lcrispa\d+\.jpg$", so_raiz=True),
         rotulo="Orquídea — tetrazólio a 2400 DPI (laboratório)", cultura="orquidea", especie=None, tipo="digitalizacao",
         escala="dpi-declarado", umPorPixel=None, notaEscala="DPI declarado no JPEG (2400) usado como escala inicial — declaração, não medida; confira na régua",
         origem=ORIGEM_LABORATORIO, licenca="material do grupo", url=None,
         dica="Mesmo teste, metade da resolução: a semente tem metade dos pixels."),
    dict(slug="soja-mendeley", recorte=3000, janelas={"Image Dataset of Local Indonesian Soybean Seed Var/Scanned_Anjasmoro/Anjasmoro/anjasmoro001.jpg": (1800, 2400), "Image Dataset of Local Indonesian Soybean Seed Var/Scanned_Dega I/Dega I/Dega001.jpg": (1800, 2400), "Image Dataset of Local Indonesian Soybean Seed Var/Scanned_Grobogan/Grobogan/Grobogan001.jpg": (1800, 2400)}, pasta="Image Dataset of Local Indonesian Soybean Seed Var", escolha=lambda p: [
             (imagens(d)[0], {"classesDaImagem": [d.name.replace("Scanned_", "").replace("_Seed", "")]})
             for d in sorted(p.glob("Scanned_*")) if imagens(d)],
         rotulo="Soja — digitalização (Mendeley)", cultura="soja", especie="Glycine max", tipo="digitalizacao",
         escala=None, umPorPixel=None, notaEscala="800–950 DPI segundo a fonte, sem valor exato; calibrar por referência",
         origem="Mendeley Data c733bjz4m3 (soja indonésia)", licenca="a conferir (Enrico)", url="https://data.mendeley.com/datasets/c733bjz4m3/3",
         dica="Sementes em grade, nunca se tocam; a fonte tem máscara de instância por semente."),
    dict(slug="trigo-yolo", pasta="seed detect.v3i.yolov8", escolha=lambda p: primeiras(p, 2, sub="train/images") or primeiras(p, 2),
         rotulo="Trigo — detecção (Roboflow)", cultura="trigo", especie="Triticum aestivum", tipo="foto",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe kyoung-do-min/seed-detect", licenca="a conferir (Enrico)",
         url="https://universe.roboflow.com/kyoung-do-min/seed-detect-nmxet", dica="Caixas YOLO; serve para contagem."),
    dict(slug="trigo-qualidade", pasta="wheat quality detection.v2i.multiclass", escolha=lambda p: multiclass(p, 1),
         rotulo="Trigo — qualidade (sadia / danificada / impureza)", cultura="trigo", especie="Triticum", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe (wheat quality detection v2)", licenca="a conferir (Enrico)", url=None,
         dica="Uma classe por foto; serve à taxonomia de classes e ao perfil por classe."),
    dict(slug="arroz-pragas", pasta="rice.v1i.multiclass", escolha=lambda p: multiclass(p, 1),
         rotulo="Arroz — pureza e pragas", cultura="arroz", especie="Oryza sativa", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe (rice v1 multiclass)", licenca="a conferir (Enrico)", url=None,
         dica="12 classes, inclui gorgulho e capim-arroz."),
    dict(slug="amendoim-mofo", pasta="peanuts.v2-release.multiclass", escolha=lambda p: multiclass(p, 1),
         rotulo="Amendoim — com / sem mofo", cultura="amendoim", especie="Arachis hypogaea", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe (peanuts v2)", licenca="a conferir (Enrico)", url=None,
         dica="Fitopatologia: mofo visível."),
    dict(slug="lzupsd", pasta="Seed dataset", escolha=lambda p: por_pasta(p, 8),
         rotulo="88 espécies — macro (LZUPSD)", cultura="varias", especie=None, tipo="macro",
         escala=None, umPorPixel=None, notaEscala="192×272 padronizado; sem escala", origem="LZUPSD — Nature Scientific Data 2024", licenca="a conferir (Enrico)",
         url="https://doi.org/10.1038/s41597-024-03176-5", dica="Forrageiras, cereais e daninhas em fundo preto; a pasta é a espécie."),
    dict(slug="milho", pasta="maize-seed-dataset", escolha=lambda p: por_pasta(p, 3),
         rotulo="Milho — 3 variedades", cultura="milho", especie="Zea mays", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Kaggle yungprof123/maize-seed-dataset", licenca="a conferir (Enrico)",
         url="https://www.kaggle.com/datasets/yungprof123/maize-seed-dataset", dica="Semente angular; a pasta é a variedade."),
    dict(slug="cafe-torra", pasta="coffee-beans-roasting", escolha=lambda p: por_pasta(p, 4),
         rotulo="Café — níveis de torra", cultura="cafe", especie="Coffea", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="224×224; sem escala", origem="Kaggle gpiosenka/coffee-bean-dataset", licenca="a conferir (Enrico)",
         url="https://www.kaggle.com/datasets/gpiosenka/coffee-bean-dataset-resized-224-x-224", dica="Colorimetria (L*a*b*) por torra."),
    dict(slug="cafe-defeitos", pasta="green-coffee-defects", escolha=lambda p: primeiras(p, 4),
         rotulo="Café verde — defeitos", cultura="cafe", especie="Coffea", tipo="macro",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Kaggle j4ckdev/green-coffee-beans-dataset", licenca="CC BY-NC-SA (arquivo LICENSE na pasta)",
         url="https://www.kaggle.com/datasets/j4ckdev/green-coffee-beans-dataset", dica="Brocado, concha, fungo, negro."),
    dict(slug="arroz-cultivares", pasta="rice-image-dataset", escolha=lambda p: por_pasta(p, 5),
         rotulo="Arroz — 5 cultivares", cultura="arroz", especie="Oryza sativa", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Kaggle (Koklu) rice-image-dataset", licenca="a conferir (Enrico)", url=None,
         dica="Arborio, Basmati, Ipsala, Jasmine, Karacadag."),
    dict(slug="soja-defeitos", pasta="soybean-defects", escolha=lambda p: por_pasta(p, 5),
         rotulo="Soja — 5 classes de integridade", cultura="soja", especie="Glycine max", tipo="foto-individual",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Kaggle soybean-defects", licenca="a conferir (Enrico)", url=None,
         dica="Broken, Immature, Intact, Skin-damaged, Spotted — candidatas a subclasse."),
    dict(slug="trigo-duro", pasta="durum-wheat-dataset", escolha=lambda p: por_pasta(p, 2),
         rotulo="Trigo duro — por variedade", cultura="trigo", especie="Triticum durum", tipo="foto",
         escala=None, umPorPixel=None, notaEscala="sem escala", origem="Kaya & Saritas (2019), Comput. Electron. Agric. 166:105016", licenca="a conferir (Enrico)", url="https://doi.org/10.1016/j.compag.2019.105016",
         dica="Alta resolução; morfologia de cariopse."),
    dict(slug="lucasiturriago", pasta="lucasiturriago-seeds", escolha=lambda p: primeiras(p, 2, padrao=r"(?i)^(?!.*mask).*\.(jpg|png)$"),
         rotulo="Sementes — máscara binária (Kaggle)", cultura="varias", especie=None, tipo="foto",
         escala=None, umPorPixel=None, notaEscala="512×512; sem escala", origem="Kaggle lucasiturriago/seeds", licenca="a conferir (Enrico)",
         url="https://www.kaggle.com/datasets/lucasiturriago/seeds", dica="Tem máscara semente × fundo (não instância)."),
    dict(slug="mayara", pasta="mayara_images", escolha=lambda p: primeiras(p, 2),
         rotulo="Bancada — foto de celular", cultura="varias", especie=None, tipo="foto",
         escala=None, umPorPixel=None, notaEscala="foto de celular; calibrar por referência", origem="GPEOrq — bancada", licenca="material do grupo", url=None,
         dica="Robustez a foto de celular."),
]


def melhor_janela(im: Image.Image, lado: int, criterio: str = "borda"):
    """Janela `lado`×`lado` (px da original) com mais conteúdo.

    Reduzir uma digitalização de 6800×9359 para 1024 px apaga a semente de
    orquídea (166 px viram 13). Para esse tipo, o exemplo é um RECORTE em
    resolução cheia — e a escala (µm/px) continua valendo.

    "borda": maior energia de alta frequência (laplaciano) numa varredura
    grossa — onde há semente, há borda em todo lugar; margem vazia não tem.
    Um rótulo escrito em fita tem contraste alto e pouca borda por área.

    "tz": mais BORDA DE MANCHA AVERMELHADA, fora da régua. Nas lâminas de
    tetrazólio o fundo é azul e a semente corada é vermelha/laranja — mas a
    franja de interferência da lamínula e a borda da régua também têm
    vermelho, em faixa contínua. Contar pixel vermelho escolhia a régua.
    Contar TRANSIÇÃO da máscara vermelha (borda por área) prefere centenas de
    manchas pequenas a uma faixa sólida; e a janela que tem mais de 15% de
    pixel CLARO (a régua é um retângulo claro; fundo, semente e caligrafia não
    são) é penalizada até zero — foi a régua, com seus traços, que ganhava.
    """
    import numpy as np
    w0, h0 = im.size
    if max(w0, h0) <= lado:
        return im, (0, 0)
    # Passo 4 numa digitalização de 15000 px; 2 numa de 6000, para a semente
    # de orquídea (≈ 20 px a 2400 DPI) não sumir na redução.
    passo = 4 if max(w0, h0) > 8000 else 2
    pequeno = im.resize((max(1, w0 // passo), max(1, h0 // passo)), Image.BILINEAR)
    claro = None
    if criterio == "tz":
        rgb = np.asarray(pequeno.convert("RGB"), dtype=np.int16)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        mascara = ((r - b > 40) & (r > g)).astype(np.float32)
        mapa = np.abs(mascara[1:, 1:] - mascara[:-1, 1:]) + np.abs(mascara[1:, 1:] - mascara[1:, :-1])
        claro = (np.minimum(np.minimum(r, g), b) > 110).astype(np.float32)[1:, 1:]
    else:
        g = np.asarray(pequeno.convert("L"), dtype=np.float32)
        mapa = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    lj = max(1, lado // passo)
    melhor, best = None, -1.0
    for y in range(0, max(1, mapa.shape[0] - lj + 1), max(1, lj // 4)):
        for x in range(0, max(1, mapa.shape[1] - lj + 1), max(1, lj // 4)):
            v = float(mapa[y:y + lj, x:x + lj].mean())
            if claro is not None:
                v *= 1.0 - min(1.0, float(claro[y:y + lj, x:x + lj].mean()) / 0.15)
            if v > best:
                best, melhor = v, (x * passo, y * passo)
    x, y = melhor
    x = min(x, w0 - lado); y = min(y, h0 - lado)
    return im.crop((x, y, x + lado, y + lado)), (x, y)


def dpi_declarado(im: Image.Image):
    """O DPI que o cabeçalho declara (Pillow lê TIFF 282/296, JFIF, Exif, pHYs). Inteiro ou None."""
    dpi = im.info.get("dpi")
    if not dpi:
        return None
    x = dpi[0] if isinstance(dpi, tuple) else dpi
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return int(round(x)) if x > 0 else None


def reduzir(p: Path, recorte: int | None = None, criterio: str = "borda", janelas: dict | None = None, pagina: int = 0):
    im = Image.open(p)
    if pagina:
        im.seek(pagina)
    dpi = dpi_declarado(im)
    im.load()
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    origem_xy = (0, 0)
    chave = caminho_para_o_json(p)
    if recorte and janelas and chave in janelas:
        # Janela escolhida à mão olhando a digitalização inteira (a heurística
        # escolhe a régua ou o rótulo quando há um): registrada no catálogo
        # de conjuntos para o exemplo ser reproduzível.
        x, y = janelas[chave]
        im = im.crop((x, y, x + recorte, y + recorte)); origem_xy = (x, y)
    elif recorte:
        im, origem_xy = melhor_janela(im, recorte, criterio)
    w0, h0 = im.size
    fator = 1.0
    lado = LADO_MAX
    while True:
        f = min(1.0, lado / max(w0, h0))
        im2 = im if f == 1.0 else im.resize((max(1, round(w0 * f)), max(1, round(h0 * f))), Image.LANCZOS)
        buf_path = SAIDA / "_tmp.png"
        im2.save(buf_path, "PNG", optimize=True)
        tam = buf_path.stat().st_size
        if tam <= BYTES_MAX or lado <= 512:
            fator = f
            break
        lado = int(lado * 0.8)
    buf_path.unlink()
    return im2, (w0, h0), fator, origem_xy, dpi


def mesmos_pixels(destino: Path, im: Image.Image) -> bool:
    """O PNG já em disco tem exatamente estes pixels?

    Só se grava o que mudou. O zlib de cada instalação do Pillow comprime um
    pouco diferente: regenerar tudo reescrevia 40 PNGs pixel-idênticos com
    alguns bytes de diferença — 29 MB de binário no histórico do git por nada.
    """
    if not destino.exists():
        return False
    import numpy as np
    try:
        with Image.open(destino) as antigo:
            antigo.load()
            if antigo.mode != im.mode or antigo.size != im.size:
                return False
            return bool(np.array_equal(np.asarray(antigo), np.asarray(im)))
    except OSError:
        return False


def slugify(s: str):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:40] or "x"


def caminho_para_o_json(p: Path) -> str:
    """Caminho relativo a `datasets/`, com subpasta de laboratório anonimizada (ver docstring)."""
    rel = p.relative_to(RAIZ)
    partes = list(rel.parts)
    if partes[0] in PASTAS_DO_LABORATORIO and len(partes) > 2:
        subpastas = sorted(q.name for q in (RAIZ / partes[0]).iterdir() if q.is_dir())
        for i in range(1, len(partes) - 1):
            if not SUBPASTA_NEUTRA.match(partes[i]):
                partes[i] = f"subpasta-{subpastas.index(partes[i]) + 1}" if partes[i] in subpastas else "subpasta"
    return "/".join(partes)


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    catalogo = []
    for c in CONJUNTOS:
        pasta = RAIZ / c["pasta"]
        if not pasta.exists():
            print(f"[pula] {c['slug']}: {pasta} não existe")
            continue
        try:
            escolhidos = c["escolha"](pasta)
        except Exception as e:  # noqa: BLE001
            print(f"[erro] {c['slug']}: {e}")
            continue
        for i, (p, extra) in enumerate(escolhidos, 1):
            pagina = extra.get("pagina", 0)
            try:
                im, (w0, h0), fator, origem_xy, dpi = reduzir(p, c.get("recorte"), c.get("janela", "borda"), c.get("janelas"), pagina)
            except Exception as e:  # noqa: BLE001
                print(f"[erro] {c['slug']} {p.name}: {e}")
                continue
            classe = extra.get("classeEscolhida") or extra.get("classesDaImagem", [None])[0]
            nome = f"{c['slug']}-{slugify(classe) if classe else i}.png"
            destino = SAIDA / nome
            if not mesmos_pixels(destino, im):
                im.save(destino, "PNG", optimize=True)
            escala_de = c["escala"]
            if escala_de == "regua-medida":
                um = c["umPorPixel"] / fator
            elif escala_de == "dpi-declarado" and dpi:
                um = 25400 / dpi / fator
            else:
                escala_de, um = None, None
            sufixo = f" — {classe}" if classe else (f" #{i}" if len(escolhidos) > 1 else "")
            catalogo.append({
                "slug": nome[:-4],
                "conjunto": c["slug"],
                "rotulo": c["rotulo"] + sufixo,
                "cultura": c["cultura"],
                "especie": c["especie"],
                "tipo": c["tipo"],
                "imagem": f"exemplos/{nome}",
                "largura": im.size[0], "altura": im.size[1],
                "original": {"arquivo": caminho_para_o_json(p), "largura": w0, "altura": h0, "fatorDeReducao": fator, "recorteEm": list(origem_xy),
                             **({"pagina": pagina + 1} if "pagina" in extra else {})},
                "umPorPixel": um,
                "escalaDe": escala_de,
                "dpiDeclarado": dpi,
                "notaEscala": c["notaEscala"],
                "classesDaImagem": extra.get("classesDaImagem", []),
                "origem": c["origem"], "licenca": c["licenca"], "url": c["url"],
                "dica": c["dica"],
                "bytes": destino.stat().st_size,
            })
            print(f"[ok] {nome} {im.size} {destino.stat().st_size // 1024} KB (fator {fator:.3f}, dpi {dpi})")
    with open(SAIDA / "catalogo.json", "w", encoding="utf-8") as f:
        json.dump({"geradoEm": GERADO_EM, "regra": "primeira imagem por ordem de nome; uma por classe/pasta; lado máximo 1024 px; PNG", "exemplos": catalogo}, f, ensure_ascii=False, indent=2)
    total = sum(e["bytes"] for e in catalogo)
    print(f"\n{len(catalogo)} exemplos, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
