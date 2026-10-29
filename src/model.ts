export type SetLine={id:string,weight:number,reps:number,done:boolean}
export type ExerciseLine={id:string,name:string,sets:SetLine[]}
export type Program={id:string,name:string,exercises:ExerciseLine[],createdAt:string}
export type Workout={id:string,name:string,programId:string|null,date:string,exercises:ExerciseLine[],volume:number}
export type Measurement={id:string,date:string,weight?:number,waist?:number,chest?:number,arm?:number,thigh?:number,note?:string}
export type Backup={format:'osfit-backup',version:number,exportedAt:string,programs:Program[],workouts:Workout[],measurements?:Measurement[]}
export const uid=()=>crypto.randomUUID()
export const blankSet=():SetLine=>({id:uid(),weight:0,reps:8,done:false})
export const cloneLines=(rows:ExerciseLine[]):ExerciseLine[]=>rows.map(x=>({...x,id:uid(),sets:x.sets.map(s=>({...s,id:uid(),done:false}))}))
export const volumeOf=(rows:ExerciseLine[])=>rows.reduce((total,e)=>total+e.sets.reduce((v,s)=>v+(s.done?s.weight*s.reps:0),0),0)
export const estimate1RM=(weight:number,reps:number)=>weight>0&&reps>0?weight*(1+reps/30):0
export const exerciseCatalog=['Жим штанги лёжа','Жим гантелей лёжа','Жим на наклонной скамье','Присед со штангой','Становая тяга','Румынская тяга','Тяга штанги в наклоне','Подтягивания','Тяга верхнего блока','Тяга горизонтального блока','Жим стоя','Жим ногами','Выпады','Разгибание ног','Сгибание ног','Подъём на носки','Брусья','Сгибание рук со штангой','Сгибание рук с гантелями','Разгибание рук на блоке','Разведение гантелей в стороны','Шраги','Скручивания','Планка','Гиперэкстензия','Лодочка']
