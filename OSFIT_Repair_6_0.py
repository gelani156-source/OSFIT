#!/usr/bin/env python3
"""OSFIT 6.0 targeted repairs. Run from repository root: python OSFIT_Repair_6_0.py"""
from pathlib import Path
import re, shutil, json
root = Path(__file__).resolve().parent
src = root / 'src'
required = [src/'App.tsx', src/'db.ts', src/'MuscleMap.ts']
if any(not p.is_file() for p in required):
    raise SystemExit('Ошибка: положите этот скрипт в КОРЕНЬ OSFIT рядом с package.json и папкой src.')
backup = root / '_osfit_before_6_0'
backup.mkdir(exist_ok=True)
for p in required:
    shutil.copy2(p, backup / p.name)

def one(s, old, new, title):
    n=s.count(old)
    if n != 1:
        raise ValueError(f'{title}: ожидалось 1 совпадение, найдено {n}. Изменения не применены.')
    return s.replace(old,new,1)

app=(src/'App.tsx').read_text(encoding='utf-8')
# remove Cloudflare widgets side effects, keep unrelated exercise/backup functionality
app,n=re.subn(r'  // Sync only the widget snapshot\.[\s\S]*?\n  \},\[busy,syncUrl,syncKey,editor,rows,name,programs,schedule,workouts,draft\]\)\n', '',app,count=1)
if n!=1: raise ValueError('Cloudflare: блок автосинхронизации не найден')
app,n=re.subn(r'        <div className="card gap"><h2>Автосинхронизация виджета iPhone</h2>[\s\S]*?\n        </div>\n','',app,count=1)
if n!=1: raise ValueError('Cloudflare: карточка настроек не найдена')
for needle in [
 "  const [syncUrl,setSyncUrl]=useState(()=>localStorage.getItem('osfit-sync-url')||'')\n",
 "  const [syncKey,setSyncKey]=useState(()=>localStorage.getItem('osfit-sync-key')||'')\n",
 "  const [syncInfo,setSyncInfo]=useState('')\n",
 "import WorkoutMiniWidget from './WorkoutMiniWidget'\n",
 "import {readWidgetAction,updateExercise,widgetPayload} from './widgetBridge'\n",
]:
    if needle not in app: raise ValueError('Не найден ожидаемый фрагмент: '+needle[:80])
    app=app.replace(needle,'',1)
# remove retired widget URL action effect entirely
app,n=re.subn(r'  useEffect\(\(\)=>\{\n    const action=readWidgetAction\(window.location.search\)[\s\S]*?\n  \},\[\]\)\n','',app,count=1)
if n!=1:raise ValueError('Не найден устаревший обработчик ссылок виджета')
# Remove widget helper functions without relying on full code strings
start=app.find('  const sendLocalWidget=()=>{')
end=app.find('  const download = async () => {',start)
if start<0 or end<0:raise ValueError('Не найден блок старых функций экспорта виджета')
app=app[:start]+app[end:]
# remove old widget UI line when present
app='\n'.join(x for x in app.split('\n') if 'Экспорт плана для виджета Scriptable' not in x and 'Передать тренировку в локальный виджет' not in x and 'Обновить виджет Scriptable' not in x)
# remove old mini-widget handlers by keeping them? ensure dependencies absent: remove entire code block by marker
start=app.find('  // The mini widget operates on the active workout')
end=app.find('  const best = new Map<string, number>()',start)
if start>=0 and end>start:
    app=app[:start]+app[end:]
# 2 modes only: preserve expanded historic setting as compact, no runtime 3rd choice
app=app.replace("useState<'simple'|'compact'|'expanded'>(()=>{const v=localStorage.getItem('osfit-view-mode');return v==='simple'||v==='expanded'||v==='compact'?v:localStorage.getItem('osfit-compact')==='false'?'expanded':'compact'})", "useState<'simple'|'compact'>(()=>localStorage.getItem('osfit-view-mode')==='simple'?'simple':'compact')")
app=app.replace("(v:'simple'|'compact'|'expanded')", "(v:'simple'|'compact')")
app=app.replace("const compact=viewMode!=='expanded'", "const compact=viewMode==='compact'")
app=app.replace("(['simple','compact','expanded'] as const)", "(['simple','compact'] as const)")
app=app.replace("v==='simple'?'Простой':v==='compact'?'Компактный':'Полный'", "v==='simple'?'Простой':'Компактный'")
# keep exercise layout intact: other comparisons to expanded now unreachable, simplify
app=app.replace("viewMode==='expanded'", "false")
# remove persisted old sync secrets, no network call: one-off migration inside existing App effect is intentionally avoided
# local dates in form defaults only
app=app.replace("new Date().toISOString().slice(0,10)","localDay()")
app=app.replace("new Date().toISOString().slice(0,7)","localDay().slice(0,7)")
marker='// OSFIT unified update'
if marker not in app:raise ValueError('Не найдено место для локальной даты')
app=app.replace(marker,"function localDay(d=new Date()){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}\n\n"+marker,1)
# numeric safe periods in muscle stats; keep date-only comparisons inclusive
app=app.replace('Date.now()-musclePeriod*86400000',"new Date(localDay()+'T12:00:00').getTime()-(musclePeriod-1)*86400000")
app=app.replace('Date.parse(w.date)',"Date.parse(w.date.slice(0,10)+'T12:00:00')")
# remove CSS nested legacy map? no styling change

