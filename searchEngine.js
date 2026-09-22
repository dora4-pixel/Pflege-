import { inferSemanticQuery } from './semanticEngine.js';
const MiniSearchCtor=()=>typeof window!=='undefined'?window.MiniSearch:null;

export function normalize(value=''){
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');
}

const NAV_RE=/\b(Inhaltsverzeichnis|Inhaltsverzeichnis der ENP-Pflegediagnosen|Stichwortverzeichnis|Sachverzeichnis|Diagnosenverzeichnis|Index)\b/i;
const SECTION_DEFS=[
  ['Definition',/\bDefinition\b/gi],
  ['Bestimmende Merkmale',/\bBestimmende Merkmale\b/gi],
  ['Kennzeichen / Symptome',/\b(Kennzeichen|Symptome)\b/gi],
  ['Beeinflussende Faktoren',/\bBeeinflussende Faktoren\b/gi],
  ['Ursachen',/\bUrsachen\b/gi],
  ['Risikofaktoren',/\bRisikofaktoren\b/gi],
  ['Risikopopulation',/\bRisikopopulation(?:en)?\b/gi],
  ['Assoziierte Bedingungen',/\bAssoziierte Bedingungen\b/gi],
  ['Ressourcen',/\bRessourcen\b/gi],
  ['Pflegeziele',/\bPflegeziele\b/gi],
  ['Pflegemaßnahmen',/\b(Pflegemaßnahmen|Pflegeinterventionen)\b/gi],
  ['Evaluation',/\bEvaluation\b/gi]
];
const INFO_MARKERS=/\b(Definition|Bestimmende Merkmale|Beeinflussende Faktoren|Risikofaktoren|Risikopopulation|Assoziierte Bedingungen|Kennzeichen|Symptome|Ursachen|Ressourcen|Pflegeziele|Pflegemaßnahmen|Pflegeinterventionen|LOE\s+PD|LOE\s+PL)\b/i;

export function isNavigationPage(text=''){
  const t=String(text).replace(/\s+/g,' ').trim();
  if(!t||t.length<120)return true;
  return NAV_RE.test(t);
}

function cleanupTitle(value=''){
  return String(value)
    .replace(/\s+/g,' ')
    .split(/\s+»\s+|\b(?:Definition|Bestimmende Merkmale|Kennzeichen|Symptome|Ursachen|Ressourcen|Pflegeziele|Pflegemaßnahmen|Pflegeinterventionen|LOE\s+PD|LOE\s+PL)\b/i)[0]
    .replace(/\s+\d{1,4}\s*$/,'')
    .replace(/[;,:\-–\s]+$/,'')
    .trim()
    .slice(0,180);
}

export function nandaMeta(text=''){
  const c=String(text).replace(/\s+/g,' ').trim();
  const dm=c.match(/Domäne\s+(\d+)\.?\s*([^]{0,100}?)\s+Klasse\s+(\d+)\.?\s*([^]{0,120}?)(?=\s+Diagnosencode|\s+\d{3,5}\b|$)/i);
  const code=c.match(/Diagnosencode\s+(\d{3,5})/i);
  let title='';
  if(code){
    const p=c.indexOf(code[0]);
    const a=c.slice(p+code[0].length,p+code[0].length+300);
    const stop=a.search(/\s+(Zugelassen|Überarbeitet|Evidenzlevel|MeSH|Konzeptfokus|Definition|Bestimmende Merkmale|Risikofaktoren|Risikopopulation|Assoziierte Bedingungen)\b/i);
    title=(stop>=0?a.slice(0,stop):a).replace(/^[-–•\s]+/,'').trim();
  }
  return {
    domain:dm?dm[1]+' '+dm[2].trim():'',
    className:dm?dm[3]+' '+dm[4].trim():'',
    code:code?.[1]||'',
    title:cleanupTitle(title),
    area:''
  };
}

