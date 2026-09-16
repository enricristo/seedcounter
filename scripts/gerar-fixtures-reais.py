"""
Task A4 (Degrau 2, Lote A): gera os fixtures reais (soja + orquídea), recortados
com a verdade recortada junto, para virarem teste de regressão sobre imagem
real -- não sobre a cena sintética, cuja textura é falsa demais (o README dos
datasets já registra dois critérios que passaram no sintético e caíram na soja
real).

Sem OpenCV nem scipy (não instalados neste ambiente). Componentes conexos e
traçado de contorno são escritos à mão sobre numpy puro.

DESVIO DE PLANO, DECLARADO AQUI E NO README DOS FIXTURES: o plano pedia um
recorte 512x512 da digitalização NATIVA da soja contendo entre 8 e 20 sementes
inteiras. Medido neste script (ver validar_espacamento_impossivel() abaixo, e
os números no README): o espaçamento real entre sementes vizinhas na bandeja é
~483 px (mediana, digitalização Anjasmoro002.jpg), e o próprio comentário de
`region-growing.ts` documenta que uma semente de soja mede ~261 px de diâmetro
a ~950 dpi. Num recorte de 512x512 NATIVO isso permite no máximo 1-2 sementes
inteiras -- nunca 8. É geometria da bandeja, não escolha de parâmetro: a
grade foi montada à mão com espaçamento maior que qualquer recorte de 512 px
poderia cobrir com uma dezena de sementes.

A saída adotada -- e compatível com o próprio teste-esqueleto do plano, que já
usa `janela: 160` (não 512) ao chamar `segmentarPorClique` sobre o fixture --
é reduzir a digitalização por um fator fixo ANTES de recortar os 512 px.

Testado 4x e 3x (ver README do fixture para os números completos): a 4x o
espaçamento cai a ~121 px e cabem 8 sementes na janela, mas o filtro BOX da
redução borra a borda o bastante para a onda quase sempre "tocar a borda"
(baixa confiança) e nunca passar de IoU 0,8. A 3x (padrão adotado) a mesma
digitalização ainda cabe 8 sementes inteiras na janela, e a borda fica nítida
o bastante para a onda nunca tocar a borda com `janela: 160` -- o número
medido (registrado no teste, não escondido) é 2 de 8 com IoU > 0,8. A verdade
continua sendo a máscara por limiar de cor, só que medida na resolução
reduzida -- e é conferida a olho antes de virar fixture (ver Step 2 da
tarefa: abrir os PNG gerados).
"""
from __future__ import annotations

import argparse
import json
import os
from collections import deque

import numpy as np
from PIL import Image

# =============================================================================
# Lab (espelha rgbParaLab de src/lib/color-features.ts) -- vetorizado em numpy
# para poder rodar sobre a digitalização inteira sem um laço por pixel.
# =============================================================================

_LINEAR = np.array(
    [((c / 255.0) / 12.92 if c / 255.0 <= 0.04045 else ((c / 255.0 + 0.055) / 1.055) ** 2.4) for c in range(256)],
    dtype=np.float64,
)


def rgb_para_lab(rgb: np.ndarray) -> np.ndarray:
    """rgb: array (..., 3) uint8. Devolve array (..., 3) float64 com [L, a*, b*]."""
    r = _LINEAR[rgb[..., 0]]
    g = _LINEAR[rgb[..., 1]]
    b = _LINEAR[rgb[..., 2]]

    x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
    z = r * 0.0193339 + g * 0.119192 + b * 0.9503041

    xr, yr, zr = x / 0.95047, y / 1.0, z / 1.08883

    def t116(t):
        return np.where(t > 216 / 24389, np.cbrt(t), (24389 / 27 * t + 16) / 116)

    fx, fy, fz = t116(xr), t116(yr), t116(zr)
    L = 116 * fy - 16
    a = 500 * (fx - fy)
    bb = 200 * (fy - fz)
    return np.stack([L, a, bb], axis=-1)


# =============================================================================
# Componentes conexos 4-vizinhos, escrito à mão (sem scipy.ndimage.label)
# =============================================================================


