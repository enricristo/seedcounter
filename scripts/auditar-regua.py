"""
Auditoria da régua (C3.2): o DPI declarado do scanner é o DPI EFETIVO?

Por que existe: `dpiToUmPerPixel` (src/lib/calibration.ts) converte px em
µm a partir de um número declarado — 3600 DPI para o HP Scanjet G2710do
laboratório (DEFAULT_LAB_DPI). Isso pressupõe que o scanner realmente grava
naquela resolução. Scanners às vezes interpolam ou reamostram, e o número no
driver vira uma promessa não verificada. As digitalizações `digitalizarXXXX`
em `datasets/images/digitalizar_scan/` têm uma régua de verdade dentro do
campo — dá para medir e comparar contra a promessa.

MÉTODO: perfil de intensidade ao longo da régua, na faixa de y onde só as
marcas de milímetro aparecem (evita a faixa dos algarismos, que é textura
demais para um detector simples). Para cada coluna, conta quantas linhas
daquela faixa são mais escuras que um limiar (percentil baixo da própria
faixa) — uma marca de régua é uma linha vertical curta e contínua, então essa
contagem tem um pico nítido em cada marca; grão de papel/JPEG é ruído
disperso e não. Agrupa picos vizinhos (a marca tem alguns pixels de largura),
pega o centro de cada grupo, e a mediana da distância entre marcas
consecutivas dá o passo em px — aqui presumido 1 mm por marca (confirmado a
olho: o espaçamento bate com a distância entre os algarismos de centímetro
vizinhos, que valem 10 marcas).

Se a faixa (y0,y1,x0,x1) não isolar bem as marcas nesta imagem, RECORRA ao
modo manual (--manual-px): meça à mão duas marcas de 10 mm com a ferramenta
Read (ela devolve o fator de escala da imagem exibida) e passe a distância em
px — o script só faz a comparação e o relatório, sem tentar detectar nada.

Uso:
  python scripts/auditar-regua.py <imagem> --y0 700 --y1 1400 --x0 0 --x1 9000
  python scripts/auditar-regua.py <imagem> --manual-px 1895.3
  python scripts/auditar-regua.py <imagem> --manual-px 1895.3 --dpi 3600

Requer: Pillow, numpy (sem OpenCV).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MICRONS_POR_POLEGADA = 25_400.0


def dpi_para_um_por_pixel(dpi: float) -> float:
    """Mesma conta de `dpiToUmPerPixel` em src/lib/calibration.ts."""
    if not dpi or dpi <= 0:
        return 0.0
    return MICRONS_POR_POLEGADA / dpi


def um_por_pixel_para_dpi(um_per_pixel: float) -> float:
    if not um_per_pixel or um_per_pixel <= 0:
        return 0.0
    return MICRONS_POR_POLEGADA / um_per_pixel


def detectar_passo_da_regua(
    caminho_imagem: Path, y0: int, y1: int, x0: int, x1: int, gap_agrupamento: int = 20
) -> tuple[float, list[float]]:
    """
    Devolve (passo_mediano_px, centros_das_marcas). `passo` é a distância
    mediana entre marcas consecutivas, presumida como 1 mm — quem chama
    multiplica por 10 para os 10 mm que a auditoria compara.
    """
    im = Image.open(caminho_imagem).convert('L')
    arr = np.asarray(im, dtype=np.float64)
    faixa = arr[y0:y1, x0:x1]
    if faixa.size == 0:
        raise ValueError(f'faixa vazia: y=({y0},{y1}) x=({x0},{x1}) — confira os limites')

    limiar = np.percentile(faixa, 15)
    escuro = faixa < limiar
    contagem_por_coluna = escuro.sum(axis=0).astype(np.float64)

    # Suaviza (janela de 3) só para não perder um pico por causa de 1 px ruim.
    kernel = np.ones(3) / 3
    suave = np.convolve(contagem_por_coluna, kernel, mode='same')

    limiar_pico = suave.mean() + 1.5 * suave.std()
    indices_pico = [
        i
        for i in range(1, len(suave) - 1)
        if suave[i] >= suave[i - 1] and suave[i] >= suave[i + 1] and suave[i] > limiar_pico
    ]
    if not indices_pico:
        raise ValueError(
            'nenhum pico encontrado — a faixa (y0,y1) provavelmente não isola as marcas '
            'nesta imagem; use --manual-px'
        )

    # Agrupa índices vizinhos em um só centro — uma marca real tem bordas
    # antisserrilhadas e o meio nem sempre fica "escuro" em toda coluna, então
    # um gap pequeno (8 px) partia UMA marca em duas; 20 px funde a marca
    # inteira sem fundir duas marcas vizinhas (que ficam a ~190 px).
    grupos: list[list[int]] = [[indices_pico[0]]]
    for i in indices_pico[1:]:
        if i - grupos[-1][-1] <= gap_agrupamento:
            grupos[-1].append(i)
        else:
            grupos.append([i])
    centros = [x0 + float(np.mean(g)) for g in grupos]

    if len(centros) < 3:
        raise ValueError(
            f'só {len(centros)} marca(s) detectada(s) — poucas para medir passo; use --manual-px'
        )

    distancias = np.diff(centros)
    passo_mediano = float(np.median(distancias))
    return passo_mediano, centros


def relatorio(
    imagem: str,
    px_por_10mm: float,
    dpi_declarado: float,
    origem: str,
) -> str:
    um_por_pixel_medido = 10_000.0 / px_por_10mm  # 10 mm = 10 000 µm
    dpi_efetivo = um_por_pixel_para_dpi(um_por_pixel_medido)

    um_por_pixel_declarado = dpi_para_um_por_pixel(dpi_declarado)
    px_por_10mm_esperado = 10_000.0 / um_por_pixel_declarado if um_por_pixel_declarado else 0.0

    desvio_pct = (
        100.0 * (px_por_10mm - px_por_10mm_esperado) / px_por_10mm_esperado
        if px_por_10mm_esperado
        else float('nan')
    )

    linhas = [
        f'Imagem: {imagem}',
        f'Origem da medida: {origem}',
        f'DPI declarado: {dpi_declarado:.0f}  ->  {px_por_10mm_esperado:.1f} px esperados para 10 mm '
        f'(dpiToUmPerPixel: {um_por_pixel_declarado:.4f} µm/px)',
        f'Medido na régua: {px_por_10mm:.1f} px para 10 mm  ->  {um_por_pixel_medido:.4f} µm/px '
        f'-> DPI efetivo {dpi_efetivo:.0f}',
        f'Desvio: {desvio_pct:+.1f}%',
    ]
    if abs(desvio_pct) > 1.0:
        linhas.append(
            'REGRA (> 1%): o DPI declarado NÃO é o DPI efetivo. O app deveria avisar quando a '
            'calibração usar o método "dpi" (calibration.ts, method="dpi") em vez de aceitar o '
            'número do driver sem checagem — por exemplo, sugerindo o método "reference" (régua '
            'na própria imagem) sempre que uma régua estiver visível, ou marcando a amostra com '
            'um aviso de "escala não conferida" no relatório exportado.'
        )
    else:
        linhas.append('Dentro de 1%: o DPI declarado pode ser usado como efetivo.')
    return '\n'.join(linhas)


def main() -> int:
    # Console do Windows costuma abrir em cp1252; sem isto, os acentos do
    # relatório (µ, ç, ã...) viram "?" ou erro de encoding.
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, ValueError):
        pass

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('imagem', type=Path, help='Caminho da digitalização (digitalizarXXXX.jpg)')
    ap.add_argument('--dpi', type=float, default=3600.0, help='DPI declarado (padrão: 3600, DEFAULT_LAB_DPI)')
    ap.add_argument('--y0', type=int, default=700, help='Início (linha) da faixa das marcas de mm')
    ap.add_argument('--y1', type=int, default=1400, help='Fim (linha) da faixa das marcas de mm')
    ap.add_argument('--x0', type=int, default=0, help='Início (coluna) da busca')
    ap.add_argument('--x1', type=int, default=9000, help='Fim (coluna) da busca')
    ap.add_argument(
        '--manual-px',
        type=float,
        default=None,
        help='Pula a detecção automática: usa esta distância (px) medida à mão para 10 mm',
    )
    args = ap.parse_args()

    if not args.imagem.exists():
        print(f'Arquivo não encontrado: {args.imagem}', file=sys.stderr)
        return 1

    if args.manual_px is not None:
        px_por_10mm = args.manual_px
        origem = 'medida manual (--manual-px)'
    else:
        passo_mm, centros = detectar_passo_da_regua(args.imagem, args.y0, args.y1, args.x0, args.x1)
        px_por_10mm = passo_mm * 10
        origem = f'detecção automática ({len(centros)} marcas de 1 mm, passo mediano {passo_mm:.2f} px)'

    print(relatorio(str(args.imagem), px_por_10mm, args.dpi, origem))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
