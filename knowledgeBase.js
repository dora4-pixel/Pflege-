import { normalize, isNavigationPage, expandQuery } from './searchEngine.js';

const HEADINGS=[
  'Definition','Bestimmende Merkmale','Kennzeichen','Symptome','Beeinflussende Faktoren',
  'Risikofaktoren','Risikopopulation','Assoziierte Bedingungen','Ursachen','Ressourcen',
  'Pflegeziele','Pflegemaßnahmen','Pflegeinterventionen','Evaluation','Diskussion','Literatur'
];

const DNQP_AREAS=[
  {id:'sturz',title:'Sturzprophylaxe',keywords:['sturz','sturzangst','gehen','gehfähigkeit','mobilität','schwindel','gleichgewicht'],standard:'DNQP Sturzprophylaxe in der Pflege (2. Aktualisierung 2022)'},
  {id:'mobilitaet',title:'Erhaltung und Förderung der Mobilität',keywords:['mobilität','bewegung','gehen','transfer','stehen','sitzen'],standard:'DNQP Erhaltung und Förderung der Mobilität in der Pflege'},
  {id:'dekubitus',title:'Dekubitusprophylaxe',keywords:['dekubitus','druck','immobil','lagerung','haut'],standard:'DNQP Dekubitusprophylaxe in der Pflege'},
  {id:'schmerz',title:'Schmerzmanagement',keywords:['schmerz','schmerzen','analges'],standard:'DNQP Schmerzmanagement in der Pflege'},
  {id:'kontinenz',title:'Kontinenzförderung',keywords:['inkontinenz','urin','miktion','stuhl','kontinenz','ausscheidung'],standard:'DNQP Kontinenzförderung in der Pflege (Aktualisierung 2024)'},
  {id:'ernaehrung',title:'Ernährungsmanagement',keywords:['ernährung','nahrung','essen','trinken','mangelernährung','dysphagie','schlucken'],standard:'DNQP Ernährungsmanagement zur Sicherung und Förderung der oralen Ernährung'},
  {id:'haut',title:'Hautintegrität',keywords:['haut','wunde','läsion','hautintegrität'],standard:'DNQP Erhaltung und Förderung der Hautintegrität in der Pflege'},
  {id:'mund',title:'Mundgesundheit',keywords:['mund','zahn','oral','mundpflege'],standard:'DNQP Förderung der Mundgesundheit in der Pflege'},
  {id:'wunden',title:'Chronische Wunden',keywords:['chronische wunde','ulcus','diabetischer fuß','wunde'],standard:'DNQP Pflege von Menschen mit chronischen Wunden'},
  {id:'entlassung',title:'Entlassungsmanagement',keywords:['entlassung','überleitung','versorgung nach entlassung'],standard:'DNQP Entlassungsmanagement in der Pflege'}
];

const SMART_TEMPLATES={
  'mobility-fall':[
    'geht [Distanz] Meter mit [Hilfsmittel] und [Unterstützungsgrad] ohne Gleichgewichtsverlust',
    'führt [Anzahl] von [Anzahl] Transfers mit [Hilfsmittel/Unterstützung] sicher durch',
    'steht mit [Unterstützungsgrad] sicher auf und äußert dabei eine Angst von höchstens [0–10]'
  ],
  breathing:[
    'zeigt bei [Aktivität] eine Atemnot von höchstens [Skala] und erreicht [Messwert/Beobachtung]',
    'führt [Atemtechnik] in [Anzahl] von [Anzahl] Situationen selbstständig durch'
  ],
  pain:[
    'gibt Schmerzen von höchstens [NRS-Wert] bei [Ruhe/Belastung] an',
    'kann [Aktivität] mit einem Schmerz von höchstens [NRS-Wert] durchführen'
  ],
  nutrition:[
    'nimmt pro [Mahlzeit/Tag] mindestens [Menge] Nahrung/Flüssigkeit sicher zu sich',
    'isst/trinkt mit [Hilfsmittel/Unterstützung] ohne beobachtete Zeichen einer Aspiration'
  ],
  elimination:[
    'erreicht eine für die Person akzeptable Kontinenz-/Ausscheidungssituation gemäß [Kriterium]',
    'nutzt vereinbarte Toilettenzeiten/Hilfsmittel in [Anzahl] von [Anzahl] Situationen'
  ],
  skin:[
    'weist im beobachteten Bereich intakte Haut ohne neue Läsionen/Rötungen auf',
    'zeigt eine Verbesserung der Wundsituation gemäß [Messkriterium]'
  ],
  cognition:[
    'orientiert sich mit [Hilfsmittel] in [Situation] und benötigt höchstens [Unterstützungsgrad]',
    'zeigt in [Anzahl] von [Anzahl] Situationen das vereinbarte sichere Verhalten'
  ],
  generic:[
    'erreicht das vereinbarte beobachtbare Ergebnis [konkretes Kriterium]',
    'führt die vereinbarte Aktivität in [Anzahl] von [Anzahl] Situationen mit [Unterstützungsgrad] durch'
  ]
};

