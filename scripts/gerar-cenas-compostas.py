"""
Gera CENAS COMPOSTAS: várias fotos de UMA semente cada (os datasets de
classificação — café por torra, arroz por cultivar, milho por variedade, soja
por defeito, LZUPSD por espécie) recortadas e coladas numa única cena, estilo
tetris — posição, rotação e espelho sorteados — com a VERDADE de cada recorte
(classe, conjunto de origem, arquivo, polígono e caixa) gravada junto.

POR QUÊ (pedido do Enrico, 16/09): os datasets de classificação têm uma
semente por foto; ele quer "juntar tudo" numa cena para (a) ver se o app
reconhece cada semente, (b) simular uma esteira com coisas conhecidas, e
(c) alimentar um banco interno de padrões. A cena precisa vir com verdade
exata, como os exemplos reais em `catalogo.json` têm — sem isso, "o app
reconheceu certo?" não tem resposta.

SEM OPENCV NEM SCIKIT-IMAGE. Componentes conexos (BFS 8-vizinhos), Otsu e o
traçado de contorno Moore-neighbor são os mesmos algoritmos escritos à mão em
`gerar-fixtures-reais.py` (reaproveitados aqui, não importados — cada script
de dataset já é standalone no repo, e a função de contorno é pequena o
bastante para não valer o acoplamento entre dois scripts).

ORDEM DE EXECUÇÃO — IMPORTANTE: `gerar-exemplos-reais.py` REESCREVE
`catalogo.json` do zero a cada rodada. Este script LÊ o catálogo existente,
remove as entradas antigas de cena composta (`conjunto == 'composto'`) e
acrescenta as novas — ou seja, é idempotente por si só, mas depende de rodar
DEPOIS de `gerar-exemplos-reais.py`. Rodar na ordem errada faz as cenas
composta desaparecerem do catálogo (o PNG continua no disco, órfão).
Sequência correta:
    python scripts/gerar-exemplos-reais.py
    python scripts/gerar-cenas-compostas.py

Uso:  python scripts/gerar-cenas-compostas.py [caminho da pasta datasets]
Requer: Pillow, numpy (sem OpenCV).
"""
from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

RAIZ = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "datasets"
SAIDA = Path(__file__).resolve().parents[1] / "public" / "exemplos"
CATALOGO = SAIDA / "catalogo.json"
EXT = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")

LADO_CENA = 1024          # cabe no teto de 1024 px que o catálogo já exige
LADO_ALVO_MIN, LADO_ALVO_MAX = 90, 130   # maior lado do recorte já colado, em px
MARGEM_COLISAO = 6        # folga mínima entre caixas de dois objetos
SEMENTE_RNG = 42          # fixa — a mesma semente dá a mesma cena, sempre

MOLDURA_FUNDO = 4         # px de moldura usados para estimar a cor do fundo
LIMIAR_TOQUE_BORDA = 0.30  # descarta se o maior componente toca > 30% do perímetro
LIMIAR_AREA_MAX = 0.80     # descarta se o maior componente ocupa > 80% da imagem
AREA_MINIMA_PX = 50        # descarta silhuetas que sobram praticamente vazias


# =============================================================================
# Passo 1 — recortar a semente de UMA foto individual
# =============================================================================

def estimar_fundo(rgb: np.ndarray, moldura: int = MOLDURA_FUNDO) -> np.ndarray:
    """Mediana da moldura de `moldura` px — robusta a uma semente que já
    encoste na borda por um lado, porque a mediana ignora a minoria de
    pixels de semente que caem dentro da faixa."""
    faixas = [rgb[:moldura, :, :], rgb[-moldura:, :, :], rgb[:, :moldura, :], rgb[:, -moldura:, :]]
    pixels = np.concatenate([f.reshape(-1, 3) for f in faixas], axis=0)
    return np.median(pixels, axis=0)