const AREA_RULES=[
  ['Bewegung / Mobilität',/\b(gehen|gehfähigkeit|gang|mobilität|bewegung|transfer|sturz|rollator|rollstuhl|stehen|sitzen)\b/gi],
  ['Atmung',/\b(atmung|dyspnoe|atem|husten|sauerstoff|sekret|pneumonie)\b/gi],
  ['Ernährung / Schlucken',/\b(ernährung|nahrung|essen|trinken|schluck|dysphag|mangelernährung)\b/gi],
  ['Ausscheidung',/\b(ausscheidung|urin|miktion|stuhl|defäkation|inkontinenz|obstipation)\b/gi],
  ['Schmerz',/\b(schmerz|schmerzen|analges)\b/gi],
  ['Haut / Wunde',/\b(haut|wunde|dekubitus|läsion|druckstelle)\b/gi],
  ['Ruhen / Schlafen',/\b(schlaf|schlafen|ruhen|ruhe)\b/gi],
  ['Orientierung / Kognition',/\b(orientierung|desorientiert|demenz|kognition|kognitiv|verwirr)\b/gi],
  ['Körperpflege / Kleiden',/\b(körperpflege|waschung|waschen|kleiden|anziehen|selbstfürsorge)\b/gi],
  ['Kommunikation',/\b(kommunikation|sprechen|sprache|verstehen|aphasie)\b/gi],
  ['Kreislauf',/\b(kreislauf|blutdruck|puls|herz|synkope)\b/gi]
];

function guessArea(text=''){
  const head=String(text).slice(0,7000);
  let best='',score=0;
  for(const [name,re] of AREA_RULES){
    re.lastIndex=0;
    const n=(head.match(re)||[]).length;
    if(n>score){score=n;best=name}
  }
  return best;
}

export function enpMeta(text=''){
  const c=String(text).replace(/\s+/g,' ').trim();
  const candidates=[
    /\bRisiko\s+(?:für|des|der|eines|einer)?\s*[^.;]{3,150}/i,
    /\bBeeinträchtigte(?:r|s)?\s+[^.;]{3,150}/i,
    /\bSelbstfürsorgedefizit\s+[^.;]{3,150}/i,
    /\bInsuffiziente\s+[^.;]{3,150}/i,
    /\bDehydratation\b[^.;]{0,110}/i,
    /\bMangelernährung\b[^.;]{0,110}/i,
    /\bPflegediagnose\s*:?\s*([^.;]{4,150})/i
  ];
  let title='',pos=Infinity;
  for(const re of candidates){
    const m=re.exec(c);
    if(m&&m.index<pos){pos=m.index;title=m[1]||m[0]}
  }
  return {domain:'',className:'',code:'',title:cleanupTitle(title),area:guessArea(c)};
}

export function extractSectionRanges(text=''){
  const src=String(text);
  const starts=[];
  for(const [label,re0] of SECTION_DEFS){
    const re=new RegExp(re0.source,re0.flags);
    for(const m of src.matchAll(re))starts.push({label,start:m.index,endHeading:m.index+m[0].length});
  }
  starts.sort((a,b)=>a.start-b.start);
  return starts.map((x,i)=>({
    label:x.label,
    start:x.start,
    end:i+1<starts.length?starts[i+1].start:src.length,
    text:src.slice(x.endHeading,i+1<starts.length?starts[i+1].start:src.length).trim()
  }));
}

function detectBookPageFromText(text='',pdfPage=''){
  const lines=String(text).split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const nums=lines.slice(-18).filter(x=>/^\d{1,4}$/.test(x)).map(Number);
  if(!nums.length)return '';
  const pdf=Number(pdfPage)||0;
  if(pdf){
    const plausible=nums.filter(n=>Math.abs(n-pdf)<=25);
    if(plausible.length)return String(plausible.sort((a,b)=>Math.abs(a-pdf)-Math.abs(b-pdf))[0]);
  }
  return String(nums[nums.length-1]);
}