function clean(value=''){
  return String(value).replace(/\s+/g,' ').replace(/^[-–—•»›,:;\s]+|[-–—•»›,:;\s]+$/g,'').trim();
}

function headingRegex(){
  return new RegExp('\\b('+HEADINGS.map(function(x){return x.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&')}).join('|')+')\\b','gi');
}

function sectionMap(text=''){
  const src=String(text||'').replace(/\r/g,'\n');
  const re=headingRegex();
  const matches=[...src.matchAll(re)];
  const out={};
  matches.forEach(function(m,i){
    const key=m[1].toLowerCase();
    const start=m.index+m[0].length;
    const end=i+1<matches.length?matches[i+1].index:src.length;
    const val=src.slice(start,end).trim();
    if(val)out[key]=(out[key]?out[key]+'\n':'')+val;
  });
  return out;
}

function splitItems(value='',max=24){
  if(!value)return[];
  const lines=String(value)
    .replace(/\s*[»›•▪●◦]\s*/g,'\n')
    .replace(/\s+[-–—]\s+/g,'\n')
    .split(/\n+|;\s*/u)
    .map(clean)
    .filter(function(x){return x.length>=3&&x.length<=300})
    .filter(function(x){return !HEADINGS.some(function(h){return normalize(x)===normalize(h)})});
  const out=[],seen=new Set();
  for(const x of lines){
    const k=normalize(x).replace(/[^\p{L}\p{N}]+/gu,' ');
    if(!k||seen.has(k))continue;
    seen.add(k);out.push(x);
    if(out.length>=max)break;
  }
  return out;
}

function mergeUnique(target,items){
  const seen=new Set(target.map(function(x){return normalize(x.text||x).replace(/[^\p{L}\p{N}]+/gu,' ')}));
  for(const item of items){
    const text=clean(item.text||item);
    const key=normalize(text).replace(/[^\p{L}\p{N}]+/gu,' ');
    if(!text||seen.has(key))continue;
    seen.add(key);target.push(typeof item==='string'?{text:text}:item);
  }
}

function ensureEntry(map,page,title,code=''){
  const key=page.diagnosisKey||page.kind+':'+normalize(code||title||'unbekannt');
  if(!map.has(key))map.set(key,{
    key:key,
    kind:page.kind,
    title:title||'Pflegediagnose',
    code:code||'',
    domain:page.meta?.domain||'',
    className:page.meta?.className||'',
    area:page.meta?.area||'',
    pages:new Set(),
    bookPages:new Set(),
    risk:/\bRisiko\b/i.test(title||''),
    causes:[],riskFactors:[],symptoms:[],resources:[],goals:[],measures:[],definition:[]
  });
  const e=map.get(key);
  if(!e.domain&&page.meta?.domain)e.domain=page.meta.domain;
  if(!e.className&&page.meta?.className)e.className=page.meta.className;
  if(!e.area&&page.meta?.area)e.area=page.meta.area;
  e.pages.add(page.page);
  if(page.bookPage)e.bookPages.add(page.bookPage);
  return e;
}

function addSection(entry,page,label,items){
  mergeUnique(entry[label],items.map(function(text){return {text:text,kind:page.kind,page:page.page,diagnosisKey:entry.key}}));
}

function parseInto(entry,page){
  const s=sectionMap(page.text||'');
  const g=function(k){return splitItems(s[k]||'')};
  addSection(entry,page,'definition',g('definition'));
  addSection(entry,page,'symptoms',[...g('bestimmende merkmale'),...g('kennzeichen'),...g('symptome')]);
  addSection(entry,page,'causes',[...g('beeinflussende faktoren'),...g('ursachen')]);
  addSection(entry,page,'riskFactors',g('risikofaktoren'));
  addSection(entry,page,'resources',g('ressourcen'));
  addSection(entry,page,'goals',g('pflegeziele'));
  addSection(entry,page,'measures',[...g('pflegemaßnahmen'),...g('pflegeinterventionen')]);
  if(entry.risk && !entry.riskFactors.length && entry.causes.length) entry.riskFactors=[...entry.causes];
}

export function buildKnowledgeBase(books=[]){
  const map=new Map();
  for(const book of books){
    for(const page of book.index?.pages||[]){
      if(isNavigationPage(page.text||''))continue;
      const title=clean(page.meta?.title||'');
      const code=page.meta?.code||'';
      if(!title||!page.diagnosisKey)continue;
      const entry=ensureEntry(map,page,title,code);
      parseInto(entry,page);
    }
  }
  const entries=[...map.values()].map(function(e){
    return {
      ...e,
      pages:[...e.pages].sort(function(a,b){return a-b}),
      bookPages:[...e.bookPages].sort(function(a,b){return Number(a)-Number(b)})
    };
  });
  return {entries:entries,count:entries.length};
}

function scoreEntry(entry,terms=[],hitKeys=new Set()){
  let score=0;
  const hay=normalize([
    entry.title,entry.code,
    ...entry.causes.map(function(x){return x.text}),...entry.riskFactors.map(function(x){return x.text}),
    ...entry.symptoms.map(function(x){return x.text}),...entry.resources.map(function(x){return x.text}),
    ...entry.goals.map(function(x){return x.text}),...entry.measures.map(function(x){return x.text})
  ].join(' '));
  for(const t of terms){
    const n=normalize(t);if(n&&hay.includes(n))score+=n.length>5?2:1;
  }
  for(const p of entry.pages)if(hitKeys.has(entry.kind+':'+p))score+=10;
  return score;
}

function options(entries,key,limit=24){
  const out=[];
  for(const e of entries){
    for(const o of e[key]||[])out.push({...o,diagnosisTitle:e.title,diagnosisCode:e.code});
  }
  const seen=new Set(),result=[];
  for(const o of out){
    const k=normalize(o.text).replace(/[^\p{L}\p{N}]+/gu,' ');
    if(!k||seen.has(k))continue;
    seen.add(k);result.push(o);
    if(result.length>=limit)break;
  }
  return result;
}

function relevantDnqp(query,direction,entries){
  const hay=normalize([query,direction?.title||'',direction?.terms?.join(' ')||'',...entries.map(function(e){return e.title})].join(' '));
  return DNQP_AREAS.filter(function(a){return a.keywords.some(function(k){return hay.includes(normalize(k))})}).map(function(a){return {...a,type:'dnqp'}});
}

export function buildWizardModel(kb,hits=[],direction=null,query=''){
  const expanded=expandQuery(query||'');
  const terms=expanded.terms;
  const hitKeys=new Set(hits.map(function(h){return h.kind+':'+h.page}));
  const ranked=kb.entries
    .map(function(e){return {e:e,score:scoreEntry(e,[...terms,...(direction?.terms||[])],hitKeys)}})
    .filter(function(x){return x.score>0})
    .sort(function(a,b){return b.score-a.score})
    .slice(0,14)
    .map(function(x){return x.e});

  const directTitles=new Set(hits.map(function(h){return normalize(h.meta?.title||'')}).filter(Boolean));
  for(const e of kb.entries){
    if(directTitles.has(normalize(e.title))&&!ranked.includes(e))ranked.unshift(e);
  }

  const diagnoses=ranked.slice(0,10).map(function(e){return {
    key:e.key,kind:e.kind,title:e.title,code:e.code,risk:e.risk,pages:e.pages,bookPages:e.bookPages,
    domain:e.domain,className:e.className,area:e.area,
    source:e.kind+' '+(e.bookPages?.length?'Buch S. '+e.bookPages.join(', '):'PDF S. '+e.pages.join(', '))
  }});

  const riskEntries=ranked.filter(function(e){return e.risk}).slice(0,8).map(function(e){return {
    id:e.key,type:'book',title:e.title,source:e.kind+' '+(e.bookPages?.length?'Buch S. '+e.bookPages.join(', '):'PDF S. '+e.pages.join(', ')),
    diagnosisKey:e.key,riskFactors:e.riskFactors,measures:e.measures,goals:e.goals
  }});

  return {
    diagnoses:diagnoses,
    relevantEntries:ranked,
    causes:options(ranked,'causes',26),
    riskFactors:options(ranked,'riskFactors',26),
    symptoms:options(ranked,'symptoms',26),
    resources:options(ranked,'resources',20),
    goals:options(ranked,'goals',18),
    measures:options(ranked,'measures',30),
    risks:[...riskEntries,...relevantDnqp(query,direction,ranked)],
    smartTemplates:SMART_TEMPLATES[direction?.id]||SMART_TEMPLATES.generic
  };
}

export function entryByKey(kb,key){
  return kb.entries.find(function(e){return e.key===key})||null;
}

export function optionsForDiagnosis(kb,key){
  const e=entryByKey(kb,key);
  if(!e)return null;
  return {
    causes:e.causes,riskFactors:e.riskFactors,symptoms:e.symptoms,resources:e.resources,
    goals:e.goals,measures:e.measures,risk:e.risk,title:e.title,code:e.code,kind:e.kind,pages:e.pages,bookPages:e.bookPages,
    domain:e.domain,className:e.className,area:e.area
  };
}

export const frameworkInfo={
  diagnosisSchema:'PÄS(R): Pflegeproblem · Ätiologie/Einflussfaktoren · Symptome/Kennzeichen · Ressourcen. Bei Risikodiagnosen keine Symptome erfinden.',
  smartSchema:'SMART-Zielprüfung: spezifisch · messbar · akzeptiert/attraktiv · realistisch · terminiert. Der konkrete Wortlaut kann je nach Schule oder Einrichtung abweichen.',
  dnqp:'DNQP-Risikothemen dienen als Prüfhilfe. Ein Risiko wird erst übernommen, wenn es im konkreten Fall bestätigt oder durch Assessment erhoben wurde.'
};
