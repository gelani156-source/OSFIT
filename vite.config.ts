// OSFIT WIDGET 1.0 — Scriptable iOS
// Large / Medium widget. Import JSON from OSFIT web app by running script.
// Independent of OSFIT IndexedDB; tapping a row opens OSFIT in browser.
const fm=FileManager.iCloud();
const DIR=fm.joinPath(fm.documentsDirectory(),'OSFIT_Widget');
const DATA=fm.joinPath(DIR,'plan.json');
const DARK=new Color('#242426');
const WHITE=new Color('#FFFFFF');
const MUTED=new Color('#A9A9B1');
const BLUE=new Color('#0A84FF');
const targetURL=String(args.widgetParameter||'').trim();
function ensure(){if(!fm.fileExists(DIR))fm.createDirectory(DIR,true)}
function safeJSON(s){try{return JSON.parse(s)}catch{return null}}
function load(){ensure();try{if(!fm.fileExists(DATA))return null;return safeJSON(fm.readString(DATA))}catch{return null}}
function normalize(input){
 if(!input||input.format!=='osfit-scriptable-widget'||!Array.isArray(input.exercises))throw Error('Неверный формат OSFIT_widget_plan.json');
 const rows=input.exercises.map((x,i)=>({id:String(x.id||i),name:String(x.name||'Упражнение'),done:!!x.done,sets:Array.isArray(x.sets)?x.sets.map(s=>({weight:Number(s.weight)||0,reps:Number(s.reps)||0,done:!!s.done})):[]}));
 if(!rows.length)throw Error('В файле нет упражнений');
 return {format:'osfit-scriptable-widget',version:1,name:String(input.name||'Тренировка'),exportedAt:input.exportedAt||new Date().toISOString(),exercises:rows};
}
function group(sets){
 if(!sets.length)return '';
 const chunks=[];let last='';for(const s of sets){const key=(s.weight>0?s.weight+' кг · ':'')+s.reps; if(chunks.length&&key===last)chunks[chunks.length-1].count++;else chunks.push({key,count:1});last=key}
 return chunks.map(c=>c.count+'×'+c.key).join(' / ')
}
async function importPlan(){ensure();const paths=await DocumentPicker.open(['public.json']);if(!paths||!paths.length)return;const p=paths[0];const local=FileManager.local();let raw;try{raw=local.readString(p)}catch(_){await fm.downloadFileFromiCloud(p);raw=fm.readString(p)}const input=normalize(safeJSON(raw));fm.writeString(DATA,JSON.stringify(input,null,2));const a=new Alert();a.title='План импортирован';a.message=`${input.name}\n${input.exercises.length} упражнений. Добавь большой виджет Scriptable и выбери этот скрипт.`;a.addAction('ОК');await a.present()}
function text(stack,s,size,color,bold=false){const t=stack.addText(String(s));t.font=bold?Font.boldSystemFont(size):Font.systemFont(size);t.textColor=color;t.lineLimit=1;return t}
function render(){
 const data=load(),widget=new ListWidget();widget.backgroundColor=DARK;widget.setPadding(17,18,14,18);
 const top=widget.addStack();top.layoutHorizontally();top.centerAlignContent();const tl=top.addStack();tl.layoutVertically();text(tl,'OSFIT',25,WHITE,true);text(tl,'ТРЕНИРОВКА',11,BLUE,true);top.addSpacer();const capsule=top.addStack();capsule.backgroundColor=new Color('#34343B');capsule.cornerRadius=13;capsule.setPadding(7,10,7,10);
 const rows=data?.exercises||[],done=rows.filter(x=>x.done).length;text(capsule,done+'/'+rows.length,13,WHITE,true);
 widget.addSpacer(9);text(widget,data?.name||'Импортируй план из OSFIT',14,MUTED);widget.addSpacer(8);
 const line=widget.addStack();line.backgroundColor=new Color('#47474C');line.size=new Size(0,1);
 widget.addSpacer(5);
 const limit=config.widgetFamily==='medium'?3:7;
 for(const e of rows.slice(0,limit)){
  const row=widget.addStack();row.layoutHorizontally();row.centerAlignContent();row.url=targetURL||'scriptable:///run?scriptName=OSFIT%20Widget';
  const check=row.addStack();check.size=new Size(22,22);check.cornerRadius=11;check.borderWidth=2;check.borderColor=e.done?BLUE:new Color('#62626A');if(e.done)check.backgroundColor=BLUE;
  if(e.done){const mark=check.addText('✓');mark.font=Font.boldSystemFont(14);mark.textColor=WHITE;check.centerAlignContent()}
  row.addSpacer(12);const desc=row.addStack();desc.layoutVertically();text(desc,e.name,14,e.done?MUTED:WHITE);const sub=group(e.sets);if(sub)text(desc,sub,10,MUTED);
  widget.addSpacer(config.widgetFamily==='medium'?8:10)
 }
 if(rows.length>limit){text(widget,'+'+(rows.length-limit)+' упражнений',11,MUTED)}
 if(!rows.length){widget.addSpacer(15);text(widget,'Открой скрипт и выбери «Импортировать план JSON»',12,MUTED)}
 widget.addSpacer();text(widget,'Открыть OSFIT →',11,BLUE,true);
 widget.url=targetURL||'scriptable:///run?scriptName=OSFIT%20Widget';
 return widget;
}
async function main(){
 if(config.runsInWidget){Script.setWidget(render());Script.complete();return}
 const alert=new Alert();alert.title='OSFIT Widget';alert.message='Виджет использует локальную копию плана. Для обновления повтори импорт JSON.';alert.addAction('Импортировать план JSON');alert.addAction('Просмотреть виджет');alert.addCancelAction('Отмена');const choice=await alert.presentAlert();if(choice===0)await importPlan();else if(choice===1)await render().presentLarge();Script.complete()
}
await main();