function diagnosisKey(kind,meta){
  const core=meta.code||meta.title||'';
  return core?kind+':'+normalize(core):'';
}

function hasInfo(text=''){return INFO_MARKERS.test(String(text))}

export function enrichBookIndex(book){
  const pages=(book.index?.pages||[]).map((p,i)=>{
    const parsed=p.kind==='NANDA'?nandaMeta(p.text||''):enpMeta(p.text||'');
    return {
      ...p,
      page:Number(p.page||i+1),
      bookPage:p.bookPage||detectBookPageFromText(p.text||'',p.page||i+1),
      meta:{...parsed},
      sections:extractSectionRanges(p.text||'').map(s=>s.label),
      diagnosisKey:''
    };
  });

  let current=null;
  let anchorIndex=-99;
  for(let i=0;i<pages.length;i++){
    const p=pages[i];
    if(isNavigationPage(p.text||'')){current=null;anchorIndex=-99;continue}
    const meta=p.meta||{};
    const nandaAnchor=p.kind==='NANDA'&&Boolean(meta.code&&meta.title);
    const enpAnchor=p.kind==='ENP'&&Boolean(meta.title&&hasInfo(p.text));
    if(nandaAnchor||enpAnchor){
      if(!meta.area)meta.area=guessArea(p.text||'');
      current={...meta,diagnosisKey:diagnosisKey(p.kind,meta),anchorPage:p.page};
      anchorIndex=i;
      p.diagnosisKey=current.diagnosisKey;
    }else if(current&&i-anchorIndex<=3&&hasInfo(p.text)){
      p.meta={
        domain:meta.domain||current.domain||'',
        className:meta.className||current.className||'',
        code:meta.code||current.code||'',
        title:meta.title||current.title||'',
        area:meta.area||current.area||guessArea(p.text||''),
        inherited:true
      };
      p.diagnosisKey=current.diagnosisKey;
    }else{
      if(meta.area||meta.title){
        p.meta.area=meta.area||guessArea(p.text||'');
        p.diagnosisKey=diagnosisKey(p.kind,p.meta);
      }
    }
  }
  return {...book,index:{...(book.index||{}),pages}};
}

function isSearchableDiagnosisPage(page){
  if(isNavigationPage(page.text||''))return false;
  const t=String(page.text||'').trim();
  if(t.length<120)return false;
  if(page.kind==='NANDA')return Boolean(page.meta?.code&&page.meta?.title&&(hasInfo(t)||page.meta?.inherited));
  if(page.kind==='ENP')return Boolean(page.meta?.title&&(hasInfo(t)||page.meta?.inherited));
  return false;
}

function matchingSections(page,terms=[]){
  const nterms=terms.map(normalize).filter(x=>x.length>1);
  const out=[];
  const titleHay=normalize([page.meta?.title,page.meta?.domain,page.meta?.className,page.meta?.area].filter(Boolean).join(' '));
  if(nterms.some(t=>titleHay.includes(t)))out.push('Titel / Klassifikation');
  for(const section of extractSectionRanges(page.text||'')){
    const hay=normalize(section.text);
    if(nterms.some(t=>hay.includes(t)))out.push(section.label);
  }
  if(!out.length){
    const hay=normalize(page.text||'');
    if(nterms.some(t=>hay.includes(t)))out.push('Seitentext');
  }
  return [...new Set(out)];
}

