import type {Workout,ExerciseLine} from './model'

export type Muscle='chest'|'frontDelts'|'sideDelts'|'rearDelts'|'biceps'|'triceps'|'abs'|'obliques'|'back'|'spinalErectors'|'traps'|'forearms'|'glutes'|'quads'|'adductors'|'hamstrings'|'calves'
export const muscleGroupNames:Record<Muscle,string>={
 chest:'Грудь',frontDelts:'Передняя дельта',sideDelts:'Средняя дельта',rearDelts:'Задняя дельта',
 biceps:'Бицепс',triceps:'Трицепс',forearms:'Предплечья',abs:'Пресс',obliques:'Косые мышцы',
 back:'Широчайшие/спина',spinalErectors:'Разгибатели спины',traps:'Трапеции',glutes:'Ягодицы',
 quads:'Квадрицепсы',adductors:'Приводящие бедра',hamstrings:'Задняя поверхность бедра',calves:'Икры'
}
export const muscleKeys=Object.keys(muscleGroupNames) as Muscle[]
export type Grip='standard'|'pronated'|'supinated'|'neutral'|'mixed'|'wide'|'narrow'
export type ExerciseMuscles={primary:Muscle|'unknown',secondary:Muscle[]}
export type ExtendedExercise=ExerciseLine&{musclePrimary?:Muscle|'auto';muscleSecondary?:Muscle[];grip?:Grip;straps?:boolean}
const normalize=(v:string)=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim()
export function classifyExercise(value:string):ExerciseMuscles{
 const n=normalize(value),r=(p:RegExp)=>p.test(n)
 if(r(/кистев|предплеч|сгибани.{0,12}кист|разгибани.{0,12}кист|wrist curl|reverse curl|фермер|farmer/))return{primary:'forearms',secondary:['traps']}
 if(r(/кос.{0,8}мышц|боков.{0,10}планк|поворот.{0,12}корпус|русск.{0,8}твист|woodchop|side plank/))return{primary:'obliques',secondary:['abs']}
 if(r(/приводящ|аддуктор|сведение ног|adductor/))return{primary:'adductors',secondary:[]}
 if(r(/гиперэкстенз|разгибан.{0,10}спин|good morning|наклон.{0,12}штанг/))return{primary:'spinalErectors',secondary:['hamstrings','glutes']}
 if(r(/косичк|трицепс|разгибан.{0,16}рук|француз|pushdown|triceps/))return{primary:'triceps',secondary:[]}
 if(r(/скручив|пресс|планк|подъем ног|crunch/))return{primary:'abs',secondary:['obliques']}
 if(r(/икр|носки|calf/))return{primary:'calves',secondary:[]}
 if(r(/шраг|трапец|shrug/))return{primary:'traps',secondary:['forearms']}
 if(r(/задн.{0,16}дельт|обратн.{0,15}развед|face pull|тяга к лицу|reverse fly/))return{primary:'rearDelts',secondary:['back']}
 if(r(/средн.{0,12}дельт|мах.{0,12}сторон|развед.{0,16}сторон|lateral raise/))return{primary:'sideDelts',secondary:[]}
 if(r(/передн.{0,12}дельт|подъем перед собой|front raise/))return{primary:'frontDelts',secondary:[]}
 if(r(/жим.{0,12}ног|leg press|разгибан.{0,10}ног|присед|выпад|квадриц|hack squat/))return{primary:'quads',secondary:['glutes','adductors','spinalErectors']}
 if(r(/сгибан.{0,10}ног|румын|бицепс бедра|задн.{0,8}бедра/))return{primary:'hamstrings',secondary:['glutes','spinalErectors']}
 if(r(/станов|deadlift/))return{primary:'spinalErectors',secondary:['hamstrings','glutes','traps','forearms']}
 if(r(/ягод|глют|hip thrust/))return{primary:'glutes',secondary:['hamstrings']}
 if(r(/бицепс|сгибан.{0,15}рук|молот|hammer curl/))return{primary:'biceps',secondary:['forearms']}
 if(r(/подтяг|тяга|лодоч|pulldown|lat pull|\brow\b|спин/))return{primary:'back',secondary:['biceps','forearms','rearDelts']}
 if(r(/жим стоя|армей|жим над головой|military press|arnold press|жим сидя/))return{primary:'frontDelts',secondary:['sideDelts','triceps']}
 if(r(/жим|груд|сведени|бабочк|pec deck|bench|chest|отжиман|брусь|разводка|crossover/))return{primary:'chest',secondary:['frontDelts','triceps']}
 if(r(/дельт|плеч/))return{primary:'sideDelts',secondary:[]}
 return{primary:'unknown',secondary:[]}
}
export function resolvedExercise(e:ExtendedExercise):ExerciseMuscles{
 const automatic=classifyExercise(e.name)
 if(e.musclePrimary&&e.musclePrimary!=='auto'&&muscleKeys.includes(e.musclePrimary))
  return{primary:e.musclePrimary,secondary:(e.muscleSecondary||[]).filter(x=>muscleKeys.includes(x)&&x!==e.musclePrimary)}
 return automatic
}
export function exercisePrimaryGroup(name:string):string{
 const k=classifyExercise(name).primary
 if(k==='unknown')return'Прочее'
 if(k==='chest')return'Грудь'
 if(['back','traps','spinalErectors'].includes(k))return'Спина'
 if(['quads','hamstrings','glutes','calves','adductors'].includes(k))return'Ноги'
 if(['frontDelts','sideDelts','rearDelts'].includes(k))return'Плечи'
 if(['biceps','triceps','forearms'].includes(k))return'Руки'
 return'Пресс'
}
export type LoadStats={direct:Record<Muscle,number>,indirect:Record<Muscle,number>,warmup:number,work:number,unclassified:number,legacy:number}
function blank(){return Object.fromEntries(muscleKeys.map(k=>[k,0])) as Record<Muscle,number>}
export function loadStats(rows:ExerciseLine[],legacyHistory=false):LoadStats{
 const s:LoadStats={direct:blank(),indirect:blank(),warmup:0,work:0,unclassified:0,legacy:0}
 for(const row of rows){
  const e=row as ExtendedExercise
  const mapped=resolvedExercise(e)
  for(const set of e.sets||[]){
   const done=set.done===true||(legacyHistory&&set.done===undefined)
   if(!done||!Number.isFinite(Number(set.reps))||Number(set.reps)<=0)continue
   if(set.done===undefined)s.legacy++
   if(set.kind==='warmup'){s.warmup++;continue}
   s.work++
   if(mapped.primary==='unknown'){s.unclassified++;continue}
   s.direct[mapped.primary]++
   const secondary=mapped.secondary
   for(const k of secondary){
    let fraction=.35
    if(k==='forearms'){
     fraction=e.straps?.08:.35
     if(e.grip==='neutral'||e.grip==='pronated')fraction=e.straps?.08:.42
    }
    if(k==='spinalErectors'&&/присед/.test(normalize(e.name)))fraction=.2
    s.indirect[k]+=fraction
   }
  }
 }
 return s
}
export function exerciseMuscleLoad(rows:ExerciseLine[],includeSecondary=true):Record<Muscle,number>{
 const s=loadStats(rows),out=blank()
 for(const k of muscleKeys)out[k]=s.direct[k]+(includeSecondary?s.indirect[k]:0)
 return out
}
export function primaryGroupSets(rows:ExerciseLine[],group:string):number{
 return rows.filter(e=>exercisePrimaryGroup(e.name)===group).reduce((n,e)=>n+(e.sets||[]).filter(s=>s.done===true&&s.reps>0&&s.kind!=='warmup').length,0)
}
export function workoutLoadStats(ws:Workout[]):LoadStats{
 const total:LoadStats={direct:blank(),indirect:blank(),warmup:0,work:0,unclassified:0,legacy:0}
 for(const w of ws){
  const p=loadStats(w.exercises,true)
  for(const k of muscleKeys){total.direct[k]+=p.direct[k];total.indirect[k]+=p.indirect[k]}
  total.warmup+=p.warmup;total.work+=p.work;total.unclassified+=p.unclassified;total.legacy+=p.legacy
 }
 return total
}
export function muscleLoad(ws:Workout[]):Record<Muscle,number>{
 const s=workoutLoadStats(ws),total=blank()
 for(const k of muscleKeys)total[k]=s.direct[k]+s.indirect[k]
 return total
}
export function lastTrained(ws:Workout[],muscle:Muscle):string|null{
 return ws.filter(w=>(loadStats(w.exercises,true).direct[muscle]+loadStats(w.exercises,true).indirect[muscle])>0)
   .map(w=>w.date.slice(0,10)).sort().at(-1)||null
}
