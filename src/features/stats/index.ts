// Sob demanda: a vista de Estatísticas é uma aba inteira de gráficos
// (`recharts`), e quem só conta nunca a abre. Ver `lib/sob-demanda.tsx`.
import { sobDemanda } from '../../lib/sob-demanda';

export const StatsView = sobDemanda(() => import('./StatsView').then((m) => m.StatsView));
