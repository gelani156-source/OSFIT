import { useCallback, useEffect, useRef, useState } from 'react'
import MuscleMap,{muscleLoad,exerciseMuscleLoad} from './MuscleMap'
import {convertIronlog} from './ironlog'
import {
  Dumbbell, CalendarDays, ChartNoAxesCombined, Plus, Trash2, ChevronLeft,
  Check, Download, Upload, Settings, Save, Play, Copy, PenLine, ArrowLeft, Search, Activity
} from 'lucide-react'
import {
  allPrograms, allWorkouts, saveProgram, deleteProgram, saveWorkout,
  deleteWorkout, importBackup, exportBackup, allSchedule, saveSchedule, deleteSchedule, getProfile, saveProfile, allMeasurements, saveMeasurement, deleteMeasurement
} from './db'
import {
  blankSet, cloneLines, estimate1RM, exerciseCatalog, uid, volumeOf,
  type Program, type Workout, type ExerciseLine, type SetLine, type Schedule, type Profile, type Measurement
} from './model'

type Tab = 'train' | 'history' | 'progress' | 'calendar' | 'body' | 'muscles'
type Editor = 'program' | 'session' | null
const formatDate = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
const newLine = (name: string): ExerciseLine => ({ id: uid(), name, sets: [blankSet(), blankSet(), blankSet()] })
const newSet = (weight: number, reps: number): SetLine => ({ id: uid(), weight, reps, done: false })
const num = (value: string) => Number(value.replace(',', '.'))

