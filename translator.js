const API='https://api.mymemory.translated.net/get';
const encoder=new TextEncoder();

function bytes(s){return encoder.encode(s).length}
function decodeHtml(s=''){
  return String(s)
    .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function splitChunk(text,maxBytes=430){
  const input=String(text||'').trim();
  if(!input)return [];
  if(bytes(input)<=maxBytes)return [input];
  const sentences=input.split(/(?<=[.!?;:])\s+/u);
  const out=[];let current='';
  const pushWords=value=>{
    for(const word of value.split(/\s+/u).filter(Boolean)){
      const next=current?current+' '+word:word;
      if(bytes(next)>maxBytes){if(current)out.push(current);current=word}else current=next;
    }
  };
  for(const sentence of sentences){
    if(bytes(sentence)>maxBytes){pushWords(sentence);continue}
    const next=current?current+' '+sentence:sentence;
    if(bytes(next)>maxBytes){if(current)out.push(current);current=sentence}else current=next;
  }
  if(current)out.push(current);
  return out;
}
async function one(q,langpair='de|ru'){
  const url=new URL(API);
  url.searchParams.set('q',q);
  url.searchParams.set('langpair',langpair);
  url.searchParams.set('mt','1');
  const r=await fetch(url,{mode:'cors',headers:{accept:'application/json'}});
  if(!r.ok)throw new Error('Translation HTTP '+r.status);
  const data=await r.json();
  const translated=decodeHtml(data?.responseData?.translatedText||'').trim();
  if(!translated)throw new Error('Empty translation');
  return translated;
}
async function mapLimit(items,limit,fn){
  const result=new Array(items.length);let next=0;
  async function worker(){while(true){const i=next++;if(i>=items.length)return;result[i]=await fn(items[i],i)}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return result;
}

export async function translateDeRu(text){
  const lines=String(text||'').replace(/\r\n/g,'\n').split('\n');
  const jobs=[];const lineMap=[];
  lines.forEach((line,lineIndex)=>{
    const chunks=splitChunk(line);lineMap[lineIndex]=[];
    chunks.forEach(chunk=>{lineMap[lineIndex].push(jobs.length);jobs.push(chunk)});
  });
  const translated=await mapLimit(jobs,3,async chunk=>{
    try{return await one(chunk,'de|ru')}
    catch{
      await new Promise(r=>setTimeout(r,180));
      try{return await one(chunk,'de|ru')}catch{return '[не переведено] '+chunk}
    }
  });
  return lines.map((line,i)=>line.trim()?lineMap[i].map(idx=>translated[idx]).join(' '):'').join('\n');
}


const queryCache=new Map();

export async function translateRuDe(text){
  const q=String(text||'').trim();
  if(!q)return '';
  if(queryCache.has(q))return queryCache.get(q);
  try{
    const translated=await one(q,'ru|de');
    queryCache.set(q,translated);
    return translated;
  }catch{
    return '';
  }
}
