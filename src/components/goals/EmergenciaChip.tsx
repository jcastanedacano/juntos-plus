import { SavingsGoal } from '../../types';
import { localeActual } from '../../utils/fxTasas';
import { esFondoEmergencia, mesesCubiertos, normalizarMeses } from '../../utils/fondoEmergencia';

/**
 * «Cubre 1,4 de 3 meses»: lo que dice un fondo de emergencia que un porcentaje
 * no dice. 40% de una meta no le explica a nadie si aguanta un mes sin sueldo.
 * No pinta nada para una meta normal.
 */
export function EmergenciaChip({ goal }: { goal: SavingsGoal }) {
  if (!esFondoEmergencia(goal)) return null;
  const cubre = mesesCubiertos(goal);
  const de = normalizarMeses(goal.mesesCobertura);
  return (
    <span
      title="El objetivo se calcula solo a partir de tus gastos recurrentes"
      style={{
        display: 'block', marginTop: '0.2rem', fontSize: '0.72rem',
        fontVariantNumeric: 'tabular-nums', color: 'var(--goal-text-muted, var(--text-muted))',
      }}
    >
      Cubre {cubre.toLocaleString(localeActual(), { maximumFractionDigits: 1 })} de {de} meses · objetivo automático
    </span>
  );
}