def rotular_componentes(mascara: np.ndarray) -> tuple[np.ndarray, int]:
    """BFS simples sobre uma máscara booleana (H, W). Devolve (rótulos, n)."""
    h, w = mascara.shape
    rotulos = np.zeros((h, w), dtype=np.int32)
    atual = 0
    for y in range(h):
        linha = mascara[y]
        if not linha.any():
            continue
        for x in range(w):
            if not mascara[y, x] or rotulos[y, x]:
                continue
            atual += 1
            fila = deque([(y, x)])
            rotulos[y, x] = atual
            while fila:
                cy, cx = fila.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mascara[ny, nx] and not rotulos[ny, nx]:
                        rotulos[ny, nx] = atual
                        fila.append((ny, nx))
    return rotulos, atual


# =============================================================================
# Traçado de contorno (Moore-neighbor, 8-conectado) -- mesmo algoritmo do
# script da Task A0 (medir_limiar_populacao_soja.py), reaproveitado aqui só
# para a validação de sanidade; os fixtures em si não precisam do contorno
# em coordenadas de polígono, o teste chama `segmentarPorClique` na hora.
# =============================================================================

_VIZINHOS = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]


def tracar_contorno_externo(mascara_bin: np.ndarray) -> list[list[float]]:
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
        idx_ini = (_VIZINHOS.index(d) + 1) % 8
        achou = None
        for k in range(8):
            idx = (idx_ini + k) % 8
            dr, dc = _VIZINHOS[idx]
            nr, nc = atual[0] + dr, atual[1] + dc
            if pad[nr, nc]:
                achou = (nr, nc)
                idx_achado = idx
                break
        if achou is None:
            break
        dr2, dc2 = _VIZINHOS[(idx_achado - 1) % 8]
        retrocesso = (atual[0] + dr2, atual[1] + dc2)
        atual = achou
        passos += 1
        if atual == inicio:
            break
        contorno_rc.append(atual)
        if passos > max_passos:
            break
    return [[float(c - 1), float(r - 1)] for (r, c) in contorno_rc]


# =============================================================================
# Soja: digitalização inteira -> reduzida -> limiar de cor -> componentes ->
# janela 512 por varredura
# =============================================================================