def limiar_otsu(valores: np.ndarray) -> float:
    """Otsu simples (256 bins) sobre a distância de cor ao fundo.

    Um limiar fixo não serve: o fundo varia de quase preto (LZUPSD, soja) a
    quase branco (café claro ~238) entre conjuntos — o que separa objeto de
    fundo é sempre um vale no histograma de distância, não um número fixo.
    """
    v = valores.ravel()
    vmax = float(v.max())
    if vmax <= 0:
        return 0.0
    hist, _ = np.histogram(v, bins=256, range=(0, vmax + 1e-6))
    hist = hist.astype(np.float64)
    total = hist.sum()
    soma_total = np.dot(np.arange(256), hist)
    soma_fundo = 0.0
    peso_fundo = 0.0
    melhor_var, melhor_t = -1.0, 0
    for t in range(256):
        peso_fundo += hist[t]
        if peso_fundo == 0:
            continue
        peso_frente = total - peso_fundo
        if peso_frente == 0:
            break
        soma_fundo += t * hist[t]
        media_fundo = soma_fundo / peso_fundo
        media_frente = (soma_total - soma_fundo) / peso_frente
        var_entre = peso_fundo * peso_frente * (media_fundo - media_frente) ** 2
        if var_entre > melhor_var:
            melhor_var, melhor_t = var_entre, t
    return melhor_t * (vmax + 1e-6) / 256


_VIZINHOS8 = [(-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1)]


def rotular_componentes(mascara: np.ndarray) -> tuple[np.ndarray, int]:
    """BFS 8-vizinhos sobre uma máscara booleana (H, W); cabe em numpy puro
    porque os recortes individuais são no máximo 250×250 (o maior é o
    scanner de digitalização, que não passa por aqui)."""
    h, w = mascara.shape
    rotulos = np.zeros((h, w), dtype=np.int32)
    atual = 0
    for y in range(h):
        if not mascara[y].any():
            continue
        for x in range(w):
            if not mascara[y, x] or rotulos[y, x]:
                continue
            atual += 1
            fila = deque([(y, x)])
            rotulos[y, x] = atual
            while fila:
                cy, cx = fila.popleft()
                for dy, dx in _VIZINHOS8:
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mascara[ny, nx] and not rotulos[ny, nx]:
                        rotulos[ny, nx] = atual
                        fila.append((ny, nx))
    return rotulos, atual


def preencher_buracos(mascara: np.ndarray) -> np.ndarray:
    """Buraco = pixel de fundo que a inundação a partir da BORDA da imagem
    não alcança (ficou cercado de objeto por todos os lados)."""
    h, w = mascara.shape
    fundo = ~mascara
    alcancavel = np.zeros_like(fundo)
    fila: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if fundo[y, x] and not alcancavel[y, x]:
                alcancavel[y, x] = True
                fila.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if fundo[y, x] and not alcancavel[y, x]:
                alcancavel[y, x] = True
                fila.append((y, x))
    while fila:
        cy, cx = fila.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and fundo[ny, nx] and not alcancavel[ny, nx]:
                alcancavel[ny, nx] = True
                fila.append((ny, nx))
    buracos = fundo & ~alcancavel
    return mascara | buracos


def erodir_1px(mascara: np.ndarray) -> np.ndarray:
    """Erosão 4-vizinhos de 1 px — contra o halo de compressão JPEG que sobra
    colado na borda da semente quando o limiar de Otsu inclui o degradê de
    antialiasing entre objeto e fundo (conferido a olho no Passo 4 da tarefa;
    aplicado por padrão porque o halo aparece nos JPEGs, não só nos casos
    extremos)."""
    out = mascara.copy()
    out[1:, :] &= mascara[:-1, :]
    out[:-1, :] &= mascara[1:, :]
    out[:, 1:] &= mascara[:, :-1]
    out[:, :-1] &= mascara[:, 1:]
    return out


