import type {ExerciseLine} from './model'
export type WidgetPayload={format:'osfit-local-widget-v2',version:2,name:string,sessionId:string,appUrl:string,exportedAt:string,exercises:Array<{id:string,name:string,done:boolean,sets:Array<{weight:number,reps:number,done:boolean}>}>}
export const draftId=(draft:{sessionId?:string}|null):string=>draft?.sessionId||''
export function updateExercise(rows:ExerciseLine[],id:string,complete:boolean):ExerciseLine[]{
 return rows.map(row=>row.id===id?{...row,sets:row.sets.map(set=>({...set,done:complete}))}:row)
}
export function readWidgetAction(search:string){
 const q=new URLSearchParams(search),act=q.get('osfitWidget'),id=q.get('exercise'),session=q.get('session')
 if((act!=='done'&&act!=='undo')||!id||!session||id.length>200||session.length>200)return null
 return {id,session,complete:act==='done'}
}
export function widgetPayload(name:string,rows:ExerciseLine[],sessionId:string,appUrl:string):WidgetPayload{
 return {format:'osfit-local-widget-v2',version:2,name,sessionId,appUrl,exportedAt:new Date().toISOString(),exercises:rows.map(e=>({id:e.id,name:e.name,done:e.sets.length>0&&e.sets.every(s=>s.done),sets:e.sets.map(s=>({weight:s.weight,reps:s.reps,done:s.done}))}))}
}
