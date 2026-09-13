# Estratégia de Performance: WebGL, Canvas e React (60 FPS Strict)
**Data:** 2026-09-13
**Documento de Origem:** `specs/2026-09-13-escala-industrial-arquitetura.md`
**Domínio:** Otimização de Frontend, Edge AI, Computação Gráfica

Este documento é fruto de um brainstorming técnico focado exclusivamente em **Performance Extrema**. Para que o "Oráculo Visual" e o "Focus Peaking" rodem ao vivo na bancada do laboratório sem derreter a bateria de um notebook ou engasgar a interface, o SeedCounter deve adotar as arquiteturas da indústria de *Web Games* (Isométrica/WebGL) e fugir do ciclo tradicional de renderização do React.

---

## 1. O Problema do React no Contexto de Visão Computacional

O React é excelente para o estado da UI (Botões, Menus Radiais, Painéis), mas é **tóxico para a renderização de vídeo ao vivo e máscaras dinâmicas**.
Se atrelarmos o estado do mouse (x, y) ou a máscara preditiva (gerada pelo ONNX) a um `useState` ou `useStore`, forçaremos a Árvore do React a realizar o ciclo de *Reconciliação* a cada frame (16ms). O resultado é *Garbage Collection* excessivo e perda de quadros (Jank).

### Solução: Bypassing the Render Cycle (Transient Updates)
* **Zustand Subscribe:** O `MarkingCanvas.tsx` e o `Toolbar.tsx` não vão reagir a mudanças de estado da forma declarativa tradicional para eventos de alta frequência.
* Usaremos `useStore.subscribe(state => state.mask, renderMaskToCanvas)`. Isso permite injetar os dados brutos no Canvas nativo (Vanilla JS) diretamente, contornando o ciclo de vida do React completamente.

---

## 2. WebGL2 para Focus Peaking e Filtros em Tempo Real

A detecção de bordas (Focus Peaking e Alertas de Zebra para superexposição) requer passar uma matriz de convolução $3 \times 3$ em um quadro de 8 Megapixels a 60 FPS. Tentar fazer isso com `CanvasRenderingContext2D.getImageData()` bloqueia a *Main Thread* por ~120ms (inaceitável).

### Arquitetura de Shaders (Fragment Shaders)
1. O elemento `<video>` invisível recebe o stream da câmera WebRTC (Lupa).
2. O vídeo é enviado como uma textura via `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement)`. *(Zero-copy na maioria dos navegadores modernos)*.
3. Um **Fragment Shader (GLSL)** aplica um operador Laplaciano para calcular a alta frequência espacial (foco).
4. O WebGL desenha o resultado diretamente na tela. O processamento vai de 120ms na CPU para **< 1ms na GPU**.

*Guideline de Bateria:* O Canvas WebGL de Focus Peaking deve ser pausado (via `cancelAnimationFrame`) automaticamente quando a lupa detecta que não há movimento no feed (economia de energia no campo).

---

## 3. OffscreenCanvas e o Oráculo Visual (Thumbnails)

Para mostrar 4 "Janelas de Hipóteses" (miniaturas das diferentes detecções rodando ao mesmo tempo), renderizar máscaras densas na thread principal fará a UI travar (stutter).

### Arquitetura de Renderização Assíncrona
1. Em vez de passar os vetores do YOLO da *Web Worker* para a UI para que a UI desenhe os Canvas laterais, nós passamos o controle dos pequenos `<canvas>` (thumbnails) para os próprios Workers usando **`canvas.transferControlToOffscreen()`**.
2. Cada Worker (YOLO Strict, Watershed, CIELAB) tem seu próprio `OffscreenCanvas`. Ele recebe a imagem, infere a IA, desenha os polígonos/marcas nativamente dentro da thread paralela, e apenas o resultado (via aceleração de hardware) surge na tela.
3. A *Main Thread* (onde o usuário clica e arrasta) permanece em 0% de uso de CPU durante todo o processo pesado de inferência e renderização das predições.

---

## 4. Otimização de Desenho 2D (Isometric Game Math)

Para a Taxonomia (Pie Menus e interação com milhares de sementes), importamos técnicas de jogos isométricos e simulação:
* **Uso de WKB / Path2D com Cache:** Ao invés de redesenhar os polígonos das sementes usando comandos sequenciais (`lineTo`, `bezierCurveTo`) todo quadro, as máscaras de sementes são instanciadas uma única vez em objetos `Path2D` e mantidas em memória (Memoization). Quando o usuário arrasta a tela (Pan/Zoom), o sistema apenas altera a `setTransform` do canvas e manda renderizar o array de `Path2D`, reduzindo o custo de desenho em 90%.
* **QuadTrees para Hover:** Se o laboratório digitaliza 3.000 sementes numa placa, detectar em qual semente o mouse está passando (Hover) exige calcular a distância/intersecção para 3.000 polígonos (O(N)). Usaremos uma estrutura espacial **QuadTree** limitando a busca para $O(\log N)$, de forma que o *Highlight* (brilho ao passar o mouse) e o Menu Radial abram instantaneamente mesmo em placas super-adensadas.

---

## 5. Resumo das Leis de Performance para o Escalonamento

Para manter o "Selo de Qualidade", toda nova feature gráfica obedecerá estas 3 leis:
1. **Regra de React:** Nunca usar `setState` para rastrear o Mouse ou animações ligadas à câmera. Use Refs mutáveis e `requestAnimationFrame`.
2. **Regra de Renderização:** Se for pixel-by-pixel (Filtros, Foco), use **WebGL**. Se for vetor estático (Polígonos YOLO), use **Path2D + QuadTree**.
3. **Regra do Oráculo:** Toda IA e rasterização de previsão roda em **OffscreenCanvas + Web Worker**. O navegador hospedeiro é apenas um "visualizador passivo" do Oráculo.