def tracar_contorno_externo(mascara_bin: np.ndarray) -> list[list[float]]:
    """Moore-neighbor tracing — mesmo algoritmo de `gerar-fixtures-reais.py`
    (Task A4), reescrito aqui para este script continuar standalone."""
    linhas, colunas = mascara_bin.shape
    pad = np.zeros((linhas + 2, colunas + 2), dtype=bool)
    pad[1:-1, 1:-1] = mascara_bin
    inicio = None
    for r in range(pad.shape[0]):
        cs = np.nonzero(pad[r])[0]
        if cs.size:
            inicio = (r, int(cs[0]))
            break
    if inicio is None:
        return []
    retrocesso = (inicio[0], inicio[1] - 1)
    atual = inicio
    contorno_rc = [inicio]
    max_passos = 8 * (linhas + colunas) * 20
    passos = 0
    while True:
        d = (retrocesso[0] - atual[0], retrocesso[1] - atual[1])
        idx_ini = (_VIZINHOS8.index(d) + 1) % 8 if d in _VIZINHOS8 else 0
        achou = None
        for k in range(8):
            idx = (idx_ini + k) % 8
            dr, dc = _VIZINHOS8[idx]
            nr, nc = atual[0] + dr, atual[1] + dc
            if pad[nr, nc]:
                achou = (nr, nc)
                idx_achado = idx
                break
        if achou is None:
            break
        dr2, dc2 = _VIZINHOS8[(idx_achado - 1) % 8]
        retrocesso = (atual[0] + dr2, atual[1] + dc2)
        atual = achou
        passos += 1
        if atual == inicio:
            break
        contorno_rc.append(atual)
        if passos > max_passos:
            break
    return [[float(c - 1), float(r - 1)] for (r, c) in contorno_rc]


def recortar_semente(caminho: Path) -> tuple[dict | None, str]:
    """Recorta a semente de uma foto de fundo uniforme. Devolve (recorte, motivo);
    `recorte` é None quando descartado — `motivo` sempre diz por quê."""
    try:
        im = Image.open(caminho).convert("RGB")
    except Exception as e:  # noqa: BLE001
        return None, f"erro-ao-abrir:{e}"
    rgb = np.asarray(im, dtype=np.float64)
    h, w, _ = rgb.shape
    fundo = estimar_fundo(rgb)
    dist = np.sqrt(((rgb - fundo) ** 2).sum(axis=-1))
    limiar = limiar_otsu(dist)
    mascara = dist > max(limiar, 1e-6)

    rotulos, n = rotular_componentes(mascara)
    if n == 0:
        return None, "sem-componente"
    tamanhos = np.bincount(rotulos.ravel())
    tamanhos[0] = 0
    maior_id = int(np.argmax(tamanhos))
    obj = rotulos == maior_id

    borda = np.zeros_like(obj)
    borda[0, :] = borda[-1, :] = True
    borda[:, 0] = borda[:, -1] = True
    perimetro = int(borda.sum())
    toque = int((obj & borda).sum())
    if perimetro > 0 and toque / perimetro > LIMIAR_TOQUE_BORDA:
        return None, "toca-borda"  # semente cortada pela foto, não está inteira
    if obj.sum() / (h * w) > LIMIAR_AREA_MAX:
        return None, "ocupa-demais"  # provavelmente não é foto de UMA semente

    obj = preencher_buracos(obj)
    # Duas erosões, não uma: com uma só sobrava um halo do fundo da foto
    # original (o azulado visível nas primeiras cenas), e halo vira borda
    # falsa — exatamente o que a segmentação vai medir.
    obj = erodir_1px(erodir_1px(obj))
    if obj.sum() < AREA_MINIMA_PX:
        return None, "vazio-apos-erosao"

    ys, xs = np.nonzero(obj)
    pad = 2
    y0, y1 = max(0, int(ys.min()) - pad), min(h - 1, int(ys.max()) + pad)
    x0, x1 = max(0, int(xs.min()) - pad), min(w - 1, int(xs.max()) + pad)
    recorte_rgb = np.asarray(im)[y0 : y1 + 1, x0 : x1 + 1].copy()
    recorte_mask = obj[y0 : y1 + 1, x0 : x1 + 1]
    contorno = tracar_contorno_externo(recorte_mask)
    if len(contorno) < 3:
        return None, "contorno-degenerado"
    return {"rgb": recorte_rgb, "mask": recorte_mask, "contorno": contorno}, "ok"


# =============================================================================
# Passo 2 — de onde vêm os recortes (conjuntos de UMA semente por foto)
# =============================================================================