const STEMS=[
  [/пад|упаст|падает|паден/i,['sturz','sturzrisiko','sturzgefährdung']],
  [/головокруж/i,['schwindel']],
  [/слаб/i,['schwäche','muskelkraft','kraft']],
  [/ход|ходит|ходить|идти|идет|шага/i,['gehen','gehfähigkeit','gang','mobilität','bewegung']],
  [/боится ход|страх.*ход|ход.*боится|боится идти|страшно ход/i,['sturzangst','angst beim gehen','angst zu fallen','gehfähigkeit','sturz','sturzrisiko','mobilität']],
  [/боится упаст|страх.*пад/i,['sturzangst','sturzrisiko','sturz','angst zu fallen']],
  [/встав|поднят.*с кров|садит/i,['transfer','aufstehen','stehen','sitzen','mobilität']],
  [/одыш|тяжело дыш|не хватает воздух/i,['dyspnoe','atmung','atemnot']],
  [/каш/i,['husten']],[/боль|болит/i,['schmerz','schmerzen']],
  [/мыть|умыва|душ|гигиен/i,['körperwaschung','körperpflege','selbstfürsorge']],
  [/есть|еда|аппетит/i,['nahrungsaufnahme','ernährung','mangelernährung']],
  [/глот/i,['schlucken','dysphagie']],[/моч|писа|инконт/i,['urin','miktion','inkontinenz']],
  [/стул|запор|дефек/i,['stuhlgang','defäkation','obstipation']],[/спат|сон|бессон/i,['schlaf','ruhen','schlafstörung']],
  [/страх|боится|тревог/i,['angst','furcht']],[/демен|путает|дезориент/i,['demenz','kognition','desorientierung']],
  [/рана|кожа|пролеж/i,['wunde','haut','dekubitus']]
];

const DIRECTIONS=[
  {id:'mobility-fall',title:'Mobilität / Sturzrisiko',test:q=>/(боится ход|страх.*ход|ход.*боится|боится идти|пад|упаст|sturz|sturzangst|gehfähig|gehen|mobil|встав)/i.test(q),terms:['gehfähigkeit','gehen','mobilität','bewegung','sturz','sturzrisiko','sturzangst','gang','transfer','aufstehen'],description:'Ищу нарушение ходьбы, вставания, страх падения и риск падения.'},
  {id:'breathing',title:'Atmung',test:q=>/(одыш|дыш|каш|dyspnoe|atmung|husten)/i.test(q),terms:['atmung','dyspnoe','atemnot','husten'],description:'Ищу страницы по дыханию и одышке.'},
  {id:'pain',title:'Schmerz',test:q=>/(боль|болит|schmerz)/i.test(q),terms:['schmerz','schmerzen'],description:'Ищу страницы, связанные с болью.'},
  {id:'nutrition',title:'Ernährung / Schlucken',test:q=>/(еда|есть|аппет|глот|ernähr|schluck|dysphag)/i.test(q),terms:['ernährung','nahrungsaufnahme','schlucken','dysphagie'],description:'Ищу страницы по питанию и глотанию.'},
  {id:'elimination',title:'Ausscheidung',test:q=>/(моч|стул|запор|inkont|urin|stuhl|obstipation)/i.test(q),terms:['ausscheidung','urin','miktion','inkontinenz','stuhlgang','obstipation'],description:'Ищу страницы по выделению.'},
  {id:'skin',title:'Haut / Wunde',test:q=>/(рана|кожа|пролеж|wunde|haut|dekub)/i.test(q),terms:['haut','wunde','dekubitus'],description:'Ищу страницы по коже и ранам.'},
  {id:'cognition',title:'Orientierung / Kognition',test:q=>/(демен|путает|дезориент|demenz|kogn|orient)/i.test(q),terms:['demenz','kognition','orientierung','desorientierung'],description:'Ищу страницы по ориентации и когнитивным нарушениям.'}
];

export function expandQuery(query=''){
  const semantic=inferSemanticQuery(query);
  const set=new Set(semantic.terms);
  for(const [re,terms] of STEMS)if(re.test(query))terms.forEach(t=>set.add(t));
  const direction=DIRECTIONS.find(d=>d.test(query))||null;
  direction?.terms.forEach(t=>set.add(t));
  return {
    terms:[...set],
    direction,
    riskIntent:semantic.riskIntent,
    concepts:semantic.concepts
  };
}

