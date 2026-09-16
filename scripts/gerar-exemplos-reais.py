"""
Gera os exemplos REAIS embutidos no app: recortes reduzidos de cada dataset
da pasta `datasets/`, com metadados, em `public/exemplos/` + `catalogo.json`.

Por que um script e não copiar à mão: são ~50 imagens de 20 conjuntos, e o
que interessa é a REGRA de escolha (determinística: primeira por ordem de
nome, uma por classe) e a proveniência gravada junto — para qualquer um
regenerar e para o app dizer de onde cada exemplo veio.

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

# µm/px conhecidos. Só o scanner do laboratório tem DPI declarado; o resto
# fica None e o app pede calibração. O "800–950 DPI" da soja não é um número.
UM_POR_PX_3600DPI = 25400 / 3600  # 7,0556
# digitalizar0001.jpg medido pela régua do próprio scanner (C3.2, 16/09): 1864 px
# por 10 mm → 5,365 µm/px (DPI efetivo ≈ 4735, não os 3600 declarados). Vale
# para as digitalizações "digitalizarXXXX"; para as outras do grupo o DPI não
# foi confirmado e fica sem escala.
UM_POR_PX_MEDIDO_SCAN = 10_000 / 1864.0


def imagens(pasta: Path):
    return sorted(p for p in pasta.rglob("*") if p.suffix.lower() in EXT and p.is_file())


def pastas_folha_com_imagens(pasta: Path):
    folhas = {}
    for p in imagens(pasta):
        folhas.setdefault(p.parent, p)  # primeira por ordem de nome
    return folhas


# --- Estratégias de escolha ---------------------------------------------------

def primeiras(pasta: Path, n: int, sub: str | None = None, padrao: str | None = None):
    base = pasta / sub if sub else pasta
    xs = imagens(base)
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


# --- Catálogo de conjuntos ----------------------------------------------------
# Cada entrada: pasta relativa a `datasets/`, escolha, e metadados que valem
# para todo exemplo do conjunto. `licenca` é registro, não gate (Enrico, 13/09).

CONJUNTOS = [
    dict(slug="gpeorq-scan", recorte=1536, janela={"digitalizar0001.jpg": (4000, 2700), "digitalizar0002.jpg": (3000, 3400)}, pasta="images/digitalizar_scan", escolha=lambda p: primeiras(p, 2, padrao=r"^digitalizar\d+\.jpg$"),
         rotulo="Orquídea — digitalização GPEOrq", cultura="orquidea", especie="Cattleya (GPEOrq)", tipo="digitalizacao",
         umPorPixel=UM_POR_PX_MEDIDO_SCAN, notaEscala="medida pela régua da própria digitalização (1864 px / 10 mm, DPI efetivo ≈ 4735 — não os 3600 declarados; docs/datasets/auditoria-de-medida.md)",
         origem="GPEOrq / GPSEM", licenca="material do grupo", url=None,
         dica="Digitalização real de bandeja com sementes de orquídea; há régua no scanner para conferir a escala."),
    dict(slug="gpeorq-tig", recorte=1536, pasta="images", escolha=lambda p: primeiras(p, 1, padrao=r"^1_Tig1\.png$"),
         rotulo="Orquídea — Tigrina (GPEOrq)", cultura="orquidea", especie="Cattleya tigrina", tipo="digitalizacao",
         umPorPixel=None, notaEscala="DPI não confirmado (a auditoria achou ≈ 4735 em digitalizarXXXX, não 3600); calibrar por referência",
         origem="GPEOrq / GPSEM", licenca="material do grupo", url=None, dica="Recorte de digitalização do grupo."),
    dict(slug="gpeorq-purp", recorte=1536, pasta="images", escolha=lambda p: primeiras(p, 1, padrao=r"^2_Purp1\.png$"),
         rotulo="Orquídea — Purpurata (GPEOrq)", cultura="orquidea", especie="Cattleya purpurata", tipo="digitalizacao",
         umPorPixel=None, notaEscala="DPI não confirmado (a auditoria achou ≈ 4735 em digitalizarXXXX, não 3600); calibrar por referência",
         origem="GPEOrq / GPSEM", licenca="material do grupo", url=None, dica="Recorte de digitalização do grupo."),
    dict(slug="nelson-tz", recorte=1536, janela={"DFhandPSOL1.tif": (2600, 1200)}, pasta="nelson_phd_images_orquid_enrico", escolha=lambda p: primeiras(p, 2, padrao=r"\.tif$"),
         rotulo="Orquídea — tetrazólio (doutorado Prof. Nelson)", cultura="orquidea", especie="Orquídea (doutorado)", tipo="digitalizacao",
         umPorPixel=None, notaEscala="scanner sem DPI registrado; calibrar por referência",
         origem="Prof. Nelson B. Machado Neto — GPEOrq", licenca="material do grupo", url=None,
         dica="Sementes encostadas de verdade e tetrazólio real — o caso difícil."),
    dict(slug="orquidea-roboflow", pasta="Sementes de Orquideas", escolha=lambda p: primeiras(p, 2, sub="test/images"),
         rotulo="Orquídea — Epidendrum (Roboflow)", cultura="orquidea", especie="Epidendrum", tipo="recorte",
         umPorPixel=None, notaEscala="imagem redimensionada pelo Roboflow; sem escala",
         origem="Roboflow Universe sementes-de-orquideas v8", licenca="CC BY 4.0", url="https://universe.roboflow.com/sementes-de-orqudea/sementes-de-orquideas",
         dica="Anotado viável/inviável por tetrazólio; é o conjunto de treino do modelo embarcado."),
    dict(slug="soja-mendeley", recorte=2048, pasta="Image Dataset of Local Indonesian Soybean Seed Var", escolha=lambda p: por_pasta(p, 3, so=None) if False else [
             (imagens(d)[0], {"classesDaImagem": [d.name.replace("Scanned_", "").replace("_Seed", "")]})
             for d in sorted(p.glob("Scanned_*")) if imagens(d)],
         rotulo="Soja — digitalização (Mendeley)", cultura="soja", especie="Glycine max", tipo="digitalizacao",
         umPorPixel=None, notaEscala="800–950 DPI segundo a fonte, sem valor exato; calibrar por referência",
         origem="Mendeley Data c733bjz4m3 (soja indonésia)", licenca="a conferir (Enrico)", url="https://data.mendeley.com/datasets/c733bjz4m3/3",
         dica="Sementes em grade, nunca se tocam; a fonte tem máscara de instância por semente."),
    dict(slug="trigo-yolo", pasta="seed detect.v3i.yolov8", escolha=lambda p: primeiras(p, 2, sub="train/images") or primeiras(p, 2),
         rotulo="Trigo — detecção (Roboflow)", cultura="trigo", especie="Triticum aestivum", tipo="foto",
         umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe kyoung-do-min/seed-detect", licenca="a conferir (Enrico)",
         url="https://universe.roboflow.com/kyoung-do-min/seed-detect-nmxet", dica="Caixas YOLO; serve para contagem."),
    dict(slug="trigo-qualidade", pasta="wheat quality detection.v2i.multiclass", escolha=lambda p: multiclass(p, 1),
         rotulo="Trigo — qualidade (sadia / danificada / impureza)", cultura="trigo", especie="Triticum", tipo="foto-individual",
         umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe (wheat quality detection v2)", licenca="a conferir (Enrico)", url=None,
         dica="Uma classe por foto; serve à taxonomia de classes e ao perfil por classe."),
    dict(slug="arroz-pragas", pasta="rice.v1i.multiclass", escolha=lambda p: multiclass(p, 1),
         rotulo="Arroz — pureza e pragas", cultura="arroz", especie="Oryza sativa", tipo="foto-individual",
         umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe (rice v1 multiclass)", licenca="a conferir (Enrico)", url=None,
         dica="12 classes, inclui gorgulho e capim-arroz."),
    dict(slug="amendoim-mofo", pasta="peanuts.v2-release.multiclass", escolha=lambda p: multiclass(p, 1),
         rotulo="Amendoim — com / sem mofo", cultura="amendoim", especie="Arachis hypogaea", tipo="foto-individual",
         umPorPixel=None, notaEscala="sem escala", origem="Roboflow Universe (peanuts v2)", licenca="a conferir (Enrico)", url=None,
         dica="Fitopatologia: mofo visível."),
    dict(slug="lzupsd", pasta="Seed dataset", escolha=lambda p: por_pasta(p, 8),
         rotulo="88 espécies — macro (LZUPSD)", cultura="varias", especie=None, tipo="macro",
         umPorPixel=None, notaEscala="192×272 padronizado; sem escala", origem="LZUPSD — Nature Scientific Data 2024", licenca="a conferir (Enrico)",
         url="https://doi.org/10.1038/s41597-024-03176-5", dica="Forrageiras, cereais e daninhas em fundo preto; a pasta é a espécie."),
    dict(slug="milho", pasta="maize-seed-dataset", escolha=lambda p: por_pasta(p, 3),
         rotulo="Milho — 3 variedades", cultura="milho", especie="Zea mays", tipo="foto-individual",
         umPorPixel=None, notaEscala="sem escala", origem="Kaggle yungprof123/maize-seed-dataset", licenca="a conferir (Enrico)",
         url="https://www.kaggle.com/datasets/yungprof123/maize-seed-dataset", dica="Semente angular; a pasta é a variedade."),
    dict(slug="cafe-torra", pasta="coffee-beans-roasting", escolha=lambda p: por_pasta(p, 4),
         rotulo="Café — níveis de torra", cultura="cafe", especie="Coffea", tipo="foto-individual",
         umPorPixel=None, notaEscala="224×224; sem escala", origem="Kaggle gpiosenka/coffee-bean-dataset", licenca="a conferir (Enrico)",
         url="https://www.kaggle.com/datasets/gpiosenka/coffee-bean-dataset-resized-224-x-224", dica="Colorimetria (L*a*b*) por torra."),
    dict(slug="cafe-defeitos", pasta="green-coffee-defects", escolha=lambda p: primeiras(p, 4),
         rotulo="Café verde — defeitos", cultura="cafe", especie="Coffea", tipo="macro",
         umPorPixel=None, notaEscala="sem escala", origem="Kaggle j4ckdev/green-coffee-beans-dataset", licenca="CC BY-NC-SA (arquivo LICENSE na pasta)",
         url="https://www.kaggle.com/datasets/j4ckdev/green-coffee-beans-dataset", dica="Brocado, concha, fungo, negro."),
    dict(slug="arroz-cultivares", pasta="rice-image-dataset", escolha=lambda p: por_pasta(p, 5),
         rotulo="Arroz — 5 cultivares", cultura="arroz", especie="Oryza sativa", tipo="foto-individual",
         umPorPixel=None, notaEscala="sem escala", origem="Kaggle (Koklu) rice-image-dataset", licenca="a conferir (Enrico)", url=None,
         dica="Arborio, Basmati, Ipsala, Jasmine, Karacadag."),
    dict(slug="soja-defeitos", pasta="soybean-defects", escolha=lambda p: por_pasta(p, 5),
         rotulo="Soja — 5 classes de integridade", cultura="soja", especie="Glycine max", tipo="foto-individual",
         umPorPixel=None, notaEscala="sem escala", origem="Kaggle soybean-defects", licenca="a conferir (Enrico)", url=None,
         dica="Broken, Immature, Intact, Skin-damaged, Spotted — candidatas a subclasse."),
    dict(slug="trigo-duro", pasta="durum-wheat-dataset", escolha=lambda p: por_pasta(p, 2),
         rotulo="Trigo duro — por variedade", cultura="trigo", especie="Triticum durum", tipo="foto",
         umPorPixel=None, notaEscala="sem escala", origem="Kaya & Saritas (Selçuk Univ.)", licenca="a conferir (Enrico)", url=None,
         dica="Alta resolução; morfologia de cariopse."),
    dict(slug="lucasiturriago", pasta="lucasiturriago-seeds", escolha=lambda p: primeiras(p, 2, padrao=r"(?i)^(?!.*mask).*\.(jpg|png)$"),
         rotulo="Sementes — máscara binária (Kaggle)", cultura="varias", especie=None, tipo="foto",
         umPorPixel=None, notaEscala="512×512; sem escala", origem="Kaggle lucasiturriago/seeds", licenca="a conferir (Enrico)",
         url="https://www.kaggle.com/datasets/lucasiturriago/seeds", dica="Tem máscara semente × fundo (não instância)."),
    dict(slug="mayara", pasta="mayara_images", escolha=lambda p: primeiras(p, 2),
         rotulo="Bancada — foto de celular (Mayara)", cultura="varias", especie=None, tipo="foto",
         umPorPixel=None, notaEscala="foto de celular; calibrar por referência", origem="GPEOrq — bancada", licenca="material do grupo", url=None,
         dica="Robustez a foto de celular."),
]


def melhor_janela(im: Image.Image, lado: int):
    """Janela `lado`×`lado` (px da original) com mais conteúdo.

    Reduzir uma digitalização de 6800×9359 para 1024 px apaga a semente de
    orquídea (166 px viram 13). Para esse tipo, o exemplo é um RECORTE em
    resolução cheia — e a escala (µm/px) continua valendo. A janela escolhida
    é a de maior desvio-padrão de cinza numa varredura grossa: onde há
    semente, há variância; margem vazia de scanner não tem.
    """
    import numpy as np
    w0, h0 = im.size
    if max(w0, h0) <= lado:
        return im, (0, 0)
    passo = 4
    g = np.asarray(im.convert("L").resize((max(1, w0 // passo), max(1, h0 // passo)), Image.BILINEAR), dtype=np.float32)
    # Energia de alta frequência (laplaciano), não contraste: um rótulo escrito
    # em fita tem contraste alto e pouca borda por área; centenas de sementes
    # minúsculas têm borda em todo lugar.
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    lj = max(1, lado // passo)
    melhor, best = None, -1.0
    for y in range(0, max(1, lap.shape[0] - lj + 1), max(1, lj // 4)):
        for x in range(0, max(1, lap.shape[1] - lj + 1), max(1, lj // 4)):
            v = float(lap[y:y + lj, x:x + lj].mean())
            if v > best:
                best, melhor = v, (x * passo, y * passo)
    x, y = melhor
    x = min(x, w0 - lado); y = min(y, h0 - lado)
    return im.crop((x, y, x + lado, y + lado)), (x, y)


def reduzir(p: Path, recorte: int | None = None, janela: dict | None = None):
    im = Image.open(p)
    im.load()
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    origem_xy = (0, 0)
    if recorte and janela and p.name in janela:
        # Janela escolhida à mão olhando a digitalização inteira (a heurística
        # de borda escolhe a régua ou o rótulo quando há um): registrada aqui
        # para o exemplo ser reproduzível.
        x, y = janela[p.name]
        im = im.crop((x, y, x + recorte, y + recorte)); origem_xy = (x, y)
    elif recorte:
        im, origem_xy = melhor_janela(im, recorte)
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
    return im2, (w0, h0), fator, origem_xy


def slugify(s: str):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:40] or "x"


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
            try:
                im, (w0, h0), fator, origem_xy = reduzir(p, c.get("recorte"), c.get("janela"))
            except Exception as e:  # noqa: BLE001
                print(f"[erro] {c['slug']} {p.name}: {e}")
                continue
            classe = extra.get("classeEscolhida") or extra.get("classesDaImagem", [None])[0]
            nome = f"{c['slug']}-{slugify(classe) if classe else i}.png"
            destino = SAIDA / nome
            im.save(destino, "PNG", optimize=True)
            um = c["umPorPixel"] / fator if c["umPorPixel"] else None
            catalogo.append({
                "slug": nome[:-4],
                "conjunto": c["slug"],
                "rotulo": c["rotulo"] + (f" — {classe}" if classe else (f" #{i}" if len(escolhidos) > 1 else "")),
                "cultura": c["cultura"],
                "especie": c["especie"],
                "tipo": c["tipo"],
                "imagem": f"exemplos/{nome}",
                "largura": im.size[0], "altura": im.size[1],
                "original": {"arquivo": str(p.relative_to(RAIZ)), "largura": w0, "altura": h0, "fatorDeReducao": fator, "recorteEm": list(origem_xy)},
                "umPorPixel": um,
                "notaEscala": c["notaEscala"],
                "classesDaImagem": extra.get("classesDaImagem", []),
                "origem": c["origem"], "licenca": c["licenca"], "url": c["url"],
                "dica": c["dica"],
                "bytes": destino.stat().st_size,
            })
            print(f"[ok] {nome} {im.size} {destino.stat().st_size // 1024} KB (fator {fator:.3f})")
    with open(SAIDA / "catalogo.json", "w", encoding="utf-8") as f:
        json.dump({"geradoEm": "2026-09-15", "regra": "primeira imagem por ordem de nome; uma por classe/pasta; lado máximo 1024 px; PNG", "exemplos": catalogo}, f, ensure_ascii=False, indent=2)
    total = sum(e["bytes"] for e in catalogo)
    print(f"\n{len(catalogo)} exemplos, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
