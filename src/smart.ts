import {exercisePrimaryGroup,primaryGroupSets} from './MuscleMap'
import {exerciseCatalog,type Program,type Workout,type ExerciseLine} from './model'
export const groups=['Все','Грудь','Спина','Ноги','Плечи','Руки','Пресс']
export const groupFor=exercisePrimaryGroup
export const suggestions=(group:string)=>exerciseCatalog.filter(e=>group==='Все'||groupFor(e)===group)
export const bodyPartPrompt=(name:string)=>groups.find(g=>g.toLowerCase()===name.toLowerCase())||''
export const getExerciseAlternative=(name:string)=>[...new Set([name,...suggestions(groupFor(name))])].slice(0,12)
export const serializeProgram=(p:Program)=>JSON.stringify({format:'osfit-program',version:1,program:p},null,2)
export const readProgramFile=async(file:File):Promise<Program>=>{const d=JSON.parse(await file.text());const p=d.program||d;if(typeof p?.name!=='string'||!Array.isArray(p?.exercises))throw new Error('Некорректная программа');return p as Program}
export const weeklyMuscleSets=(workouts:Workout[],group:string,period=7)=>workouts.filter(w=>{const d=Date.parse(w.date);return Number.isFinite(d)&&d>=Date.now()-(period-1)*86400000-86400000&&d<=Date.now()+86400000}).reduce((sum,w)=>{const rows=w.exercises.every(e=>e.sets.every(s=>!s.done))?w.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,done:s.reps>0}))})):w.exercises;return sum+primaryGroupSets(rows,group)},0)
