import type { Program,Workout,Backup } from './model'
const NAME='osfit-db', VERSION=1
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open(NAME,VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const store of ['programs','workouts'])if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function store<T>(collection:'programs'|'workouts',mode:IDBTransactionMode,act:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(collection,mode);const req=act(tx.objectStore(collection));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>db.close()})}
export const allPrograms=()=>store<Program[]>('programs','readonly',s=>s.getAll())
export const allWorkouts=()=>store<Workout[]>('workouts','readonly',s=>s.getAll())
export const saveProgram=(p:Program)=>store<IDBValidKey>('programs','readwrite',s=>s.put(p))
export const deleteProgram=(id:string)=>store<undefined>('programs','readwrite',s=>s.delete(id))
export const saveWorkout=(w:Workout)=>store<IDBValidKey>('workouts','readwrite',s=>s.put(w))
export const deleteWorkout=(id:string)=>store<undefined>('workouts','readwrite',s=>s.delete(id))
function validBackup(x:unknown):x is Backup {if(!x||typeof x!=='object')return false;const b=x as Partial<Backup>;return b.format==='osfit-backup'&&b.version===1&&Array.isArray(b.programs)&&Array.isArray(b.workouts)&&b.programs.every(p=>typeof p?.id==='string'&&typeof p?.name==='string'&&Array.isArray(p?.exercises))&&b.workouts.every(w=>typeof w?.id==='string'&&typeof w?.date==='string'&&Array.isArray(w?.exercises))}
export async function importBackup(payload:unknown){if(!validBackup(payload))throw new Error('Файл не является архивом OSFIT 0.1.0');const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['programs','workouts'],'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);const p=tx.objectStore('programs'),w=tx.objectStore('workouts');p.clear();w.clear();for(const x of payload.programs)p.put(x);for(const x of payload.workouts)w.put(x)});db.close()}
export async function exportBackup():Promise<Backup>{const [programs,workouts]=await Promise.all([allPrograms(),allWorkouts()]);return {format:'osfit-backup',version:1,exportedAt:new Date().toISOString(),programs,workouts}}
