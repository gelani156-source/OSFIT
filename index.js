import {uid,blankSet,normalizedExerciseName,type Program,type Workout,type Measurement} from './model'
export function convertIronlog(raw:unknown):{programs:Program[],workouts:Workout[],measurements:Measurement[],warnings:string[]}{
 const obj=(raw&&typeof raw==='object'?raw:{}) as Record<string,any>;const original=obj.data&&typeof obj.data==='object'?obj.data:obj;
 const warnings:string[]=[];const programs:Program[]=[],workouts:Workout[]=[],measurements:Measurement[]=[];
 const extract=(x:any,history=false)=>Array.isArray(x?.exercises)?x.exercises.map((e:any)=>({id:uid(),name:normalizedExerciseName(String(e.name||e.exercise||'Упражнение')),sets:(Array.isArray(e.sets)?e.sets:[]).map((s:any)=>({...blankSet(),weight:Number(s.weight)||0,reps:Number(s.reps)||0,done:history?(s.done===undefined?true:!!s.done):false}))})):[];
 for(const p of Array.isArray(original.programs)?original.programs:[]){programs.push({id:uid(),name:String(p.name||'Программа'),exercises:extract(p),createdAt:new Date().toISOString()})}
 for(const w of Array.isArray(original.entries)?original.entries:Array.isArray(original.workouts)?original.workouts:[]){const exercises=extract(w,true);if(!exercises.length){warnings.push('Запись без списка упражнений пропущена');continue}workouts.push({id:uid(),name:String(w.name||'Тренировка'),date:String(w.date||new Date().toISOString()),programId:null,exercises,volume:0})}
 for(const m of Array.isArray(original.measurements)?original.measurements:[]){measurements.push({id:uid(),date:String(m.date||new Date().toISOString().slice(0,10)),weight:Number(m.weight)||undefined,waist:Number(m.waist)||undefined,chest:Number(m.chest)||undefined,arm:Number(m.arm)||undefined,thigh:Number(m.thigh)||undefined,note:String(m.note||'')})}
 return {programs,workouts,measurements,warnings}
}
