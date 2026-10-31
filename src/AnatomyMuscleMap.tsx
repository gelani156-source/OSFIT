import {useMemo, useState} from 'react'
import {MuscleMap as RichMuscleMap} from 'js-rich-body-highlighter/react'
import type {Muscle} from './MuscleMap'
import './anatomyBright.css'

const labels:Record<Muscle,string>={
  chest:'Грудные',frontDelts:'Передняя дельта',sideDelts:'Средняя дельта',
  rearDelts:'Задняя дельта',biceps:'Бицепс',triceps:'Трицепс',
  abs:'Пресс',obliques:'Косые мышцы',back:'Спина',spinalErectors:'Разгибатели спины',traps:'Трапеции',forearms:'Предплечья',glutes:'Ягодичные',
  quads:'Квадрицепсы',adductors:'Приводящие бедра',hamstrings:'Задняя поверхность бедра',calves:'Икры'
}
const keys=Object.keys(labels) as Muscle[]
const groups:Record<string,Muscle[]>={
  chest:['chest'],
  shoulders:['frontDelts','sideDelts','rearDelts'],
  biceps:['biceps'],triceps:['triceps'],
  abs:['abs'],obliques:['obliques'],
  upper_back:['traps','rearDelts'],
  lats:['back'],lower_back:['spinalErectors'],
  glutes:['glutes'],quads:['quads'],
  hamstrings:['hamstrings'],calves:['calves']
}
function fmt(n:number | undefined){
 const value=Number(n||0)
 return Number.isFinite(value)?(Math.round((value+Number.EPSILON)*10)/10).toLocaleString('ru-RU'):'0'
}

export default function AnatomyMuscleMap({loads,sex}:{loads:Record<Muscle,number>,sex:'male'|'female'}){
 const [side,setSide]=useState<'front'|'back'>('front')
 const [selected,setSelected]=useState<Muscle|null>(null)
 const max=Math.max(1,...Object.values(loads).filter(Number.isFinite))
 const highlights=useMemo(()=>Object.entries(groups).map(([group,ids])=>{
   // Secondary muscles contribute to the same anatomical group but do not get counted twice.
   const amount=ids.reduce((sum,id)=>sum+(Number(loads[id])||0),0)
   const active=ids.some(id=>id===selected)
   return {
     group,
     intensity: active?100:amount>0?Math.max(58,Math.min(95,Math.round(amount/max*100))):0,
     color:active?'#5ad6ff':'#ff584a'
   }
 }).filter(x=>x.intensity>0),[loads,max,selected])
 const selectGroup=(g:string)=>{
   const ids=groups[g]
   if(!ids?.length)return
   const k=ids.find(id=>(Number(loads[id])||0)>0)||ids[0]
   setSelected(old=>old===k?null:k)
 }
 return <div className="osfit-anatomy osfit-rich-anatomy">
  <div className="osfit-view-buttons" role="group" aria-label="Ракурс атлета">
   <button type="button" className={side==='front'?'active':''} onClick={()=>setSide('front')}>Спереди</button>
   <button type="button" className={side==='back'?'active':''} onClick={()=>setSide('back')}>Сзади</button>
  </div>
  <p className="osfit-anatomy-hint">{sex==='female'?'Женская модель':'Мужская модель'} · Нажми на мышцу для подробностей</p>
  <div className="osfit-anatomy-viewport osfit-rich-viewport">
   <RichMuscleMap
     gender={sex} view={side} theme="dark" width="100%"
     highlights={highlights} blendMode="normal"
     hoverHighlight hoverIntensity={92} hoverColor="#5ad6ff"
     onMuscleClick={(muscle)=>selectGroup(muscle.group)}
   />
  </div>
  {selected&&<p className="osfit-anatomy-hint">Выбрано: {labels[selected]} · {fmt(loads[selected])} усл. подходов</p>}
  <div className="muscle-legend">
   {keys.map(key=><button key={key} type="button" className={selected===key?'active':''} onClick={()=>setSelected(x=>x===key?null:key)}>
    <span>{labels[key]}</span><b>{fmt(loads[key])}</b>
   </button>)}
  </div>
  <p className="osfit-anatomy-hint">Предплечья и приводящие отображаются в списке, если анатомическая SVG-модель не выделяет их отдельно.</p>
  <p className="osfit-anatomy-credit">Модель: js-rich-body-highlighter · MIT. Интенсивность основана на данных OSFIT.</p>
 </div>
}
