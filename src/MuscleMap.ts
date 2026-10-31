import type {Workout,ExerciseLine} from './model'
export type Muscle='chest'|'frontDelts'|'sideDelts'|'rearDelts'|'biceps'|'triceps'|'abs'|'back'|'traps'|'glutes'|'quads'|'hamstrings'|'calves'
export const muscleGroupNames:Record<Muscle,string>={chest:'Грудь',frontDelts:'Передняя дельта',sideDelts:'Средняя дельта',rearDelts:'Задняя дельта',biceps:'Бицепс',triceps:'Трицепс',abs:'Пресс',back:'Спина',traps:'Трапеции',glutes:'Ягодицы',quads:'Квадрицепсы',hamstrings:'Задняя поверхность бедра',calves:'Икры'}
export const muscleKeys=Object.keys(muscleGroupNames) as Muscle[]
export type ExerciseMuscles={primary:Muscle|'unknown',secondary:Muscle[]}
/** One classifier for chart, summary, exercise picker, and imported short names. */
export function classifyExercise(value:string):ExerciseMuscles{
 const n=value.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim()
 const r=(pattern:RegExp)=>pattern.test(n)
 if(r(/косичк|трицепс|разгибан.{0,16}рук|француз|pushdown|triceps/))return {primary:'triceps',secondary:[]}
 if(r(/скручив|пресс|планк|подъем ног|подъём ног|crunch/))return {primary:'abs',secondary:[]}
 if(r(/икр|носки|calf/))return {primary:'calves',secondary:[]}
 if(r(/шраг|трапец|shrug/))return {primary:'traps',secondary:[]}
 if(r(/задн.{0,16}дельт|обратн.{0,15}развед|face pull|тяга к лицу|reverse fly/))return {primary:'rearDelts',secondary:['back']}
 if(r(/средн.{0,12}дельт|мах.{0,12}сторон|развед.{0,16}сторон|lateral raise/))return {primary:'sideDelts',secondary:[]}
 if(r(/передн.{0,12}дельт|подъем перед собой|подъём перед собой|front raise/))return {primary:'frontDelts',secondary:[]}
 if(r(/жим.{0,12}ног|leg press|разгибан.{0,10}ног|присед|выпад|квадриц|hack squat/))return {primary:'quads',secondary:['glutes']}
 if(r(/сгибан.{0,10}ног|румын|бицепс бедра|задн.{0,8}бедра/))return {primary:'hamstrings',secondary:['glutes']}
 if(r(/станов|deadlift/))return {primary:'back',secondary:['hamstrings','glutes','traps']}
 if(r(/ягод|глют|hip thrust/))return {primary:'glutes',secondary:[]}
 if(r(/бицепс|сгибан.{0,15}рук|молот|hammer curl/))return {primary:'biceps',secondary:[]}
 if(r(/подтяг|тяга|лодоч|гипер|pulldown|lat pull|\brow\b|спин/))return {primary:'back',secondary:['biceps']}
 if(r(/жим стоя|армей|жим над головой|military press|arnold press|жим сидя/))return {primary:'frontDelts',secondary:['sideDelts','triceps']}
 if(r(/жим|груд|сведени|бабочк|pec deck|bench|chest|отжиман|брусь|разводка|crossover/))return {primary:'chest',secondary:['frontDelts','triceps']}
 if(r(/дельт|плеч/))return {primary:'sideDelts',secondary:[]}
 // Unknown names are not silently assigned to abs/chest.
 return {primary:'unknown',secondary:[]}
}
export function exercisePrimaryGroup(name:string):string{
 const k=classifyExercise(name).primary
 if(k==='unknown')return 'Прочее'
 if(k==='chest')return 'Грудь'
 if(['back','traps'].includes(k))return 'Спина'
 if(['quads','hamstrings','glutes','calves'].includes(k))return 'Ноги'
 if(['frontDelts','sideDelts','rearDelts'].includes(k))return 'Плечи'
 if(['biceps','triceps'].includes(k))return 'Руки'
 return 'Пресс'
}
export function exerciseMuscleLoad(rows:ExerciseLine[],includeSecondary=true):Record<Muscle,number>{
 const total=Object.fromEntries(muscleKeys.map(k=>[k,0])) as Record<Muscle,number>
 for(const e of rows){const count=e.sets.filter(s=>s.done&&s.reps>0).length;if(!count)continue
  const cls=classifyExercise(e.name);if(cls.primary==='unknown')continue;total[cls.primary]+=count
  if(includeSecondary)for(const k of cls.secondary)total[k]+=count*.35
 }
 return total
}
export function primaryGroupSets(rows:ExerciseLine[],group:string):number{
 return rows.filter(e=>exercisePrimaryGroup(e.name)===group).reduce((n,e)=>n+e.sets.filter(s=>s.done&&s.reps>0).length,0)
}
export function muscleLoad(ws:Workout[]):Record<Muscle,number>{
 const total=Object.fromEntries(muscleKeys.map(k=>[k,0])) as Record<Muscle,number>
 for(const w of ws){
  // A stored historical workout may not have completion flags from legacy imports.
  const rows=w.exercises
  const part=exerciseMuscleLoad(rows)
  for(const k of muscleKeys)total[k]+=part[k]
 }
 return total
}
