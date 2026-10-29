import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dumbbell, CalendarDays, ChartNoAxesCombined, Plus, Trash2, ChevronLeft,
  Check, Download, Upload, Settings, Save, Play, Copy, PenLine, ArrowLeft, Search
} from 'lucide-react'
import {
  allPrograms, allWorkouts, saveProgram, deleteProgram, saveWorkout,
  deleteWorkout, importBackup, exportBackup
} from './db'
import {
  blankSet, cloneLines, estimate1RM, exerciseCatalog, uid, volumeOf,
  type Program, type Workout, type ExerciseLine, type SetLine
} from './model'

type Tab = 'train' | 'history' | 'progress'
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
  const file = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [p, w] = await Promise.all([allPrograms(), allWorkouts()])
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
    setActiveProgramId(p.id); setEditor('session'); setDirty(false)
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
        await saveWorkout({ id: uid(), name: name.trim(), date: new Date().toISOString(), programId: activeProgramId, exercises: rows, volume: volumeOf(rows) })
        tell('Тренировка сохранена')
      }
      await load(); setEditor(null); setDirty(false)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const removeP = async (id: string) => {
    if (!window.confirm('Удалить программу? История останется.')) return
    try { await deleteProgram(id); await load() } catch (e) { setError(String(e)) }
  }
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
        <div className="card"><strong>OSFIT 0.2.0</strong><p className="muted small">IndexedDB · офлайн PWA · без аккаунтов</p></div>
      </section> : textImport ? <section>
        <button className="back" onClick={() => setTextImport(false)}><ChevronLeft size={18}/> К программам</button>
        <p className="eyebrow">ИМПОРТ IRONLOG</p><h1>Импорт плана</h1>
        <label className="field-label">Название программы</label>
        <input className="input title-input" value={planName} onChange={e => setPlanName(e.target.value)}/>
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
        {editor === 'session' && <div className="session-stats"><span><b>{doneCount}</b> / {setCount} подходов</span><span><b>{fmt(volumeOf(rows))}</b> кг тоннаж</span></div>}
        {rows.map((r, i) => <article className="exercise-card" key={r.id}>
          <div className="exercise-head"><div><span className="exercise-number">{String(i + 1).padStart(2, '0')}</span><strong>{r.name}</strong></div><button className="tiny-icon" title="Удалить упражнение" onClick={() => { setRows(old => old.filter((_, k) => k !== i)); setDirty(true) }}><Trash2 size={17}/></button></div>
          <div className="set-headers"><span>Подход</span><span>Вес, кг</span><span>Повторы</span><span>{editor === 'session' ? 'Готово' : 'План'}</span></div>
          {r.sets.map((s, j) => <div className="set-row" key={s.id}>
            <span className="set-index">{j + 1}</span>
            <input aria-label={`Вес подхода ${j + 1}`} type="number" min="0" max="9999" step="0.5" inputMode="decimal" value={s.weight} onChange={e => changeSet(i, j, { weight: Math.max(0, Number(e.target.value) || 0) })}/>
            <input aria-label={`Повторы подхода ${j + 1}`} type="number" min="0" max="999" inputMode="numeric" value={s.reps} onChange={e => changeSet(i, j, { reps: Math.max(0, Number(e.target.value) || 0) })}/>
            {editor === 'session' ? <label className="check-wrap"><input aria-label={`Выполнен подход ${j + 1}`} type="checkbox" checked={s.done} onChange={e => changeSet(i, j, { done: e.target.checked })}/><span><Check size={17}/></span></label> : <span className="muted center">—</span>}
            <button title="Удалить подход" className="row-remove" onClick={() => changeRow(i, x => ({ ...x, sets: x.sets.filter((_, k) => k !== j) }))}>×</button>
          </div>)}
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
        <button className="btn danger full" onClick={() => void removeW(detail.id)}><Trash2 size={17}/> Удалить запись</button>
      </section> : tab === 'train' ? <section>
        <div className="page-heading"><div><p className="eyebrow">ВАШИ ТРЕНИРОВКИ</p><h1>Мои программы</h1></div><button className="btn primary compact" onClick={() => beginProgram()}><Plus size={17}/> Создать</button></div>
        <button className="btn secondary full" style={{ marginBottom: 16 }} onClick={() => setTextImport(true)}><Upload size={17}/> Импорт IRONLOG</button>
        {!programs.length ? <div className="empty"><Dumbbell size={38}/><h2>Начните с программы</h2><p>Добавьте упражнения и подходы — затем приступайте к тренировке.</p><button className="btn primary" onClick={() => beginProgram()}><Plus size={16}/> Создать программу</button></div> : programs.map(p => <article className="program-card" key={p.id}>
          <div className="program-top"><span className="program-mark"><Dumbbell size={19}/></span><div><strong>{p.name}</strong><p className="muted small">{p.exercises.length} упражнений · {p.exercises.reduce((n, x) => n + x.sets.length, 0)} подходов</p></div></div>
          <div className="program-actions"><button onClick={() => beginSession(p)} className="btn primary"><Play size={16} fill="currentColor"/> Начать</button><button title="Редактировать" className="btn secondary icon-only" onClick={() => beginProgram(p)}><PenLine size={17}/></button><button title="Копировать" className="btn secondary icon-only" onClick={() => { void saveProgram({ ...p, id: uid(), name: p.name + ' (копия)', createdAt: new Date().toISOString() }).then(load).catch(e => setError(String(e))) }}><Copy size={17}/></button><button title="Удалить" className="btn secondary icon-only" onClick={() => void removeP(p.id)}><Trash2 size={17}/></button></div>
        </article>)}
      </section> : tab === 'history' ? <section>
        <div className="page-heading"><div><p className="eyebrow">ЖУРНАЛ</p><h1>История</h1></div></div>
        {!workouts.length ? <div className="empty"><CalendarDays size={36}/><h2>Пока нет тренировок</h2><p>Завершённые тренировки будут появляться здесь.</p></div> : workouts.map(w => <button className="history-card" key={w.id} onClick={() => setDetail(w)}><div className="history-date"><b>{new Date(w.date).getDate()}</b><small>{new Date(w.date).toLocaleDateString('ru-RU', { month: 'short' })}</small></div><div className="history-body"><strong>{w.name}</strong><small>{w.exercises.length} упражнений · {fmt(volumeOf(w.exercises))} кг</small></div><span className="history-arrow">›</span></button>)}
      </section> : <section>
        <div className="page-heading"><div><p className="eyebrow">СТАТИСТИКА</p><h1>Прогресс</h1></div></div>
        <div className="metrics"><div><small>Тренировок</small><b>{stats.sessions}</b></div><div><small>Подходов</small><b>{stats.sets}</b></div><div><small>Общий тоннаж</small><b>{fmt(stats.volume)} <em>кг</em></b></div></div>
        <h2 className="section-title">Расчётные рекорды 1ПМ</h2>
        {!best.size ? <div className="empty compact-empty"><ChartNoAxesCombined size={32}/><p>Результаты появятся после первой тренировки.</p></div> : Array.from(best.entries()).sort((a, b) => b[1] - a[1]).map(([ex, value]) => <div className="record" key={ex}><span>{ex}</span><strong>{fmt(value)} кг</strong></div>)}
        <p className="small muted">1ПМ рассчитывается по формуле Эпли. Это оценка, не измеренный максимум.</p>
      </section>}
    </main>
    {!editor && !settings && !detail && !textImport && <nav className="bottom-nav" aria-label="Основная навигация">
      <button className={tab === 'train' ? 'active' : ''} onClick={() => switchTab('train')}><Dumbbell size={21}/><span>Тренировка</span></button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => switchTab('history')}><CalendarDays size={21}/><span>История</span></button>
      <button className={tab === 'progress' ? 'active' : ''} onClick={() => switchTab('progress')}><ChartNoAxesCombined size={21}/><span>Прогресс</span></button>
    </nav>}
  </div>
}
