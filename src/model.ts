export type SetLine = {id:string, weight:number, reps:number, done:boolean, kind?:'warmup'|'work'|'drop', rpe?:number, rir?:number, tempo?:string, note?:string, rest?:number, superset?:string}
export type ExerciseLine = {
  id: string
  name: string
  sets: SetLine[]
  superset?: string
  note?: string
}
export type Program = {id:string,name:string,exercises:ExerciseLine[],createdAt:string}
export type Workout = {id:string,name:string,programId:string|null,date:string,exercises:ExerciseLine[],volume:number}
export type Measurement = {id:string,date:string,weight?:number,waist?:number,chest?:number,arm?:number,thigh?:number,hips?:number,neck?:number,note?:string}
export type Schedule = {id:string,date:string,programId:string,repeatDays?:number}
export type Profile = {sex:'male'|'female',height:number,birthDate:string,goal:string,weightStep:number,autoProgress:boolean}
export type Backup = {format:'osfit-backup',version:number,exportedAt:string,programs:Program[],workouts:Workout[],measurements?:Measurement[],schedule?:Schedule[],profile?:Profile,strengthGoals?:unknown[],activeSession?:unknown,preferences?:Record<string,string|null>}
export const uid = () => crypto.randomUUID()
export const blankSet = (): SetLine => ({id:uid(),weight:0,reps:8,done:false})
export const cloneLines = (rows:ExerciseLine[]):ExerciseLine[] => rows.map(x=>({...x,id:uid(),sets:x.sets.map(s=>({...s,id:uid(),done:false}))}))
export const exerciseMode=(name:string):'bodyweight'|'optional'|'plates'|'weight'=>/скручив|пресс|планк|лодоч/i.test(name)?'bodyweight':/подтяг|отжиман|брусь/i.test(name)?'optional':/косичк|трицепс|разгибание рук.*(блок|кроссовер|канат)/i.test(name)?'plates':'weight'
export const normalizedExerciseName=(name:string)=>/косичк/i.test(name)?'Разгибание рук в кроссовере с канатом':/^трицепс$/i.test(name.trim())?'Разгибание рук в кроссовере с прямым грифом':name
export const workingWeight=(name:string,weight:number)=>exerciseMode(name)==='plates'?weight*5:exerciseMode(name)==='bodyweight'?0:weight
export const volumeOf = (rows:ExerciseLine[]) => rows.reduce((total,e)=>total+e.sets.reduce((v,s)=>v+(s.done?workingWeight(e.name,s.weight)*s.reps:0),0),0)
export const estimate1RM = (weight:number,reps:number) => weight>0 && reps>0 ? weight*(1+reps/30) : 0
export const exerciseCatalog = ['Жим штанги лёжа','Жим гантелей лёжа','Жим на наклонной скамье','Сведения в тренажёре','Присед со штангой','Становая тяга','Румынская тяга','Тяга штанги в наклоне','Подтягивания','Тяга верхнего блока','Тяга горизонтального блока','Жим стоя','Махи в стороны','Обратные разведения','Тяга к лицу','Жим ногами','Выпады','Разгибание ног','Сгибание ног','Подъём на носки','Брусья','Сгибание рук со штангой','Сгибание рук с гантелями','Разгибание рук на блоке','Разведение гантелей в стороны','Шраги','Скручивания','Планка','Гиперэкстензия','Лодочка','Разгибание рук в кроссовере с канатом','Разгибание рук в кроссовере с прямым грифом']
