import {useEffect,useMemo,useRef,useState} from 'react'
import {BodyChart, ViewSide, FRONT_MUSCLES, BACK_MUSCLES} from 'body-muscles'
import type {Muscle} from './MuscleMap'

const mapping:Record<Muscle,string[]>={
 chest:['chest-'],frontDelts:['shoulder-front-'],sideDelts:['shoulder-side-'],rearDelts:['deltoid-rear-'],
 biceps:['biceps-'],triceps:['triceps-'],abs:['abs-','obliques-','serratus-'],
 back:['lats-','lower-back-','spine'],traps:['traps-'],glutes:['gluteus-'],
 quads:['quads-'],hamstrings:['hamstrings-'],calves:['calves-']
}
const names:Record<Muscle,string>={
 chest:'Грудные',frontDelts:'Передняя дельта',sideDelts:'Средняя дельта',rearDelts:'Задняя дельта',
 biceps:'Бицепс',triceps:'Трицепс',abs:'Пресс',back:'Спина',traps:'Трапеции',
 glutes:'Ягодичные',quads:'Квадрицепсы',hamstrings:'Задняя поверхность бедра',calves:'Икры'
}
const keys=Object.keys(names) as Muscle[]
function mapId(id:string):Muscle|null{
  for(const key of keys) if(mapping[key].some(prefix=>id===prefix||id.startsWith(prefix))) return key
  return null
}
export default function AnatomyMuscleMap({loads,sex}:{loads:Record<Muscle,number>,sex:'male'|'female'}){
  const [side,setSide]=useState<'front'|'back'>('front')
  const [selected,setSelected]=useState<Muscle|null>(null)
  const host=useRef<HTMLDivElement>(null)
  const chart=useRef<BodyChart|null>(null)
  const max=Math.max(1,...Object.values(loads).filter(Number.isFinite))
  const state=useMemo(()=>{
    const result:Record<string,{intensity:number,selected:boolean}>={}
    for(const part of [...FRONT_MUSCLES,...BACK_MUSCLES]){
      const key=mapId(part.id)
      const n=key?Number(loads[key]||0):0
      if(key)result[part.id]={intensity:n>0?Math.max(1,Math.min(10,Math.round(10*n/max))):0,selected:selected===key}
    }
    return result
  },[loads,max,selected])
  useEffect(()=>{
    if(!host.current)return
    const instance=new BodyChart(host.current,{
      view:side==='front'?ViewSide.FRONT:ViewSide.BACK,bodyState:state,
      ariaLabel:'Анатомическая карта мышц OSFIT',enableTransitions:true,
      onMuscleClick:(id)=>{const key=mapId(id);if(key)setSelected(old=>old===key?null:key)}
    })
    chart.current=instance
    return ()=>{instance.destroy();chart.current=null}
  },[])
  useEffect(()=>{chart.current?.update({view:side==='front'?ViewSide.FRONT:ViewSide.BACK,bodyState:state})},[side,state])
  return <div className="osfit-anatomy">
    <div className="osfit-view-buttons" role="group" aria-label="Ракурс атлета">
      <button className={side==='front'?'active':''} type="button" onClick={()=>setSide('front')}>Спереди</button>
      <button className={side==='back'?'active':''} type="button" onClick={()=>setSide('back')}>Сзади</button>
    </div>
    <div className="osfit-anatomy-viewport" ref={host}/>
    <p className="osfit-anatomy-hint">{selected?`${names[selected]}: ${loads[selected]||0} подходов`:'Нажми на мышцу для подробностей'}</p>
    <div className="muscle-legend">{keys.map(key=><button type="button" key={key} className={selected===key?'active':''} onClick={()=>setSelected(x=>x===key?null:key)}><span>{names[key]}</span><b>{loads[key]||0}</b></button>)}</div>
    <p className="osfit-anatomy-credit">Анатомическая модель: body-muscles · Apache-2.0. Нагрузка рассчитана по данным OSFIT.</p>
  </div>
}