CONJUNTOS_ORIGEM = {
    "arroz-cultivares": dict(
        pasta="rice-image-dataset/Rice_Image_Dataset", cultura="arroz", especie="Oryza sativa", sufixo_classe=None,
        rotulo_origem="arroz-cultivares (Kaggle rice-image-dataset, 5 cultivares)",
    ),
    "cafe-torra": dict(
        pasta="coffee-beans-roasting/train", cultura="cafe", especie="Coffea", sufixo_classe=None,
        rotulo_origem="cafe-torra (Kaggle coffee-bean-dataset, 4 níveis de torra)",
    ),
    "soja-defeitos": dict(
        pasta="soybean-defects", cultura="soja", especie="Glycine max", sufixo_classe=" soybeans",
        rotulo_origem="soja-defeitos (Kaggle soybean-defects, 5 classes de integridade)",
    ),
    "milho": dict(
        pasta="maize-seed-dataset/MaizeData", cultura="milho", especie="Zea mays", sufixo_classe=None,
        rotulo_origem="milho (Kaggle maize-seed-dataset, 3 variedades)",
    ),
    "lzupsd": dict(
        pasta="Seed dataset/Seed dataset", cultura="varias", especie=None, sufixo_classe=None,
        rotulo_origem="lzupsd (LZUPSD — Nature Scientific Data 2024, 88 espécies)",
    ),
}
# `amendoim-mofo` (peanuts.v2-release.multiclass) e `durum-wheat-dataset` ficaram
# de fora desta primeira leva: o primeiro é foto de bancada com várias sementes
# por imagem (não uma-semente-por-foto — o cortador deste script pressupõe
# fundo uniforme e um só objeto), e o segundo é vídeo/planilha de feições, sem
# pasta de imagens soltas por variedade. Registrado aqui e no doc, não escondido.


def listar_classes(pasta: Path) -> list[Path]:
    return sorted(d for d in pasta.iterdir() if d.is_dir())


def listar_imagens(pasta: Path) -> list[Path]:
    return sorted(p for p in pasta.iterdir() if p.is_file() and p.suffix.lower() in EXT)


def coletar_de_classe(
    pasta_classe: Path, conjunto: str, classe: str, quantidade: int, estat: dict, pular: int = 0
) -> list[dict]:
    arquivos = listar_imagens(pasta_classe)[pular:]
    aceitos: list[dict] = []
    est = estat.setdefault(conjunto, {"tentadas": 0, "aceitas": 0, "descartes": {}})
    for p in arquivos:
        if len(aceitos) >= quantidade:
            break
        est["tentadas"] += 1
        recorte, motivo = recortar_semente(p)
        if recorte is None:
            est["descartes"][motivo] = est["descartes"].get(motivo, 0) + 1
            continue
        est["aceitas"] += 1
        recorte["classe"] = classe
        recorte["conjunto"] = conjunto
        recorte["arquivoDeOrigem"] = str(p.relative_to(RAIZ)).replace("\\", "/")
        aceitos.append(recorte)
    return aceitos


def coletar_conjunto(
    chave: str, quantidade_por_classe: int, estat: dict, classes_apenas: list[str] | None = None, pular: int = 0
) -> list[dict]:
    cfg = CONJUNTOS_ORIGEM[chave]
    pasta = RAIZ / cfg["pasta"]
    if not pasta.exists():
        print(f"[pula] {chave}: {pasta} não existe")
        return []
    out: list[dict] = []
    for d in listar_classes(pasta):
        nome = d.name
        classe = nome[: -len(cfg["sufixo_classe"])].strip() if cfg["sufixo_classe"] and nome.endswith(cfg["sufixo_classe"]) else nome
        if classes_apenas is not None and classe not in classes_apenas:
            continue
        out.extend(coletar_de_classe(d, chave, classe, quantidade_por_classe, estat, pular))
    return out


# =============================================================================
# Passo 3 — compor a cena (tetris): posição por rejeição, rotação, espelho
# =============================================================================