// Accepts: "Жим 80 4/6", "Присед 4/8 92,5", "Пресс 4*20".
// Unrecognized lines are deliberately rejected rather than silently imported with wrong weights.
function parseTrainingText(text: string): { exercises: ExerciseLine[], warnings: string[] } {
  const exercises: ExerciseLine[] = []
  const warnings: string[] = []
  const days = /^(?:понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)\s*[:.]?$/i
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]\s*)?(?:\[\s*[xX]?\s*\]\s*)?/, '').trim()
    if (!line || days.test(line)) continue
    const match = line.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s+(\d+)\s*[/*×xх]\s*(\d+)\s*$/i)
    const reverse = line.match(/^(.*?)\s+(\d+)\s*[/*×xх]\s*(\d+)\s+(\d+(?:[.,]\d+)?)\s*$/i)
    const noWeight = line.match(/^(.*?)\s+(\d+)\s*[/*×xх]\s*(\d+)\s*$/i)
    let name = '', sets = 0, reps = 0, weight = 0
    if (match) {
      name = match[1]; weight = num(match[2]); sets = num(match[3]); reps = num(match[4])
    } else if (reverse) {
      name = reverse[1]; sets = num(reverse[2]); reps = num(reverse[3]); weight = num(reverse[4])
    } else if (noWeight) {
      name = noWeight[1]; sets = num(noWeight[2]); reps = num(noWeight[3])
    } else {
      warnings.push(`Не распознано: ${line}`)
      continue
    }
    if (!name.trim() || sets < 1 || sets > 30 || reps < 1 || reps > 300 || weight < 0 || weight > 9999) {
      warnings.push(`Проверьте значения: ${line}`)
      continue
    }
    exercises.push({ id: uid(), name: name.trim(), sets: Array.from({ length: sets }, () => newSet(weight, reps)) })
  }
  return { exercises, warnings }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('train')
  const [editor, setEditor] = useState<Editor>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [bodyForm, setBodyForm] = useState({date:new Date().toISOString().slice(0,10),weight:'',waist:'',chest:'',arm:'',thigh:'',hips:'',neck:'',note:''})
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0,7))
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [rows, setRows] = useState<ExerciseLine[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [picker, setPicker] = useState(false)
  const [query, setQuery] = useState('')
  const [settings, setSettings] = useState(false)
  const [detail, setDetail] = useState<Workout | null>(null)
  const [importing, setImporting] = useState(false)
  const [textImport, setTextImport] = useState(false)
  const [planText, setPlanText] = useState('')
  const [planName, setPlanName] = useState('Импорт из IRONLOG')
  const [profile,setProfile]=useState<Profile>(getProfile)
  const [schedule,setSchedule]=useState<Schedule[]>([])
  const [plannedDate,setPlannedDate]=useState(new Date().toISOString().slice(0,10))
  const [plannedProgram,setPlannedProgram]=useState('')
  const [repeatDays,setRepeatDays]=useState(0)
  const [musclePeriod,setMusclePeriod]=useState(7)
  const [draft,setDraft]=useState(false)
  const [targetReps,setTargetReps]=useState(8)

  const [restDuration,setRestDuration]=useState(()=>Number(localStorage.getItem('osfit-rest')||90))
  const [restUntil,setRestUntil]=useState(()=>Number(localStorage.getItem('osfit-rest-until')||0))
  const [clock,setClock]=useState(Date.now())
  const [editingWorkoutId,setEditingWorkoutId]=useState<string|null>(null)
  const [selectedExercise,setSelectedExercise]=useState('')
  const [ironlogFile,setIronlogFile]=useState<File|null>(null)
  const [ironlogPreview,setIronlogPreview]=useState<{programs:Program[],workouts:Workout[],measurements:Measurement[],warnings:string[]}|null>(null)
  useEffect(()=>{if(!restUntil)return;const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer)},[restUntil])
  const secondsLeft=Math.max(0,Math.ceil((restUntil-clock)/1000))
  useEffect(()=>{if(editor==='session'&&rows.length){localStorage.setItem('osfit-session-draft',JSON.stringify({name,rows,activeProgramId,editingWorkoutId}))}},[editor,rows,name,activeProgramId,editingWorkoutId])
  const restoreDraft=()=>{try{const d=JSON.parse(localStorage.getItem('osfit-session-draft')||'null');if(!d||!Array.isArray(d.rows))return;setName(d.name);setRows(d.rows);setActiveProgramId(d.activeProgramId??null);setEditingWorkoutId(d.editingWorkoutId??null);setEditor('session');setDraft(false)}catch{setError('Черновик повреждён')}}
  const storeProfile=(patch:Partial<Profile>)=>{setProfile(old=>{const p={...old,...patch};saveProfile(p);return p})}
  const addPlanned=async()=>{if(!plannedProgram)return setError('Выберите программу');try{await saveSchedule({id:uid(),date:plannedDate,programId:plannedProgram,repeatDays:repeatDays||undefined});setSchedule(await allSchedule());tell('Тренировка запланирована')}catch(e){setError(String(e))}}
  const removePlanned=async(id:string)=>{await deleteSchedule(id);setSchedule(await allSchedule())}
  const upcoming=(day:string)=>schedule.filter(a=>{const delta=Math.round((Date.parse(day+'T12:00:00')-Date.parse(a.date+'T12:00:00'))/86400000);return delta>=0&&(delta===0||!!a.repeatDays&&delta%a.repeatDays===0)})

  useEffect(()=>{setDraft(!!localStorage.getItem('osfit-session-draft'))},[])
  const startRest=()=>{setClock(Date.now());const until=Date.now()+restDuration*1000;setRestUntil(until);localStorage.setItem('osfit-rest-until',String(until))}
  const file = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [p, w, m, a] = await Promise.all([allPrograms(), allWorkouts(), allMeasurements(), allSchedule()])
    setSchedule(a);setMeasurements(m.sort((a,b)=>b.date.localeCompare(a.date)))
    setPrograms(p.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setWorkouts(w.sort((a, b) => b.date.localeCompare(a.date)))
  }, [])
  useEffect(() => {
    load().catch(e => setError(String(e))).finally(() => setBusy(false))
  }, [load])
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', listener)
    return () => window.removeEventListener('beforeunload', listener)
  }, [dirty])

  const tell = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3600) }
  const abandon = () => {
    if (dirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return false
    setEditor(null); setDirty(false); setPicker(false)
    return true
  }
  const switchTab = (next: Tab) => {
    if (!abandon()) return
    setTab(next); setDetail(null); setSettings(false); setTextImport(false)
  }
  const beginProgram = (p?: Program) => {
    if (!abandon()) return
    setName(p?.name ?? 'Новая программа')
    setRows(p ? structuredClone(p.exercises) : [])
    setEditingId(p?.id ?? null)
    setEditor('program'); setDirty(false)
  }
  const beginSession = (p: Program) => {
    if (!abandon()) return
    setName(p.name); setRows(cloneLines(p.exercises))
    setActiveProgramId(p.id); setEditingWorkoutId(null); setEditor('session'); setDirty(false)
  }
  const changeRow = (index: number, fn: (r: ExerciseLine) => ExerciseLine) => {
    setRows(old => old.map((r, i) => i === index ? fn(r) : r)); setDirty(true)
  }
  const changeSet = (i: number, j: number, patch: Partial<SetLine>) =>
    changeRow(i, r => ({ ...r, sets: r.sets.map((s, k) => k === j ? { ...s, ...patch } : s) }))
  const addExercise = (exercise: string) => {
    setRows(old => [...old, newLine(exercise)]); setDirty(true); setPicker(false); setQuery('')
  }
  const saveCurrent = async () => {
    try {
      setError('')
      if (!name.trim()) throw new Error('Введите название')
      if (!rows.length) throw new Error('Добавьте хотя бы одно упражнение')
      if (editor === 'program') {
        const prev = programs.find(p => p.id === editingId)
        await saveProgram({ id: editingId ?? uid(), createdAt: prev?.createdAt ?? new Date().toISOString(), name: name.trim(), exercises: rows })
        tell('Программа сохранена')
      } else if (editor === 'session') {
        const original=workouts.find(w=>w.id===editingWorkoutId)
        await saveWorkout({ id: editingWorkoutId ?? uid(), name: name.trim(), date: original?.date ?? new Date().toISOString(), programId: activeProgramId, exercises: rows, volume: volumeOf(rows) })
        tell('Тренировка сохранена')
      }
      await load(); if(editor==='session')localStorage.removeItem('osfit-session-draft'); setEditor(null); setEditingWorkoutId(null); setDirty(false);setRestUntil(0)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const removeP = async (id: string) => {
    if (!window.confirm('Удалить программу? История останется.')) return
    try { await deleteProgram(id); await load() } catch (e) { setError(String(e)) }
  }
  const editWorkout=(w:Workout)=>{setDetail(null);setTab('history');setName(w.name);setRows(structuredClone(w.exercises));setActiveProgramId(w.programId);setEditingWorkoutId(w.id);setEditor('session');setDirty(false)}
  const removeW = async (id: string) => {
    if (!window.confirm('Удалить запись о тренировке?')) return
    try { await deleteWorkout(id); setDetail(null); await load() } catch (e) { setError(String(e)) }
  }
  const download = async () => {
    try {
      const data = await exportBackup()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url
      a.download = `osfit-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      tell('Архив подготовлен')
    } catch (e) { setError(String(e)) }
  }
  const upload = async (f: File) => {
    try {
      const payload = JSON.parse(await f.text())
      if (!window.confirm('Импорт заменит все программы и историю. Продолжить?')) return
      setImporting(true); await importBackup(payload); await load(); setSettings(false)
      tell('Данные восстановлены')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setImporting(false); if (file.current) file.current.value = '' }
  }
  const parsed = parseTrainingText(planText)
  const importPlan = async () => {
    try {
      if (!planName.trim()) throw new Error('Укажите название программы')
      if (!parsed.exercises.length) throw new Error('Нет распознанных упражнений')
      if (parsed.warnings.length && !window.confirm(`Пропущено строк: ${parsed.warnings.length}. Сохранить распознанные упражнения?`)) return
      await saveProgram({ id: uid(), name: planName.trim(), exercises: parsed.exercises, createdAt: new Date().toISOString() })
      await load(); setTextImport(false); setPlanText(''); tell('Программа импортирована')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const saveBody = async () => {
    try {
      const value = (v:string) => v.trim() === '' ? undefined : Number(v.replace(',', '.'))
      const m:Measurement = {id:uid(),date:bodyForm.date,weight:value(bodyForm.weight),waist:value(bodyForm.waist),chest:value(bodyForm.chest),arm:value(bodyForm.arm),thigh:value(bodyForm.thigh),hips:value(bodyForm.hips),neck:value(bodyForm.neck),note:bodyForm.note}
      if (!m.date || ![m.weight,m.waist,m.chest,m.arm,m.thigh].some(v=>v!==undefined)) throw new Error('Укажите дату и хотя бы один замер')
      if ([m.weight,m.waist,m.chest,m.arm,m.thigh].some(v=>v!==undefined && (!Number.isFinite(v)||v<=0||v>500))) throw new Error('Проверьте значения замеров')
      await saveMeasurement(m); await load(); tell('Замеры сохранены')
      setBodyForm(x=>({...x,weight:'',waist:'',chest:'',arm:'',thigh:'',note:''}))
    } catch(e) { setError(e instanceof Error?e.message:String(e)) }
  }
  const removeBody = async(id:string) => { if(!window.confirm('Удалить замер?')) return; try {await deleteMeasurement(id);await load()}catch(e){setError(String(e))} }
  const muscleTotals=muscleLoad(workouts)
  const activeMuscles=exerciseMuscleLoad(rows)
  const exerciseNames=Array.from(new Set(workouts.flatMap(w=>w.exercises.map(e=>e.name)))).sort()
  const exerciseSeries=workouts.filter(w=>w.exercises.some(e=>e.name===selectedExercise)).slice().reverse().map(w=>({date:w.date.slice(0,10),value:Math.max(...w.exercises.filter(e=>e.name===selectedExercise).flatMap(e=>e.sets.filter(s=>s.done).map(t=>t.weight)),0)}))
  const recommendedWeight=(exercise:string)=>{for(const w of workouts){const line=w.exercises.find(e=>e.name.toLowerCase()===exercise.toLowerCase());if(!line)continue;const done=line.sets.filter(s=>s.done&&s.weight>0);if(!done.length)continue;const top=Math.max(...done.map(s=>s.weight));return Math.round((top+(done.every(s=>s.reps>=8)?2.5:0))*2)/2}return null}
  const handleIronlog=async(f:File)=>{setIronlogFile(f);setIronlogPreview(null);try{const raw=JSON.parse(await f.text()) as unknown;const result=convertIronlog(raw);setIronlogPreview(result)}catch(e){setError(e instanceof Error?e.message:String(e))}}
  const applyIronlog=async()=>{if(!ironlogPreview||!ironlogFile)return;try{if(!window.confirm(`Добавить ${ironlogPreview.workouts.length} тренировок и ${ironlogPreview.programs.length} программ? Существующие записи останутся.`))return;for(const p of ironlogPreview.programs)await saveProgram(p);for(const w of ironlogPreview.workouts)await saveWorkout(w);for(const m of ironlogPreview.measurements)await saveMeasurement(m);await load();setIronlogPreview(null);setIronlogFile(null);tell('Данные IRONLOG добавлены')}catch(e){setError(String(e))}}
  const doneCount = rows.reduce((n, r) => n + r.sets.filter(s => s.done).length, 0)
  const setCount = rows.reduce((n, r) => n + r.sets.length, 0)
  const stats = {
    sessions: workouts.length,
    volume: workouts.reduce((n, w) => n + volumeOf(w.exercises), 0),
    sets: workouts.reduce((n, w) => n + w.exercises.reduce((v, r) => v + r.sets.filter(s => s.done).length, 0), 0)
  }
  const best = new Map<string, number>()
  for (const w of workouts) for (const r of w.exercises) for (const s of r.sets) {
    if (s.done) best.set(r.name, Math.max(best.get(r.name) ?? 0, estimate1RM(s.weight, s.reps)))
  }

  return <div className="app">
    <header className="header">
      <div className="brand"><span className="brand-icon"><Dumbbell size={22}/></span><div><strong>OSFIT</strong><small>ТРЕНИРОВКИ БЕЗ ЛИШНЕГО</small></div></div>
      <button title="Настройки и архив" className="icon-btn" onClick={() => { if (!abandon()) return; setTextImport(false); setSettings(true) }}><Settings size={22}/></button>
    </header>
    {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
    {notice && <div className="toast">{notice}</div>}
    <main className="content">
      {busy ? <p>Загрузка данных…</p> : settings ? <section>
        <button className="back" onClick={() => setSettings(false)}><ArrowLeft size={17}/> Назад</button>
        <h1>Настройки и данные</h1>
        <p className="muted">Данные хранятся только в этом браузере. Создавайте резервные копии.</p>
        <button className="btn primary full" onClick={() => void download()}><Download size={18}/> Скачать архив JSON</button>
        <button className="btn secondary full" disabled={importing} onClick={() => file.current?.click()}><Upload size={18}/> Восстановить из JSON</button>
        <input ref={file} hidden type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f) }}/>
        <p className="muted small">Восстановление заменяет текущие данные. Поддерживается архив OSFIT 0.1.0.</p>
        <h2>Профиль и настройки атлета</h2>
        <label className="field-label">Модель атлета</label><select className="input" value={profile.sex} onChange={e=>storeProfile({sex:e.target.value as Profile['sex']})}><option value="male">Мужская</option><option value="female">Женская</option></select>
        <label className="field-label">Рост (см)</label><input className="input" type="number" value={profile.height} onChange={e=>storeProfile({height:Number(e.target.value)})}/>
        <label className="field-label">Дата рождения</label><input className="input" type="date" value={profile.birthDate} onChange={e=>storeProfile({birthDate:e.target.value})}/>
        <label className="field-label">Цель</label><select className="input" value={profile.goal} onChange={e=>storeProfile({goal:e.target.value})}><option>Сила и масса</option><option>Сила</option><option>Набор мышечной массы</option><option>Поддержание формы</option></select>
        <label className="field-label">Шаг прибавки веса (кг)</label><input className="input" type="number" step="0.5" min="0.5" value={profile.weightStep} onChange={e=>storeProfile({weightStep:Math.max(.5,Number(e.target.value)||2.5)})}/>
        <label className="field-label"><input type="checkbox" checked={profile.autoProgress} onChange={e=>storeProfile({autoProgress:e.target.checked})}/> Включить рекомендации прогрессии</label>
        <label className="field-label">Отдых между подходами (секунды)</label>
        <input className="input" type="number" min="15" max="900" value={restDuration} onChange={e=>{const v=Math.max(15,Math.min(900,Number(e.target.value)||90));setRestDuration(v);localStorage.setItem('osfit-rest',String(v))}}/>
        <label className="field-label">Перенос JSON из Scriptable IRONLOG</label>
        <input className="input" type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void handleIronlog(f)}}/>
        {ironlogPreview&&<div className="card"><strong>Предпросмотр переноса</strong><p>Тренировок: {ironlogPreview.workouts.length} · Программ: {ironlogPreview.programs.length} · Замеров: {ironlogPreview.measurements.length}</p>{ironlogPreview.warnings.slice(0,12).map((w,i)=><p className="muted small" key={i}>{w}</p>)}<button className="btn primary full" disabled={!ironlogPreview.workouts.length&&!ironlogPreview.programs.length&&!ironlogPreview.measurements.length} onClick={()=>void applyIronlog()}>Добавить распознанные данные</button></div>}
        <div className="card"><strong>OSFIT 3.0.0</strong><p className="muted small">IndexedDB · офлайн PWA · без аккаунтов</p></div>
      </section> : textImport ? <section>
        <button className="back" onClick={() => setTextImport(false)}><ChevronLeft size={18}/> К программам</button>
        <p className="eyebrow">ИМПОРТ IRONLOG</p><h1>Импорт плана</h1>
        <label className="field-label">Название программы</label>
        <input className="input title-input" value={planName} onChange={e => setPlanName(e.target.value)}/>
        <label className="field-label">Импорт TXT / CSV</label><input className="input" type="file" accept=".txt,.csv,text/plain,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void f.text().then(t=>setPlanText(f.name.toLowerCase().endsWith('.csv')?t.replace(/;/g,' ').replace(/,(?=\s*[^\d])/g,' '):t))}}/>
        <label className="field-label">Вставьте упражнения (каждое с новой строки)</label>
        <textarea className="input" style={{ width: '100%', minHeight: 170, boxSizing: 'border-box' }} value={planText} onChange={e => setPlanText(e.target.value)} placeholder={'Среда\nЖим 80 4/6\nПрисед 4/8 92,5\nПресс 4*20'}/>
        <p className="muted small">Поддерживаются форматы: «Жим 80 4/6», «Присед 4/8 92,5», «Пресс 4*20». Неизвестные строки не импортируются.</p>
        <div className="card"><strong>Распознано: {parsed.exercises.length}</strong>
          {parsed.exercises.map(e => <p className="muted small" key={e.id}>{e.name}: {e.sets.length} × {e.sets[0]?.reps}, {fmt(e.sets[0]?.weight ?? 0)} кг</p>)}
          {parsed.warnings.map((w, i) => <p className="small" key={i} style={{ color: '#e59b51' }}>{w}</p>)}
        </div>
        <button className="btn primary full" onClick={() => void importPlan()} disabled={!parsed.exercises.length}><Save size={18}/> Сохранить программу</button>
      </section> : editor ? <section>
        <button className="back" onClick={abandon}><ChevronLeft size={18}/> Назад</button>
        <div className="page-heading"><div><p className="eyebrow">{editor === 'program' ? 'КОНСТРУКТОР' : 'АКТИВНАЯ ТРЕНИРОВКА'}</p><h1>{editor === 'program' ? 'Редактор программы' : 'Тренировка'}</h1></div></div>
        <label className="field-label">Название</label>
        <input className="input title-input" value={name} onChange={e => { setName(e.target.value); setDirty(true) }} placeholder="Название"/>
        {editor === 'session' && <div className="card"><div className="exercise-head"><strong>Таймер отдыха</strong><button className="btn secondary compact" onClick={startRest}>Старт {restDuration} с</button></div><strong>{secondsLeft>0?`${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,'0')}`:'Готов'}</strong><button className="tiny-icon" onClick={()=>setRestUntil(0)}>Сброс</button></div>}
        {editor === 'session' && <div className="session-stats"><span><b>{doneCount}</b> / {setCount} подходов</span><span><b>{fmt(volumeOf(rows))}</b> кг тоннаж</span></div>}
        {rows.map((r, i) => <article className="exercise-card" key={r.id}>
          <div className="exercise-head"><div><span className="exercise-number">{String(i + 1).padStart(2, '0')}</span><strong>{r.name}</strong></div><button className="tiny-icon" title="Удалить упражнение" onClick={() => { setRows(old => old.filter((_, k) => k !== i)); setDirty(true) }}><Trash2 size={17}/></button></div>
          <div className="exercise-options"><label>Суперсет <input className="input" placeholder="A, B..." value={r.superset||''} onChange={e=>changeRow(i,x=>({...x,superset:e.target.value}))}/></label><label>Заметка <input className="input" placeholder="Техника" value={r.note||''} onChange={e=>changeRow(i,x=>({...x,note:e.target.value}))}/></label></div>
          <div className="set-headers"><span>Подход</span><span>Вес, кг</span><span>Повторы</span><span>{editor === 'session' ? 'Готово' : 'План'}</span></div>
          {r.sets.map((s, j) => <div className="set-row" key={s.id}>
            <span className="set-index">{j + 1}</span>
            <input aria-label={`Вес подхода ${j + 1}`} type="number" min="0" max="9999" step="0.5" inputMode="decimal" value={s.weight} onChange={e => changeSet(i, j, { weight: Math.max(0, Number(e.target.value) || 0) })}/>
            <input aria-label={`Повторы подхода ${j + 1}`} type="number" min="0" max="999" inputMode="numeric" value={s.reps} onChange={e => changeSet(i, j, { reps: Math.max(0, Number(e.target.value) || 0) })}/>
            {editor === 'session' ? <label className="check-wrap"><input aria-label={`Выполнен подход ${j + 1}`} type="checkbox" checked={s.done} onChange={e => changeSet(i, j, { done: e.target.checked })}/><span><Check size={17}/></span></label> : <span className="muted center">—</span>}
            <div className="set-extras"><select aria-label="Тип подхода" value={s.kind||'work'} onChange={e=>changeSet(i,j,{kind:e.target.value as SetLine['kind']})}><option value="work">Рабочий</option><option value="warmup">Разминка</option><option value="drop">Дроп-сет</option></select><input aria-label="RPE" title="RPE" type="number" placeholder="RPE" min="1" max="10" step="0.5" value={s.rpe??''} onChange={e=>changeSet(i,j,{rpe:e.target.value?Number(e.target.value):undefined})}/><input aria-label="RIR" title="RIR" type="number" placeholder="RIR" min="0" max="10" value={s.rir??''} onChange={e=>changeSet(i,j,{rir:e.target.value?Number(e.target.value):e.target.value==='0'?0:undefined})}/><input aria-label="Темп" placeholder="Темп 3-1-1-0" value={s.tempo||''} onChange={e=>changeSet(i,j,{tempo:e.target.value})}/></div>
            <button title="Удалить подход" className="row-remove" onClick={() => changeRow(i, x => ({ ...x, sets: x.sets.filter((_, k) => k !== j) }))}>×</button>
          </div>)}
          {editor==='session'&&profile.autoProgress&&<p className="muted small">Рекомендация следующего рабочего веса: {recommendedWeight(r.name)===null?'нет данных':`${recommendedWeight(r.name)} кг`} (прибавка 2,5 кг при 8+ повторах во всех выполненных подходах прошлой тренировки)</p>}
          <button className="add-set" onClick={() => changeRow(i, x => ({ ...x, sets: [...x.sets, blankSet()] }))}><Plus size={16}/> Добавить подход</button>
        </article>)}
        {picker ? <div className="card picker"><div className="picker-title"><b>Добавить упражнение</b><button className="tiny-icon" onClick={() => setPicker(false)}>×</button></div>
          <div className="search"><Search size={17}/><input autoFocus placeholder="Поиск или своё название" value={query} onChange={e => setQuery(e.target.value)}/></div>
          <div className="catalog">{(query.trim() ? Array.from(new Set([query.trim(), ...exerciseCatalog.filter(x => x.toLowerCase().includes(query.trim().toLowerCase()))])) : exerciseCatalog).slice(0, 30).map(x => <button key={x} onClick={() => addExercise(x)}>{x}<Plus size={15}/></button>)}</div>
        </div> : <button className="btn secondary full" onClick={() => setPicker(true)}><Plus size={18}/> Добавить упражнение</button>}
        <button className="btn primary full save-btn" onClick={() => void saveCurrent()}><Save size={18}/>{editor === 'program' ? 'Сохранить программу' : 'Завершить и сохранить'}</button>
        {editor === 'session' && <p className="small muted center">В подсчёт результатов попадут только отмеченные подходы.</p>}
      </section> : detail ? <section>
        <button className="back" onClick={() => setDetail(null)}><ChevronLeft size={18}/> История</button>
        <p className="eyebrow">{formatDate(detail.date)}</p><h1>{detail.name}</h1>
        <div className="metrics two"><div><small>Тоннаж</small><b>{fmt(volumeOf(detail.exercises))} кг</b></div><div><small>Подходы</small><b>{detail.exercises.reduce((n, r) => n + r.sets.filter(s => s.done).length, 0)}</b></div></div>
        {detail.exercises.map(r => <div className="card" key={r.id}><strong>{r.name}</strong>{r.sets.filter(s => s.done).map((s, i) => <p className="muted small" key={s.id}>{i + 1}. {fmt(s.weight)} кг × {s.reps} · 1ПМ ≈ {fmt(estimate1RM(s.weight, s.reps))} кг</p>)}</div>)}
        <button className="btn secondary full" onClick={() => editWorkout(detail)}><PenLine size={17}/> Редактировать тренировку</button>
        <button className="btn danger full" onClick={() => void removeW(detail.id)}><Trash2 size={17}/> Удалить запись</button>
      </section> : tab === 'train' ? <section>
        <div className="page-heading"><div><p className="eyebrow">ВАШИ ТРЕНИРОВКИ</p><h1>Мои программы</h1></div><button className="btn primary compact" onClick={() => beginProgram()}><Plus size={17}/> Создать</button></div>
        {draft&&<button className="btn primary full" onClick={restoreDraft}>Продолжить незавершённую тренировку</button>}
        <button className="btn secondary full" style={{ marginBottom: 16 }} onClick={() => setTextImport(true)}><Upload size={17}/> Импорт IRONLOG</button>
        {!programs.length ? <div className="empty"><Dumbbell size={38}/><h2>Начните с программы</h2><p>Добавьте упражнения и подходы — затем приступайте к тренировке.</p><button className="btn primary" onClick={() => beginProgram()}><Plus size={16}/> Создать программу</button></div> : programs.map(p => <article className="program-card" key={p.id}>
          <div className="program-top"><span className="program-mark"><Dumbbell size={19}/></span><div><strong>{p.name}</strong><p className="muted small">{p.exercises.length} упражнений · {p.exercises.reduce((n, x) => n + x.sets.length, 0)} подходов</p></div></div>
          <div className="program-actions"><button onClick={() => beginSession(p)} className="btn primary"><Play size={16} fill="currentColor"/> Начать</button><button title="Редактировать" className="btn secondary icon-only" onClick={() => beginProgram(p)}><PenLine size={17}/></button><button title="Копировать" className="btn secondary icon-only" onClick={() => { void saveProgram({ ...p, id: uid(), name: p.name + ' (копия)', createdAt: new Date().toISOString() }).then(load).catch(e => setError(String(e))) }}><Copy size={17}/></button><button title="Удалить" className="btn secondary icon-only" onClick={() => void removeP(p.id)}><Trash2 size={17}/></button></div>
        </article>)}
      </section> : tab === 'history' ? <section>
        <div className="page-heading"><div><p className="eyebrow">ЖУРНАЛ</p><h1>История</h1></div></div>
        {!workouts.length ? <div className="empty"><CalendarDays size={36}/><h2>Пока нет тренировок</h2><p>Завершённые тренировки будут появляться здесь.</p></div> : workouts.map(w => <button className="history-card" key={w.id} onClick={() => setDetail(w)}><div className="history-date"><b>{new Date(w.date).getDate()}</b><small>{new Date(w.date).toLocaleDateString('ru-RU', { month: 'short' })}</small></div><div className="history-body"><strong>{w.name}</strong><small>{w.exercises.length} упражнений · {fmt(volumeOf(w.exercises))} кг</small></div><span className="history-arrow">›</span></button>)}
      </section> : tab === 'calendar' ? <section>
        <div className="page-heading"><div><p className="eyebrow">РАСПИСАНИЕ</p><h1>Календарь</h1></div></div>
        <div className="card"><strong>Запланировать тренировку</strong><label className="field-label">Дата начала</label><input className="input" type="date" value={plannedDate} onChange={e=>setPlannedDate(e.target.value)}/><label className="field-label">Программа</label><select className="input" value={plannedProgram} onChange={e=>setPlannedProgram(e.target.value)}><option value="">Выбрать программу</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><label className="field-label">Повторять</label><select className="input" value={repeatDays} onChange={e=>setRepeatDays(Number(e.target.value))}><option value={0}>Однократно</option><option value={2}>Каждые 2 дня</option><option value={3}>Каждые 3 дня</option><option value={7}>Раз в неделю</option><option value={14}>Раз в 14 дней</option></select><button className="btn primary full" onClick={()=>void addPlanned()}>Добавить в календарь</button></div>
        <input className="input" type="month" value={calendarMonth} onChange={e=>setCalendarMonth(e.target.value)}/>
        <div className="calendar-grid">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><strong key={d}>{d}</strong>)}
        {Array.from({length:(new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5))-1,1).getDay()+6)%7},(_,i)=><span key={'empty'+i}/>)}
        {Array.from({length:new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5)),0).getDate()},(_,i)=>{
          const date=`${calendarMonth}-${String(i+1).padStart(2,'0')}`
          const count=workouts.filter(w=>w.date.slice(0,10)===date).length;const scheduled=upcoming(date).length
          return <button key={date} className={count?'trained':scheduled?'planned':''} onClick={()=>{if(count){setTab('history');tell(`Тренировок за ${date}: ${count}`)}}}>{i+1}{count>0?<small>●</small>:scheduled>0?<small>○</small>:null}</button>
        })}</div>
        <h2 className="section-title">План занятий</h2>{schedule.map(a=><div className="card" key={a.id}><div className="exercise-head"><strong>{a.date} · {programs.find(p=>p.id===a.programId)?.name||'Удалённая программа'}</strong><button className="tiny-icon" onClick={()=>void removePlanned(a.id)}><Trash2 size={17}/></button></div><p className="muted small">{a.repeatDays?`Повтор каждые ${a.repeatDays} дней`:'Однократно'}</p><button className="btn secondary" onClick={()=>{const p=programs.find(p=>p.id===a.programId);if(p)beginSession(p)}}>Начать</button></div>)}
        <h2 className="section-title">Тренировки месяца</h2>
        {workouts.filter(w=>w.date.startsWith(calendarMonth)).length===0?<p className="muted">Нет записей за месяц</p>:workouts.filter(w=>w.date.startsWith(calendarMonth)).map(w=><button className="history-card" key={w.id} onClick={()=>{setTab('history');setDetail(w)}}>{formatDate(w.date)} · {w.name}</button>)}
      </section> : tab === 'body' ? <section>
        <p className="eyebrow">АНТРОПОМЕТРИЯ</p><h1>Замеры тела</h1>
        <div className="card"><label className="field-label">Дата</label><input className="input" type="date" value={bodyForm.date} onChange={e=>setBodyForm(x=>({...x,date:e.target.value}))}/>
        <div className="measure-grid">{([['weight','Вес, кг'],['waist','Талия, см'],['chest','Грудь, см'],['arm','Рука, см'],['thigh','Бедро, см'],['hips','Таз, см'],['neck','Шея, см']] as const).map(([key,label])=><label key={key}>{label}<input className="input" inputMode="decimal" placeholder="—" value={bodyForm[key]} onChange={e=>setBodyForm(x=>({...x,[key]:e.target.value}))}/></label>)}</div>
        <label className="field-label">Заметка</label><input className="input" value={bodyForm.note} onChange={e=>setBodyForm(x=>({...x,note:e.target.value}))}/>
        <button className="btn primary full" onClick={()=>void saveBody()}><Save size={17}/> Сохранить замеры</button></div>
        <h2 className="section-title">История замеров</h2>
        {!measurements.length?<p className="muted">Замеров пока нет</p>:measurements.map(m=><div className="card" key={m.id}><div className="exercise-head"><strong>{m.date}</strong><button className="tiny-icon" onClick={()=>void removeBody(m.id)}><Trash2 size={17}/></button></div><p className="muted small">{([['weight','Вес','кг'],['waist','Талия','см'],['chest','Грудь','см'],['arm','Рука','см'],['thigh','Бедро','см'],['hips','Таз','см'],['neck','Шея','см']] as const).filter(([k])=>m[k]!==undefined).map(([k,n,u])=>`${n}: ${m[k]} ${u}`).join(' · ')}</p>{m.note&&<p>{m.note}</p>}</div>)}
      </section> : tab === 'muscles' ? <section>
        <p className="eyebrow">АНАТОМИЯ НАГРУЗКИ</p><h1>Атлет и мышцы</h1>
        <div className="muscle-toolbar">{[7,30,90,365].map(n=><button className={musclePeriod===n?'active':''} key={n} onClick={()=>setMusclePeriod(n)}>{n} дн.</button>)}</div>
        <MuscleMap sex={profile.sex} loads={muscleLoad(workouts.filter(w=>Date.now()-Date.parse(w.date)<musclePeriod*86400000))}/>
        <h2>Мышцы текущей тренировки</h2><MuscleMap sex={profile.sex} loads={activeMuscles}/>
      </section> : <section>
        <div className="page-heading"><div><p className="eyebrow">СТАТИСТИКА</p><h1>Прогресс</h1></div></div>
        <div className="metrics"><div><small>Тренировок</small><b>{stats.sessions}</b></div><div><small>Подходов</small><b>{stats.sets}</b></div><div><small>Общий тоннаж</small><b>{fmt(stats.volume)} <em>кг</em></b></div></div>
        <h2 className="section-title">Тоннаж последних 12 тренировок</h2>
        <div className="bars">{workouts.slice(0,12).reverse().map(w=>{const max=Math.max(1,...workouts.slice(0,12).map(x=>volumeOf(x.exercises)));return <div key={w.id} title={`${formatDate(w.date)}: ${fmt(volumeOf(w.exercises))} кг`} style={{height:`${Math.max(4,volumeOf(w.exercises)/max*100)}%`}}/>})}</div>
        <h2 className="section-title">Прогресс по упражнению</h2>
        <select className="input" value={selectedExercise} onChange={e=>setSelectedExercise(e.target.value)}><option value="">Выберите упражнение</option>{exerciseNames.map(n=><option key={n}>{n}</option>)}</select>
        {selectedExercise&&<div className="card"><div className="bars">{exerciseSeries.slice(-16).map((x,i)=>{const max=Math.max(1,...exerciseSeries.map(t=>t.value));return <div key={i} title={`${x.date}: ${x.value} кг`} style={{height:`${Math.max(5,x.value/max*100)}%`}}/>})}</div><p className="muted small">Максимальный выполненный вес, от старых тренировок к новым.</p></div>}
        <h2 className="section-title">Расчётные рекорды 1ПМ</h2>
        {!best.size ? <div className="empty compact-empty"><ChartNoAxesCombined size={32}/><p>Результаты появятся после первой тренировки.</p></div> : Array.from(best.entries()).sort((a, b) => b[1] - a[1]).map(([ex, value]) => <div className="record" key={ex}><span>{ex}</span><strong>{fmt(value)} кг</strong></div>)}
        <p className="small muted">1ПМ рассчитывается по формуле Эпли. Это оценка, не измеренный максимум.</p>
      </section>}
    </main>
    {!editor && !settings && !detail && !textImport && <nav className="bottom-nav" aria-label="Основная навигация">
      <button className={tab === 'train' ? 'active' : ''} onClick={() => switchTab('train')}><Dumbbell size={21}/><span>Тренировка</span></button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => switchTab('history')}><CalendarDays size={21}/><span>История</span></button>
      <button className={tab === 'calendar' ? 'active' : ''} onClick={() => switchTab('calendar')}><CalendarDays size={21}/><span>Календарь</span></button>
      <button className={tab === 'progress' ? 'active' : ''} onClick={() => switchTab('progress')}><ChartNoAxesCombined size={21}/><span>Прогресс</span></button>
      <button className={tab === 'body' ? 'active' : ''} onClick={() => switchTab('body')}><Activity size={21}/><span>Замеры</span></button>
      <button className={tab === 'muscles' ? 'active' : ''} onClick={() => switchTab('muscles')}><Dumbbell size={21}/><span>Мышцы</span></button>
    </nav>}
  </div>
}