export function createSearchEngine(books=[]){
  const Ctor=MiniSearchCtor();
  if(!Ctor)throw new Error('MiniSearch не загрузился');
  const lookup=new Map();
  const docs=[];
  for(const rawBook of books){
    const book=enrichBookIndex(rawBook);
    for(const p of book.index?.pages||[]){
      if(!isSearchableDiagnosisPage(p))continue;
      const id=p.kind+':'+p.page;
      lookup.set(id,p);
      docs.push({
        id,
        diagnosisKey:p.diagnosisKey||id,
        title:p.meta?.title||'',
        text:p.text||'',
        domain:p.meta?.domain||'',
        className:p.meta?.className||'',
        area:p.meta?.area||'',
        kind:p.kind,
        page:String(p.page),
        bookPage:String(p.bookPage||'')
      });
    }
  }
  const mini=new Ctor({
    fields:['title','text','domain','className','area'],
    storeFields:['kind','page','bookPage','title','domain','className','area','diagnosisKey'],
    processTerm:term=>normalize(term),
    searchOptions:{prefix:true,fuzzy:0.16,boost:{title:6,area:3,domain:2,className:2,text:1}}
  });
  if(docs.length)mini.addAll(docs);

  return {
    count:docs.length,
    search(query,limit=10){
      const {terms,direction,riskIntent,concepts}=expandQuery(query);
      const phrase=terms.join(' ');
      const raw=mini.search(phrase,{combineWith:'OR',prefix:true,fuzzy:0.16,boost:{title:7,area:3,domain:2,className:2,text:1}}).slice(0,80);
      const pages=raw.map(r=>{
        const p=lookup.get(String(r.id));
        if(!p)return null;
        const matchSections=matchingSections(p,terms);
        let bonus=0;
        const hay=normalize([p.meta?.title,p.meta?.area,p.meta?.domain,p.meta?.className,p.text?.slice(0,2200)].filter(Boolean).join(' '));
        if(direction)for(const t of direction.terms)if(hay.includes(normalize(t)))bonus+=1.1;
        if(riskIntent){
          if(/\bRisiko\b/i.test(p.meta?.title||''))bonus+=8;
          if(/\bRisikofaktoren\b/i.test(p.text||''))bonus+=2;
        }
        for(const concept of concepts||[]){
          if((concept.terms||[]).some(t=>hay.includes(normalize(t))))bonus+=1.4;
        }
        if(matchSections.some(x=>/Titel|Bestimmende|Kennzeichen|Beeinflussende|Ursachen|Risikofaktoren/.test(x)))bonus+=4;
        if(matchSections.some(x=>/Pflegemaßnahmen|Pflegeziele/.test(x)))bonus+=1;
        return {...p,searchScore:r.score+bonus,matchSections};
      }).filter(Boolean);

      const groups=new Map();
      for(const p of pages){
        const key=p.diagnosisKey||p.kind+':'+p.page;
        if(!groups.has(key))groups.set(key,{key,kind:p.kind,meta:p.meta,pages:[],searchScore:0,matchSections:new Set(),topic:p.meta?.area||direction?.title||''});
        const g=groups.get(key);
        g.pages.push(p);
        g.searchScore=Math.max(g.searchScore,p.searchScore);
        p.matchSections.forEach(x=>g.matchSections.add(x));
        if(!g.meta?.domain&&p.meta?.domain)g.meta=p.meta;
      }

      const result=[...groups.values()].map(g=>{
        g.pages.sort((a,b)=>b.searchScore-a.searchScore);
        const best=g.pages[0];
        return {
          ...best,
          meta:{...best.meta,topic:best.meta?.area||direction?.title||''},
          relatedPages:g.pages.map(p=>({page:p.page,bookPage:p.bookPage||'',score:p.searchScore,matchSections:p.matchSections})),
          matchSections:[...g.matchSections],
          searchScore:g.searchScore
        };
      }).sort((a,b)=>b.searchScore-a.searchScore).slice(0,limit);

      return {hits:result,direction,terms,riskIntent,concepts};
    }
  };
}