def compor_cena(recortes: list[dict], fundo_tipo: str, lado: int = LADO_CENA, semente: int = SEMENTE_RNG):
    rng = np.random.default_rng(semente)
    base_cor = 200 if fundo_tipo == "claro" else 40
    ruido = np.clip(base_cor + rng.integers(-3, 4, size=(lado, lado, 3)), 0, 255).astype(np.uint8)
    canvas = Image.fromarray(ruido, "RGB").convert("RGBA")

    objetos: list[dict] = []
    caixas: list[tuple[int, int, int, int]] = []
    proximo_id = 1

    for meta in recortes:
        rgb, mask = meta["rgb"], meta["mask"]
        alpha = (mask.astype(np.uint8) * 255)
        rgba = np.dstack([rgb, alpha])
        obj = Image.fromarray(rgba, "RGBA")

        # Escala: normaliza o maior lado do recorte para 90-130 px.
        lado_alvo = rng.uniform(LADO_ALVO_MIN, LADO_ALVO_MAX)
        fator = lado_alvo / max(obj.width, obj.height)
        nova_w, nova_h = max(1, round(obj.width * fator)), max(1, round(obj.height * fator))
        obj = obj.resize((nova_w, nova_h), Image.LANCZOS)

        flipado = bool(rng.random() < 0.5)
        if flipado:
            obj = obj.transpose(Image.FLIP_LEFT_RIGHT)

        angulo = float(rng.uniform(0, 360))
        obj = obj.rotate(angulo, expand=True, resample=Image.BICUBIC)
        larg, alt = obj.size
        if larg > lado or alt > lado:
            continue  # recorte maior que a própria cena: não há posição possível

        colocado = False
        x = y = 0
        for _ in range(400):
            x = int(rng.integers(0, lado - larg + 1))
            y = int(rng.integers(0, lado - alt + 1))
            colide = any(
                not (
                    x + larg + MARGEM_COLISAO <= bx
                    or bx + bl + MARGEM_COLISAO <= x
                    or y + alt + MARGEM_COLISAO <= by
                    or by + bh + MARGEM_COLISAO <= y
                )
                for (bx, by, bl, bh) in caixas
            )
            if not colide:
                colocado = True
                break
        if not colocado:
            continue

        canvas.paste(obj, (x, y), obj)
        alpha_final = np.asarray(obj)[:, :, 3] > 127
        if not alpha_final.any():
            continue
        contorno_local = tracar_contorno_externo(alpha_final)
        if len(contorno_local) < 3:
            continue
        ys_o, xs_o = np.nonzero(alpha_final)

        objetos.append(
            {
                "id": proximo_id,
                "classe": meta["classe"],
                "conjunto": meta["conjunto"],
                "arquivoDeOrigem": meta["arquivoDeOrigem"],
                "poligono": [[round(px + x, 1), round(py + y, 1)] for px, py in contorno_local],
                "caixa": {
                    "x": int(x + xs_o.min()),
                    "y": int(y + ys_o.min()),
                    "largura": int(xs_o.max() - xs_o.min() + 1),
                    "altura": int(ys_o.max() - ys_o.min() + 1),
                },
                "flipado": flipado,
                "rotacaoGraus": round(angulo, 1),
            }
        )
        caixas.append((x, y, larg, alt))
        proximo_id += 1

    nao_colocados = len(recortes) - len(objetos)
    return canvas.convert("RGB"), objetos, nao_colocados


# =============================================================================
# Passo 4 — as 6 cenas pedidas
# =============================================================================