def gerar_fixture_soja(caminho_scan: str, out_dir: str, downscale: int, limiar_delta_e: float) -> dict:
    im = Image.open(caminho_scan).convert("RGB")
    w0, h0 = im.size
    reduzida = im.resize((w0 // downscale, h0 // downscale), Image.BOX)
    rgb = np.array(reduzida)
    h, w = rgb.shape[:2]

    lab = rgb_para_lab(rgb)
    # Referência de fundo: mediana da imagem inteira. A bandeja cinza domina a
    # área (a maioria das sementes é bem menor que o vão entre elas), então a
    # mediana global já é uma estimativa robusta do fundo sem precisar de uma
    # amostra separada.
    ref = np.median(lab.reshape(-1, 3), axis=0)
    delta_e = np.sqrt(((lab - ref) ** 2).sum(axis=-1))
    mascara_fg = delta_e > limiar_delta_e

    rotulos, n = rotular_componentes(mascara_fg)

    # Remove manchas pequenas (poeira, borda do papel, ruído de JPEG) --
    # sementes reais nesta escala têm bem mais que isso de área.
    area_minima = 300
    tamanhos = np.bincount(rotulos.ravel())
    validos = {i for i in range(1, n + 1) if tamanhos[i] >= area_minima}

    # Caixa delimitadora de cada componente válido, para o teste de
    # "cabe inteiro na janela" (equivalente a exigir que nenhum pixel da
    # máscara caia fora da janela, já que o componente é simplesmente conexo).
    ys, xs = np.nonzero(rotulos)
    bboxes: dict[int, tuple[int, int, int, int]] = {}
    for y, x in zip(ys, xs):
        lab_id = int(rotulos[y, x])
        if lab_id not in validos:
            continue
        if lab_id not in bboxes:
            bboxes[lab_id] = (y, y, x, x)
        else:
            y0, y1, x0, x1 = bboxes[lab_id]
            bboxes[lab_id] = (min(y0, y), max(y1, y), min(x0, x), max(x1, x))

    janela = 512
    stride = 16
    escolhido = None
    # Varredura determinística: primeira janela que satisfaz, não sorteio.
    for wy in range(0, max(1, h - janela + 1), stride):
        for wx in range(0, max(1, w - janela + 1), stride):
            cheios = [
                lab_id
                for lab_id, (y0, y1, x0, x1) in bboxes.items()
                if y0 >= wy and y1 < wy + janela and x0 >= wx and x1 < wx + janela
            ]
            if 8 <= len(cheios) <= 20:
                escolhido = (wy, wx, cheios)
                break
        if escolhido:
            break

    if escolhido is None:
        raise RuntimeError(
            "Nenhuma janela 512x512 (na resolução reduzida) contém entre 8 e 20 "
            "sementes inteiras. Ajuste --downscale ou --limiar-delta-e."
        )

    wy, wx, cheios = escolhido
    crop_rgb = rgb[wy : wy + janela, wx : wx + janela].copy()
    crop_rot = rotulos[wy : wy + janela, wx : wx + janela]

    # Fundo local: mediana dos pixels de fundo DENTRO da janela, de reserva
    # para quando a vizinhança imediata de um recorte não tiver fundo
    # suficiente (ex.: semente cortada bem no canto da janela).
    fundo_da_janela = np.median(crop_rgb[crop_rot == 0].reshape(-1, 3), axis=0).astype(np.uint8)

    # Componentes que tocam a janela mas não cabem inteiros: ficam fora da
    # verdade, e a região deles na imagem é pintada com o fundo -- para não
    # haver semente visível sem rótulo (regra do plano). A janela mistura duas
    # texturas de fundo (a tira de papel branco no topo da digitalização e a
    # bandeja cinza) -- pintar com a mediana da JANELA INTEIRA deixaria um
    # remendo de tom errado se o corte cair na bandeja. Em vez disso, cada
    # corte usa a mediana do fundo numa VIZINHANÇA local (anel ao redor do
    # próprio recorte), que está sempre na mesma textura.
    presentes = set(np.unique(crop_rot)) - {0}
    cortados = presentes - set(cheios)
    for lab_id in cortados:
        objeto = crop_rot == lab_id
        ys_o, xs_o = np.nonzero(objeto)
        y0, y1 = max(0, ys_o.min() - 20), min(janela, ys_o.max() + 21)
        x0, x1 = max(0, xs_o.min() - 20), min(janela, xs_o.max() + 21)
        vizinhanca_rot = crop_rot[y0:y1, x0:x1]
        vizinhanca_rgb = crop_rgb[y0:y1, x0:x1]
        fundo_pixels = vizinhanca_rgb[vizinhanca_rot == 0]
        fundo_do_corte = (
            np.median(fundo_pixels.reshape(-1, 3), axis=0).astype(np.uint8)
            if fundo_pixels.size > 0
            else fundo_da_janela
        )
        crop_rgb[objeto] = fundo_do_corte

    # Reindexação para 1..K contíguo, na ordem de descoberta (esquerda->direita,
    # cima->baixo), para o PNG de 8 bits ficar compacto e determinístico.
    cheios_ordenados = sorted(cheios, key=lambda i: (bboxes[i][0], bboxes[i][2]))
    final_rot = np.zeros_like(crop_rot, dtype=np.uint8)
    objetos = []
    for novo_id, antigo_id in enumerate(cheios_ordenados, start=1):
        m = crop_rot == antigo_id
        final_rot[m] = novo_id
        ys_o, xs_o = np.nonzero(m)
        objetos.append(
            {
                "id": novo_id,
                "centro": [float(xs_o.mean()), float(ys_o.mean())],
                "areaPx": int(m.sum()),
            }
        )

    os.makedirs(out_dir, exist_ok=True)
    Image.fromarray(crop_rgb, mode="RGB").save(os.path.join(out_dir, "soja-512.png"))
    Image.fromarray(final_rot, mode="L").save(os.path.join(out_dir, "soja-512.rotulos.png"))

    meta = {
        "origem": {
            "fonte": "Image Dataset of Local Indonesian Soybean Seed Var (Mendeley, c733bjz4m3)",
            "arquivo": os.path.basename(caminho_scan),
            "licenca": "a conferir (Enrico)",
        },
        "janela": {"x": wx, "y": wy},
        "reducao": downscale,
        "limiar_delta_e": limiar_delta_e,
        "escala_um_por_px": None,  # dpi da digitalização é aproximado (~800-950) na fonte, não exato -- ver README
        "verdade": "mascara-por-limiar-de-cor-conferida-visualmente",
        "objetos": objetos,
    }
    with open(os.path.join(out_dir, "soja-512.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[soja] janela reduzida escolhida: y={wy} x={wx}, {len(objetos)} sementes inteiras")
    print(f"[soja] fundo da janela estimado: {tuple(int(c) for c in fundo_da_janela)}")
    return meta


# =============================================================================
# Orquídea: recorte de uma imagem já anotada (YOLO segmentação), sem máscara --
# a verdade é o polígono humano, e o script só recorta e translada coordenadas.
# =============================================================================


def gerar_fixture_orquidea(caminho_imagem: str, caminho_label: str, out_dir: str, tamanho_img: float) -> dict:
    with open(caminho_label, "r", encoding="utf-8") as f:
        linhas = [l.strip().split() for l in f if l.strip()]

    contornos = []
    for partes in linhas:
        if len(partes) < 7:
            continue
        classe = int(partes[0])
        vals = [float(x) for x in partes[1:]]
        pts = [(vals[i] * tamanho_img, vals[i + 1] * tamanho_img) for i in range(0, len(vals), 2)]
        if len(pts) >= 3:
            contornos.append((classe, pts))

    janela = 512
    stride = 16
    escolhido = None
    largura_img = altura_img = int(tamanho_img)
    for wy in range(0, max(1, altura_img - janela + 1), stride) if altura_img > janela else [0]:
        for wx in range(0, max(1, largura_img - janela + 1), stride) if largura_img > janela else [0]:
            cheios = []
            for classe, pts in contornos:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                if min(xs) >= wx and max(xs) <= wx + janela and min(ys) >= wy and max(ys) <= wy + janela:
                    cheios.append((classe, pts))
            if 10 <= len(cheios) <= 30:
                escolhido = (wy, wx, cheios)
                break
        if escolhido:
            break

    if escolhido is None:
        raise RuntimeError(
            f"Nenhuma janela {janela}x{janela} em {caminho_label} contém entre 10 e 30 polígonos inteiros."
        )

    wy, wx, cheios = escolhido
    im = Image.open(caminho_imagem).convert("RGB")
    crop = im.crop((wx, wy, wx + janela, wy + janela))

    os.makedirs(out_dir, exist_ok=True)
    crop.save(os.path.join(out_dir, "orquidea-512.png"))

    nomes_classe = ["inviavel", "viavel"]
    objetos = []
    for i, (classe, pts) in enumerate(cheios, start=1):
        poligono = [[round(x - wx, 2), round(y - wy, 2)] for x, y in pts]
        objetos.append({"id": i, "classe": nomes_classe[classe] if classe < len(nomes_classe) else classe, "poligono": poligono})

    meta = {
        "origem": {
            "fonte": "Sementes de Orquideas (Roboflow, sementes-de-orqudea/sementes-de-orquideas, v8)",
            "arquivo": os.path.basename(caminho_imagem),
            "licenca": "CC BY 4.0",
        },
        "janela": {"x": wx, "y": wy},
        "escala_um_por_px": None,
        "verdade": "poligono-humano",
        "objetos": objetos,
    }
    with open(os.path.join(out_dir, "orquidea-512.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[orquidea] janela escolhida: y={wy} x={wx}, {len(objetos)} polígonos inteiros")
    return meta


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--soja-scan", required=True, help="Caminho para uma digitalização completa (Scanned_*/**.jpg)")
    ap.add_argument("--orquidea-imagem", required=True, help="Caminho para a imagem de treino (train/images/*.jpg)")
    ap.add_argument("--orquidea-label", required=True, help="Caminho para o .txt YOLO correspondente (train/labels)")
    ap.add_argument("--out", default=os.path.join("src", "lib", "__tests__", "fixtures"))
    ap.add_argument("--downscale", type=int, default=3, help="Fator de redução da digitalização de soja antes do recorte")
    ap.add_argument("--limiar-delta-e", type=float, default=15.0, help="ΔE (aprox., ver nota) acima do qual o pixel é semente")
    ap.add_argument("--tamanho-img-orquidea", type=float, default=946.0, help="Lado da imagem de treino, em px (conforme docs/datasets/README.md)")
    args = ap.parse_args()

    gerar_fixture_soja(args.soja_scan, args.out, args.downscale, args.limiar_delta_e)
    gerar_fixture_orquidea(args.orquidea_imagem, args.orquidea_label, args.out, args.tamanho_img_orquidea)


if __name__ == "__main__":
    main()
