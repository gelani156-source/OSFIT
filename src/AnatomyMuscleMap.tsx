import MuscleMap from './MuscleMap'
import type {Muscle} from './MuscleMap'

/**
 * Совместимый компонент анатомической карты без внешних зависимостей.
 * Использует существующую интерактивную SVG-модель OSFIT.
 */
export default function AnatomyMuscleMap({
  loads,
  sex = 'male',
}: {
  loads: Record<Muscle, number>
  sex?: 'male' | 'female'
}) {
  return <MuscleMap loads={loads} sex={sex} />
}
