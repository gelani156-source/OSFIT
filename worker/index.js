// Cloudflare Worker: bind KV namespace named WIDGET_DATA in Worker settings.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Cache-Control':'no-store'};
const reply=(body,status=200)=>new Response(body,{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
export default {async fetch(request,env){
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  const url=new URL(request.url);
  if(url.pathname!=='/widget'||!['GET','PUT'].includes(request.method))return reply('{"error":"Not found"}',404);
  const secret=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
  if(!env.SYNC_TOKEN||secret!==env.SYNC_TOKEN)return reply('{"error":"Unauthorized"}',401);
  if(!env.WIDGET_DATA)return reply('{"error":"KV not configured"}',503);
  if(request.method==='GET'){
    const data=await env.WIDGET_DATA.get('current');return data?reply(data):reply('{"error":"No snapshot yet"}',404);
  }
  const body=await request.text();if(body.length>45000)return reply('{"error":"Too large"}',413);
  let payload;try{payload=JSON.parse(body)}catch{return reply('{"error":"Invalid JSON"}',400)}
  if(payload?.format!=='osfit-scriptable-widget'||!Array.isArray(payload.exercises)||payload.exercises.length>100)return reply('{"error":"Invalid snapshot"}',422);
  await env.WIDGET_DATA.put('current',body);
  return reply('{"ok":true}');
}};
