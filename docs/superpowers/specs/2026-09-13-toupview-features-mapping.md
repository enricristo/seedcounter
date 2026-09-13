# Engenharia Reversa e Benchmark: ToupView (AmScope)
**Data:** 2026-09-13
**Documento de Origem:** Análise de Screenshots (Interface ToupView)
**Módulo:** Câmera, Correções Radiométricas e Ferramentas CAD

Este documento mapeia as funcionalidades essenciais identificadas no software de microscopia ToupView e define a arquitetura para sua implementação web-nativa no SeedCounter, utilizando WebGL e aceleração de hardware.

---

## 1. Correções Radiométricas em Tempo Real (Painel Esquerdo)

O ToupView oferece correção de hardware e software que é vital para a qualidade da imagem antes da segmentação.

### 1.1 Correção de Campo Plano (Flat Field Correction - FFC)
* **Objetivo:** Eliminar o gradiente de iluminação (vinheta) e sujeiras na lente/sensor. Fundamental para fenotipagem por cor (Tetrazólio/Patologia) onde a cor deve ser absoluta em qualquer parte da placa.
* **Implementação SeedCounter:** 
  1. **Calibração:** O usuário captura um frame vazio (placa de Petri com papel filtro limpo). Esta é a imagem *Flat* ($F$).
  2. **Subtração via WebGL Fragment Shader:**
     O shader recebe o frame ao vivo ($I$), subtrai o *Dark Frame* ($D$, opcional), e divide pelo *Flat Frame* ($F$).
     $$I_{corrigida} = \frac{I_{raw} - D}{F - D} \times M$$
     Onde $M$ é a média escalar da imagem Flat.
  3. **Performance:** Operação matricial maciça executada a 60 FPS na GPU usando WebGL2, bloqueando $0\%$ da thread principal.

### 1.2 Frequência Energética / Anti-Piscar (Anti-Flicker)
* **Objetivo:** Mitigar as listras horizontais (banding) causadas pela oscilação de 50Hz/60Hz das luzes fluorescentes/LED de bancada interferindo no *rolling shutter* da câmera.
* **Implementação SeedCounter:** 
  Forçar a exposição da câmera para ser um múltiplo exato da frequência local. 
  Via `MediaTrackConstraints`: `exposureTime: 10000` (1/100s para 50Hz) ou `8333` (1/120s para 60Hz).

---

## 2. Motor de Medição Vetorial (Barra de Ferramentas CAD)

A barra superior do ToupView será replicada através de uma arquitetura estrita de `Canvas API` (Vanilla JS) contornando o ciclo de render do React.

### Ferramentas Mapeadas:
* **Calibre (Linhas Paralelas):** O usuário clica em dois pontos formando a linha base de referência (eixo longitudinal da semente) e arrasta a segunda linha paralela para aferir a largura ortogonal ($L_{min}$).
* **Círculo por 3 Pontos:** Útil para aferir o diâmetro de discos foliares ou danos perfeitamente circulares.
* **Cotas Dinâmicas:** As anotações não queimam a imagem. Elas habitam a `Layer 2 (Vetorial)`, serializadas como GeoJSON ou SVG-paths no DuckDB. A conversão de Pixel para Milímetro obedece o perfil de calibração selecionado.

---

## 3. Painel Analítico: Segmentação, Contagem e Histogramas

O rodapé do ToupView apresenta as ferramentas analíticas pós-captura.
* **Histograma Dinâmico:** Um Web Worker escaneia os pixels em background (usando uma versão reduzida 256x256 do frame via `createImageBitmap`) para plotar a curva de luminância e canais RGB. Alerta visualmente sobre "clipping" (pixels puros 0 ou 255).
* **Segmentação & Contagem (O Salto Quântico):** 
  Enquanto o ToupView tradicional depende do usuário achar o *Threshold* perfeito no histograma para separar fundo e semente, o SeedCounter usa a segmentação semântica (YOLO) + Transformada de Distância (Watershed) descrita no plano do *Oráculo Visual*. A "Folha de Medição" (DataGrid) é populada nativamente conectando o DuckDB-Wasm a um componente de grade de dados de alta performance.
