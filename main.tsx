import {useState} from 'react'
import type {Workout,ExerciseLine} from './model'
export type Muscle = 'chest'|'shoulders'|'biceps'|'triceps'|'abs'|'back'|'traps'|'glutes'|'quads'|'hamstrings'|'calves'
export const labels:Record<Muscle,string>={chest:'Грудные',shoulders:'Дельты',biceps:'Бицепс',triceps:'Трицепс',abs:'Пресс',back:'Спина',traps:'Трапеции',glutes:'Ягодицы',quads:'Квадрицепс',hamstrings:'Задняя поверхность бедра',calves:'Икроножные'}
const muscleKeys=Object.keys(labels) as Muscle[]
export function classify(name:string):Muscle[]{const n=name.toLowerCase();
 if(/жим.*(леж|груд|гантел)|отжиман|брусья|разведени.*леж/.test(n))return ['chest','triceps','shoulders']
 if(/жим.*(стоя|сидя|вверх)|дельт|махи|разведени.*сторон/.test(n))return ['shoulders','triceps']
 if(/присед|жим ног|выпад|разгибание ног/.test(n))return ['quads','glutes']
 if(/станов|румын|сгибани.*ног/.test(n))return ['hamstrings','glutes','back']
 if(/подтяг|тяга.*(блок|штанг|гантел)|гребл|лодочк|гиперэкстенз/.test(n))return ['back','biceps']
 if(/шраг/.test(n))return ['traps']
 if(/бицеп|сгибани.*рук/.test(n))return ['biceps']
 if(/трицеп|разгибани.*рук|француз/.test(n))return ['triceps']
 if(/пресс|скручив|планк|подъем ног|подъём ног/.test(n))return ['abs']
 if(/икр|носочк|носк/.test(n))return ['calves']
 return []}
export function muscleLoad(workouts:Workout[]):Record<Muscle,number>{const o=Object.fromEntries(muscleKeys.map(k=>[k,0])) as Record<Muscle,number>;for(const w of workouts)for(const e of w.exercises){const types=classify(e.name);const sets=e.sets.filter(s=>s.done).length;for(const m of types)o[m]+=sets}return o}
export function exerciseMuscleLoad(exercises:ExerciseLine[]):Record<Muscle,number>{const o=Object.fromEntries(muscleKeys.map(k=>[k,0])) as Record<Muscle,number>;for(const e of exercises){for(const m of classify(e.name))o[m]+=e.sets.filter(s=>s.done).length}return o}
const parts:{key:Muscle,side:'front'|'back'|'both',shapes:[number,number,number,number][]}[]=[
 {key:'traps',side:'back',shapes:[[100,65,35,15]]},
 {key:'shoulders',side:'both',shapes:[[62,83,17,23],[138,83,17,23]]},
 {key:'chest',side:'front',shapes:[[82,97,25,25],[118,97,25,25]]},
 {key:'biceps',side:'front',shapes:[[48,132,12,29],[152,132,12,29]]},
 {key:'triceps',side:'back',shapes:[[48,131,12,28],[152,131,12,28]]},
 {key:'abs',side:'front',shapes:[[100,154,26,45]]},
 {key:'back',side:'back',shapes:[[81,121,24,42],[119,121,24,42]]},
 {key:'glutes',side:'back',shapes:[[84,207,20,22],[116,207,20,22]]},
 {key:'quads',side:'front',shapes:[[83,259,19,49],[117,259,19,49]]},
 {key:'hamstrings',side:'back',shapes:[[83,258,19,48],[117,258,19,48]]},
 {key:'calves',side:'both',shapes:[[83,340,12,35],[117,340,12,35]]}
]
export default function MuscleMap({loads}:{loads:Record<Muscle,number>}){const [side,setSide]=useState<'front'|'back'>('front');const [selected,setSelected]=useState<Muscle|null>(null);const max=Math.max(1,...Object.values(loads));return <div className="muscle-layout"><div className="muscle-toolbar"><button className={side==='front'?'active':''} onClick={()=>setSide('front')}>Спереди</button><button className={side==='back'?'active':''} onClick={()=>setSide('back')}>Сзади</button></div><svg viewBox="0 0 200 410" className="muscle-svg" role="img" aria-label="Интерактивная схема мышечных групп"><g fill="#242f39" stroke="#566777" strokeWidth="2"><ellipse cx="100" cy="35" rx="23" ry="29"/><rect x="90" y="57" width="20" height="18" rx="6"/><path d="M72 75 Q100 64 128 75 L144 112 124 188 133 218 113 224 100 209 87 224 67 218 76 188 56 112Z"/><rect x="37" y="84" width="23" height="126" rx="11" transform="rotate(10 48 85)"/><rect x="140" y="84" width="23" height="126" rx="11" transform="rotate(-10 152 85)"/><rect x="65" y="208" width="31" height="175" rx="14"/><rect x="104" y="208" width="31" height="175" rx="14"/></g>{parts.filter(p=>p.side===side||p.side==='both').map(p=>p.shapes.map(([x,y,rx,ry],i)=>{const v=loads[p.key];const intensity=v/max;return <ellipse key={p.key+i} cx={x} cy={y} rx={rx} ry={ry} fill={v>0?`rgba(143,235,172,${0.28+0.67*intensity})`:'#35414c'} stroke={selected===p.key?'#fff':'#617584'} strokeWidth={selected===p.key?2.5:1} style={{cursor:'pointer'}} onClick={()=>setSelected(p.key)}><title>{labels[p.key]} · {v} подходов</title></ellipse>}))}</svg><div className="muscle-caption">{selected?`${labels[selected]} · ${loads[selected]} выполненных подходов`:'Нажми на мышцу, чтобы увидеть нагрузку'}</div><div className="muscle-legend">{muscleKeys.map(key=><button key={key} onClick={()=>{setSelected(key);setSide(['back','traps','glutes','hamstrings'].includes(key)?'back':'front')}} className={selected===key?'active':''}><span>{labels[key]}</span><b>{loads[key]}</b></button>)}</div><p className="muted small">Схема условная: подсветка рассчитывается по названиям упражнений и количеству выполненных подходов, а не измеряет физиологическую активацию мышц.</p></div>}
