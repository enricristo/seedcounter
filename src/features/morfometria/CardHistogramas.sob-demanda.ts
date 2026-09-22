// O cartão de histogramas é o único da morfometria que usa `recharts`; os de
// estatísticas, volumes e regras são tabelas. `RightSidebar` importa daqui
// para que a biblioteca só chegue quando a aba Resultados mostra o cartão.
// Ver `lib/sob-demanda.tsx`.
import { sobDemanda } from '../../lib/sob-demanda';

export const CardHistogramas = sobDemanda(() => import('./CardHistogramas').then((m) => m.CardHistogramas));