def montar_cenas(estat: dict) -> list[dict]:
    cenas = []

    # --- misto-claro-24: um pouco de cada conjunto, fundo de bandeja clara ---
    recortes = (
        coletar_conjunto("arroz-cultivares", 1, estat)
        + coletar_conjunto("cafe-torra", 1, estat)
        + coletar_conjunto("soja-defeitos", 1, estat)
        + coletar_conjunto("milho", 2, estat)
        + coletar_conjunto("lzupsd", 1, estat, classes_apenas=sorted(d.name for d in listar_classes(RAIZ / CONJUNTOS_ORIGEM["lzupsd"]["pasta"]))[:4])
    )
    cenas.append(dict(nome="misto-claro-24", fundo="claro", recortes=recortes, cultura="varias", especie=None,
                       origens=["arroz-cultivares", "cafe-torra", "soja-defeitos", "milho", "lzupsd"]))

    # --- misto-escuro-24: mesma ideia, fundo de bandeja escura; fotos DIFERENTES
    #     das da cena clara (pula as já usadas) para ampliar a cobertura do corpus ---
    especies_lzupsd = sorted(d.name for d in listar_classes(RAIZ / CONJUNTOS_ORIGEM["lzupsd"]["pasta"]))
    recortes = (
        coletar_conjunto("arroz-cultivares", 1, estat, pular=1)
        + coletar_conjunto("cafe-torra", 1, estat, pular=1)
        + coletar_conjunto("soja-defeitos", 1, estat, pular=1)
        + coletar_conjunto("milho", 2, estat, pular=2)
        + coletar_conjunto("lzupsd", 1, estat, classes_apenas=especies_lzupsd[4:8])
    )
    cenas.append(dict(nome="misto-escuro-24", fundo="escuro", recortes=recortes, cultura="varias", especie=None,
                       origens=["arroz-cultivares", "cafe-torra", "soja-defeitos", "milho", "lzupsd"]))

    # --- arroz-claro-30: só arroz, 5 cultivares, 6 cada ---
    recortes = coletar_conjunto("arroz-cultivares", 6, estat)
    cenas.append(dict(nome="arroz-claro-30", fundo="claro", recortes=recortes, cultura="arroz", especie="Oryza sativa",
                       origens=["arroz-cultivares"]))

    # --- cafe-claro-20: só café, 4 torras, 5 cada ---
    recortes = coletar_conjunto("cafe-torra", 5, estat)
    cenas.append(dict(nome="cafe-claro-20", fundo="claro", recortes=recortes, cultura="cafe", especie="Coffea",
                       origens=["cafe-torra"]))

    # --- soja-defeitos-claro-25: só soja, 5 classes de integridade, 5 cada ---
    recortes = coletar_conjunto("soja-defeitos", 5, estat)
    cenas.append(dict(nome="soja-defeitos-claro-25", fundo="claro", recortes=recortes, cultura="soja", especie="Glycine max",
                       origens=["soja-defeitos"]))

    # --- lzupsd-escuro-24: 24 espécies distintas, 1 cada, fundo escuro ---
    recortes = coletar_conjunto("lzupsd", 1, estat, classes_apenas=especies_lzupsd[:24])
    cenas.append(dict(nome="lzupsd-escuro-24", fundo="escuro", recortes=recortes, cultura="varias", especie=None,
                       origens=["lzupsd"]))

    return cenas


# =============================================================================
# Passo 5 — gerar PNG + .verdade.json e atualizar o catálogo
# =============================================================================

