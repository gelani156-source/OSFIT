import {exerciseCatalog,type Program,type Workout,type ExerciseLine} from './model'
export const groups=['Все','Грудь','Спина','Ноги','Плечи','Руки','Пресс']
export const groupFor=(name:string)=>/жим(?!\s*ног|\s*стоя|\s*над\s*голов|\s*армей)|bench|chest|груд|сведени|бабочк|pec deck|кроссовер|брусь/i.test(name)?'Грудь':/тяга|подтяг|лодоч|гипер|lat|row|спин/i.test(name)?'Спина':/присед|нога|ноги|станов|выпад|икр|жим ног|разгибание ног|сгибание ног/i.test(name)?'Ноги':/дельт|плеч|развед|махи в стороны|жим стоя|жим над головой|армей|face pull|обратные разведения/i.test(name)?'Плечи':/сгибан|бицепс|трицепс|косичк|разгибан.*рук|молот|hammer/i.test(name)?'Руки':'Пресс'
export const suggestions=(group:string)=>exerciseCatalog.filter(e=>group==='Все'||groupFor(e)===group)
export const bodyPartPrompt=(name:string)=>groups.find(g=>g.toLowerCase()===name.toLowerCase())||''
export const getExerciseAlternative=(name:string)=>[...new Set([name,...suggestions(groupFor(name))])].slice(0,12)
export const serializeProgram=(p:Program)=>JSON.stringify({format:'osfit-program',version:1,program:p},null,2)
export const readProgramFile=async(file:File):Promise<Program>=>{const d=JSON.parse(await file.text());const p=d.program||d;if(typeof p?.name!=='string'||!Array.isArray(p?.exercises))throw new Error('Некорректная программа');return p as Program}
function completedSets(rows:ExerciseLine[]){
 return rows.reduce((n,e)=>{
   const hasDone=e.sets.some(s=>s.done)
   return n+e.sets.filter(s=>hasDone?s.done:(s.reps>0 || s.weight>0)).length
 },0)
}
export const weeklyMuscleSets=(workouts:Workout[],group:string,period=7)=>workouts.filter(w=>{const d=Date.parse(w.date);return Number.isFinite(d)&&d>=Date.now()-period*86400000&&d<=Date.now()+86400000}).reduce((sum,w)=>sum+w.exercises.filter(e=>groupFor(e.name)===group).reduce((n,e)=>n+completedSets([e]),0),0)
