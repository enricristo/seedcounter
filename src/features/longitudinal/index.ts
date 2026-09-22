// Sob demanda: só a vista Longitudinal depende do `recharts` — os dois modais
// não, e continuam estáticos. Ver `lib/sob-demanda.tsx`.
import { sobDemanda } from '../../lib/sob-demanda';

export const LongitudinalView = sobDemanda(() => import('./LongitudinalView').then((m) => m.LongitudinalView));
export { ExperimentModal } from './ExperimentModal';
export { PlateRunModal } from './PlateRunModal';