def gerar_e_salvar(cena_spec: dict) -> dict:
    nome = cena_spec["nome"]
    fundo = cena_spec["fundo"]
    recortes = cena_spec["recortes"]
    imagem, objetos, nao_colocados = compor_cena(recortes, fundo)

    nome_arquivo = f"composto-{nome}.png"
    nome_verdade = f"composto-{nome}.verdade.json"
    verdade = {"origem": "composta", "fundo": fundo, "objetos": objetos}

    # Teto de 1,5 MB (o mesmo que o teste do catálogo exige). O ruído do fundo
    # é o que engorda o PNG; reduzir o lado é o que devolve tamanho sem mexer
    # na verdade, que está em coordenadas relativas ao PNG salvo — por isso a
    # redução acontece ANTES de escrever a verdade (ver `escala_final`).
    caminho = SAIDA / nome_arquivo
    imagem.save(caminho, "PNG", optimize=True)
    escala_final = 1.0
    lado_atual = max(imagem.size)
    while caminho.stat().st_size > 1_450_000 and lado_atual > 640:
        lado_atual = int(lado_atual * 0.88)
        f = lado_atual / max(imagem.size)
        imagem.resize((max(1, round(imagem.size[0] * f)), max(1, round(imagem.size[1] * f))), Image.LANCZOS).save(
            caminho, "PNG", optimize=True
        )
        escala_final = lado_atual / LADO_CENA
    if escala_final != 1.0:
        with Image.open(caminho) as reaberta:
            largura_final, altura_final = reaberta.size
        for o in verdade["objetos"]:
            o["poligono"] = [[round(x * escala_final, 1), round(y * escala_final, 1)] for x, y in o["poligono"]]
            if "caixa" in o:
                o["caixa"] = {k: round(v * escala_final, 1) for k, v in o["caixa"].items()}
    else:
        largura_final, altura_final = imagem.size

    with open(SAIDA / nome_verdade, "w", encoding="utf-8") as f:
        json.dump(verdade, f, ensure_ascii=False, indent=2)

    classes_presentes = sorted({o["classe"] for o in objetos})
    origens_rotulo = ", ".join(CONJUNTOS_ORIGEM[c]["rotulo_origem"] for c in cena_spec["origens"])
    bytes_ = (SAIDA / nome_arquivo).stat().st_size

    entrada = {
        "slug": f"composto-{nome}",
        "conjunto": "composto",
        "rotulo": f"Cena composta — {nome.replace('-', ' ')} ({len(objetos)} sementes)",
        "cultura": cena_spec["cultura"],
        "especie": cena_spec["especie"],
        "tipo": "composta",
        "imagem": f"exemplos/{nome_arquivo}",
        "largura": largura_final,
        "altura": altura_final,
        "original": {
            "arquivo": f"cena composta a partir de {len(objetos)} recortes (ver {nome_verdade})",
            "largura": imagem.size[0],
            "altura": imagem.size[1],
            "fatorDeReducao": 1.0,
            "recorteEm": [0, 0],
        },
        "umPorPixel": None,
        "notaEscala": "cena composta; escala não se aplica",
        "classesDaImagem": classes_presentes,
        "origem": origens_rotulo,
        "licenca": "a conferir (Enrico)",
        "url": None,
        "dica": f"A verdade (classe, arquivo de origem e polígono de cada recorte) está em {nome_verdade}, ao lado desta imagem.",
        "bytes": bytes_,
    }
    print(f"[cena] {nome_arquivo}: {len(objetos)} objetos colados, {nao_colocados} não coube, {bytes_ // 1024} KB")
    return entrada


def atualizar_catalogo(novas_entradas: list[dict]) -> None:
    if not CATALOGO.exists():
        raise SystemExit(
            f"{CATALOGO} não existe. Rode primeiro `python scripts/gerar-exemplos-reais.py` "
            "(este script só ACRESCENTA cenas ao catálogo existente)."
        )
    with open(CATALOGO, "r", encoding="utf-8") as f:
        catalogo = json.load(f)

    # Idempotente: tira qualquer cena composta de uma rodada anterior antes de
    # acrescentar as novas — senão rodar o script duas vezes duplicaria tudo.
    antes = len(catalogo["exemplos"])
    catalogo["exemplos"] = [e for e in catalogo["exemplos"] if e.get("conjunto") != "composto"]
    removidas = antes - len(catalogo["exemplos"])
    catalogo["exemplos"].extend(novas_entradas)

    with open(CATALOGO, "w", encoding="utf-8") as f:
        json.dump(catalogo, f, ensure_ascii=False, indent=2)
    print(f"\n[catalogo] removidas {removidas} entradas antigas de cena composta, acrescentadas {len(novas_entradas)}")


def limpar_arquivos_orfaos() -> None:
    """Apaga PNG/.verdade.json de cena composta de uma rodada anterior antes de
    regerar — evita arquivo órfão se a lista de cenas mudar no futuro."""
    for p in SAIDA.glob("composto-*.png"):
        p.unlink()
    for p in SAIDA.glob("composto-*.verdade.json"):
        p.unlink()


def main() -> None:
    if not RAIZ.exists():
        raise SystemExit(f"Pasta de datasets não encontrada: {RAIZ}")
    SAIDA.mkdir(parents=True, exist_ok=True)
    limpar_arquivos_orfaos()

    estat: dict = {}
    cenas = montar_cenas(estat)
    entradas = [gerar_e_salvar(c) for c in cenas]
    atualizar_catalogo(entradas)

    print("\n--- recortes por conjunto de origem ---")
    for conjunto, e in estat.items():
        descartes = ", ".join(f"{k}={v}" for k, v in e["descartes"].items()) or "nenhum"
        print(f"{conjunto}: {e['aceitas']} aceitos de {e['tentadas']} tentados (descartes: {descartes})")


if __name__ == "__main__":
    main()
