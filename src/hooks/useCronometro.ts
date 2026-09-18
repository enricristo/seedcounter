import { useCallback, useEffect, useRef, useState } from 'react';
import {
  iniciarCronometro,
  registrarInteracao,
  pausar,
  retomar,
  declararModo,
  lerTempo,
  type EstadoDoCronometro,
  type ModoDeAnalise,
  type TempoDaAnalise,
} from '../lib/cronometro-de-analise';

/**
 * O cronômetro da cena, ligado aos sinais reais do navegador.
 *
 * O módulo puro decide o que conta como trabalho; este hook só entrega a ele
 * os acontecimentos: a pessoa mexeu, a aba sumiu, a aba voltou.
 *
 * TRÊS DECISÕES QUE PARECEM DETALHE E NÃO SÃO.
 *
 * 1. Os ouvintes são PASSIVOS e na fase de captura, no `window`. Passivos
 *    porque o cronômetro jamais pode atrasar um arrasto de contorno; em
 *    captura porque um clique que o canvas consome (e ele consome quase todos)
 *    nunca subiria até o `window` na fase de borbulha, e a pessoa estaria
 *    trabalhando com o relógio parado.
 *
 * 2. O estado vive num ref, e só o que a tela mostra vai para o `useState`.
 *    Um `setState` por movimento de ponteiro renderizaria o aplicativo inteiro
 *    dezenas de vezes por segundo — o instrumento de medida virando a causa da
 *    lentidão que ele deveria medir.
 *
 * 3. Trocar de imagem ZERA. O tempo é por cena: é "quanto custou esta
 *    amostra", não "há quanto tempo o aplicativo está aberto". Somar duas
 *    imagens num número só destruiria justamente a comparação que motivou o
 *    cronômetro.
 */
export function useCronometro(chaveDaCena: string, modoInicial: ModoDeAnalise = 'assistida') {
  const estado = useRef<EstadoDoCronometro>(iniciarCronometro(modoInicial));
  // Só para a tela. O número de verdade sai de `ler()`, que lê o ref.
  const [mostrado, setMostrado] = useState<TempoDaAnalise>(() =>
    lerTempo(estado.current, Date.now())
  );

  const ler = useCallback((): TempoDaAnalise => lerTempo(estado.current, Date.now()), []);

  // Troca de cena: zera. Ver decisão 3.
  useEffect(() => {
    estado.current = iniciarCronometro(estado.current.modo);
    setMostrado(lerTempo(estado.current, Date.now()));
  }, [chaveDaCena]);

  useEffect(() => {
    const mexeu = () => {
      estado.current = registrarInteracao(estado.current, Date.now());
    };
    const visibilidade = () => {
      const agora = Date.now();
      estado.current =
        document.visibilityState === 'hidden'
          ? pausar(estado.current, agora)
          : retomar(estado.current, agora);
      setMostrado(lerTempo(estado.current, agora));
    };

    // Sem anotar o tipo: a configuração do eslint não conhece
    // `AddEventListenerOptions` como global, e o TypeScript infere o tipo
    // certo do literal sozinho.
    const opcoes = { passive: true, capture: true } as const;
    const eventos = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;
    for (const e of eventos) window.addEventListener(e, mexeu, opcoes);
    document.addEventListener('visibilitychange', visibilidade);
    // Sair da página é o fim da medição: sem isto, o último trecho ficaria
    // aberto e o tempo da última amostra nunca seria contado.
    window.addEventListener('pagehide', visibilidade);

    // A tela atualiza uma vez por segundo, e não a cada evento — é o que o
    // olho lê, e desacopla o custo de renderizar do ritmo de quem trabalha.
    const tique = window.setInterval(() => setMostrado(lerTempo(estado.current, Date.now())), 1000);

    return () => {
      for (const e of eventos) window.removeEventListener(e, mexeu, opcoes);
      document.removeEventListener('visibilitychange', visibilidade);
      window.removeEventListener('pagehide', visibilidade);
      window.clearInterval(tique);
    };
  }, []);

  const definirModo = useCallback((modo: ModoDeAnalise) => {
    estado.current = declararModo(estado.current, modo);
    setMostrado(lerTempo(estado.current, Date.now()));
  }, []);

  const zerar = useCallback(() => {
    estado.current = iniciarCronometro(estado.current.modo);
    setMostrado(lerTempo(estado.current, Date.now()));
  }, []);

  return { tempo: mostrado, ler, definirModo, zerar };
}