# protect backup import with deep validation before *any* clear operation, retain IDB transactional atomicity
p=src/'db.ts';db=p.read_text(encoding='utf-8')
start=db.index('function valid(x:unknown)')
end=db.index('export async function importBackup',start)
db=db[:start]+'''function valid(x:unknown):x is Backup{
 if(!x||typeof x!=='object')return false
 const b=x as Partial<Backup>
 if(b.format!=='osfit-backup'||![1,2,3,4].includes(Number(b.version)))return false
 if(!Array.isArray(b.programs)||!Array.isArray(b.workouts))return false
 if(b.measurements!==undefined&&!Array.isArray(b.measurements))return false
 if(b.schedule!==undefined&&!Array.isArray(b.schedule))return false
 const ids=(xs:unknown[])=>xs.every(item=>typeof item==='object'&&item!==null&&typeof (item as {id?:unknown}).id==='string'&&!!(item as {id:string}).id)
 const sets=(e:unknown)=>Array.isArray(e)&&e.every(line=>{
  if(!line||typeof line!=='object')return false
  const it=line as {id?:unknown,name?:unknown,sets?:unknown}
  return typeof it.id==='string'&&typeof it.name==='string'&&Array.isArray(it.sets)&&it.sets.every(set=>{
   if(!set||typeof set!=='object')return false
   const s=set as {id?:unknown,weight?:unknown,reps?:unknown,done?:unknown}
   return typeof s.id==='string'&&typeof s.weight==='number'&&Number.isFinite(s.weight)&&typeof s.reps==='number'&&Number.isFinite(s.reps)&&(s.done===undefined||typeof s.done==='boolean')
  })
 })
 return ids(b.programs)&&ids(b.workouts)&&
  b.programs.every(p=>typeof p.name==='string'&&sets(p.exercises))&&
  b.workouts.every(w=>typeof w.name==='string'&&typeof w.date==='string'&&sets(w.exercises))&&
  ids(b.measurements??[])&&ids(b.schedule??[])
}
''' + db[end:]
# avoid silently erasing schedule or measurements if fields absent, when existing data may exist
needle=" if(!valid(x))throw new Error('Неподдерживаемый архив OSFIT')"
db=one(db,needle, needle+"\n if(!Array.isArray(x.measurements)||!Array.isArray(x.schedule))throw new Error('Неполный архив: отсутствуют замеры или расписание. Импорт отменён для защиты данных')",'проверка бэкапа')

# classifier: unknown not assigned back; do not falsify legacy sessions with no explicit completions
p2=src/'MuscleMap.ts';mu=p2.read_text(encoding='utf-8')
mu=one(mu," return {primary:'back',secondary:[]}"," return {primary:'unknown',secondary:[]}",'unknown classification')
mu=one(mu,"export type ExerciseMuscles={primary:Muscle,secondary:Muscle[]}","export type ExerciseMuscles={primary:Muscle|'unknown',secondary:Muscle[]}",'classifier type')
mu=one(mu," if(k==='chest')return 'Грудь'", " if(k==='unknown')return 'Прочее'\n if(k==='chest')return 'Грудь'",'unclassified group')
mu=one(mu,"const cls=classifyExercise(e.name);total[cls.primary]+=count", "const cls=classifyExercise(e.name);if(cls.primary==='unknown')continue;total[cls.primary]+=count",'unknown skip')
# remove unconditional legacy inference; otherwise planned, unchecked sets become completed history
old='''  const allUndone=w.exercises.every(e=>e.sets.every(s=>!s.done))
  const rows=allUndone?w.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,done:s.reps>0}))})):w.exercises'''
mu=one(mu,old,"  const rows=w.exercises",'legacy inference')
# one-off security cleanup from existing useEffect in App; only clean on start, not every render
app=app.replace("  const [plannedDate,setPlannedDate]", "  useEffect(()=>{localStorage.removeItem('osfit-sync-url');localStorage.removeItem('osfit-sync-key')},[])\n  const [plannedDate,setPlannedDate]",1)
# remove backup transport of retired widget session identifiers? leave session IDs for legacy safe draft compatibility
# before writes sanity assertions
assert 'syncUrl' not in app and 'readWidgetAction' not in app and 'sendLocalWidget' not in app
assert 'js-rich-body-highlighter' not in db
assert 'compact' in app and "(['simple','compact'] as const)" in app
(src/'App.tsx').write_text(app,encoding='utf-8')
(src/'db.ts').write_text(db,encoding='utf-8')
(src/'MuscleMap.ts').write_text(mu,encoding='utf-8')
print('Исправлены:',', '.join(p.name for p in required))
print('Резервные копии старых файлов:',backup)
