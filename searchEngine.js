const MiniSearchCtor = () => window.MiniSearch;

export function normalize(value='') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');
}

const NAV_RE=/\b(Inhaltsverzeichnis|Inhaltsverzeichnis der ENP-Pflegediagnosen|Stichwortverzeichnis|Sachverzeichnis|Diagnosenverzeichnis|Index)\b/i;
const INFO_MARKERS=/\b(Definition|Bestimmende Merkmale|Beeinflussende Faktoren|Risikofaktoren|Risikopopulation|Assoziierte Bedingungen|Kennzeichen|Ursachen|Ressourcen|Pflegeziele|Pflegemaßnahmen|Pflegeinterventionen|LOE\s+PD|LOE\s+PL)\b/i;

export function isNavigationPage(text='') {
  const t=text.replace(/\s+/g,' ').trim();
  if(!t || t.length<120) return true;
  return NAV_RE.test(t);
}

export function nandaMeta(text='') {
  const c=text.replace(/\s+/g,' ').trim();
  const dm=c.match(/Domäne\s+(\d+)\.?\s*([^]{0,90}?)\s+Klasse\s+(\d+)\.?\s*([^]{0,100}?)(?=\s+Diagnosencode|\s+\d{3,5}\b|$)/i);
  const code=c.match(/Diagnosencode\s+(\d{3,5})/i);
  let title='';
  if(code){
    const p=c.indexOf(code[0]);
    const a=c.slice(p+code[0].length,p+code[0].length+260);
    const stop=a.search(/\s+(Zugelassen|Überarbeitet|Evidenzlevel|MeSH|Konzeptfokus|Definition|Bestimmende Merkmale|Risikofaktoren)\b/i);
    title=(stop>=0?a.slice(0,stop):a).replace(/^[-–•\s]+/,'').trim();
  }
  return {
    domain:dm?`${dm[1]} ${dm[2].trim()}`:'',
    className:dm?`${dm[3]} ${dm[4].trim()}`:'',
    code:code?.[1]||'',
    title:cleanupTitle(title)
  };
}

const AREA_RULES=[
  ['Bewegung/Mobilität',/\b(gehen|gehfähigkeit|gang|mobilität|bewegung|transfer|sturz|rollator|rollstuhl|stehen|sitzen)\b/gi],
  ['Atmung',/\b(atmung|dyspnoe|atem|husten|sauerstoff|sekret|pneumonie)\b/gi],
  ['Ernährung',/\b(ernährung|nahrung|essen|trinken|schluck|dysphag|mangelernährung)\b/gi],
  ['Ausscheidung',/\b(ausscheidung|urin|miktion|stuhl|defäkation|inkontinenz|obstipation)\b/gi],
  ['Schmerz',/\b(schmerz|schmerzen|analges)\b/gi],
  ['Haut/Wunde',/\b(haut|wunde|dekubitus|läsion|druckstelle)\b/gi],
  ['Ruhen/Schlafen',/\b(schlaf|schlafen|ruhen|ruhe)\b/gi],
  ['Orientierung',/\b(orientierung|desorientiert|demenz|kognition|kognitiv|verwirr)\b/gi],
  ['Körperpflege/Kleiden',/\b(körperpflege|waschung|waschen|kleiden|anziehen|selbstfürsorge)\b/gi],
  ['Kommunikation',/\b(kommunikation|sprechen|sprache|verstehen|aphasie)\b/gi],
  ['Kreislauf',/\b(kreislauf|blutdruck|puls|herz|synkope)\b/gi]
];

function guessArea(text=''){
  const head=text.slice(0,5000);
  let best='',score=0;
  for(const [name,re] of AREA_RULES){
    re.lastIndex=0;
    const n=(head.match(re)||[]).length;
    if(n>score){score=n;best=name}
  }
  return best;
}

function cleanupTitle(value=''){
  return String(value)
    .replace(/\s+/g,' ')
    .split(/\s+»\s+|\b(?:Definition|Kennzeichen|Ursachen|Ressourcen|Pflegeziele|Pflegemaßnahmen|Pflegeinterventionen|LOE\s+PD|LOE\s+PL)\b/i)[0]
    .replace(/\s+\d{1,4}\s*$/,'')
    .replace(/[;,:\-–\s]+$/,'')
    .trim()
    .slice(0,150);
}

export function enpMeta(text=''){
  const c=text.replace(/\s+/g,' ').trim();
  const candidates=[
    /\bRisiko\s+(?:für|des|der|eines|einer)?\s*[^.;]{3,135}/i,
    /\bBeeinträchtigte(?:r|s)?\s+[^.;]{3,135}/i,
    /\bSelbstfürsorgedefizit\s+[^.;]{3,135}/i,
    /\bInsuffiziente\s+[^.;]{3,135}/i,
    /\bDehydratation\b[^.;]{0,100}/i,
    /\bMangelernährung\b[^.;]{0,100}/i
  ];
  let title='',pos=Infinity;
  for(const re of candidates){
    const m=re.exec(c);
    if(m && m.index<pos){pos=m.index;title=m[0]}
  }
  return {domain:'ENP-Praxis',className:guessArea(c),code:'',title:cleanupTitle(title)};
}

function isAnchorPage(page){
  const t=page.text.replace(/\s+/g,' ').trim();
  if(isNavigationPage(t)) return false;
  if(page.kind==='NANDA'){
    return (/Diagnosencode\s+\d{3,5}/i.test(t)||page.meta?.code) && INFO_MARKERS.test(t);
  }
  const markers=[
    /\bDefinition\b/i,/\bKennzeichen\b/i,/\bUrsachen\b/i,/\bRessourcen\b/i,
    /\bPflegeziele\b/i,/\bPflegemaßnahmen\b/i,/\bPflegeinterventionen\b/i,/\bLOE\s+PD\b/i,/\bLOE\s+PL\b/i
  ];
  return markers.reduce((n,r)=>n+(r.test(t)?1:0),0)>=2;
}

function searchablePages(book){
  const pages=book.index?.pages||[];
  const include=new Set();
  pages.forEach((p,i)=>{
    if(isAnchorPage(p)){
      include.add(i);
      if(i>0 && !isNavigationPage(pages[i-1]?.text||'')) include.add(i-1);
      if(i+1<pages.length && !isNavigationPage(pages[i+1]?.text||'')) include.add(i+1);
    }
  });
  return [...include].sort((a,b)=>a-b).map(i=>pages[i]).filter(p=>(p.text||'').trim().length>=120);
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
  [/каш/i,['husten']],
  [/боль|болит/i,['schmerz','schmerzen']],
  [/мыть|умыва|душ|гигиен/i,['körperwaschung','körperpflege','selbstfürsorge']],
  [/есть|еда|аппетит/i,['nahrungsaufnahme','ernährung','mangelernährung']],
  [/глот/i,['schlucken','dysphagie']],
  [/моч|писа|инконт/i,['urin','miktion','inkontinenz']],
  [/стул|запор|дефек/i,['stuhlgang','defäkation','obstipation']],
  [/спат|сон|бессон/i,['schlaf','ruhen','schlafstörung']],
  [/страх|боится|тревог/i,['angst','furcht']],
  [/демен|путает|дезориент/i,['demenz','kognition','desorientierung']],
  [/рана|кожа|пролеж/i,['wunde','haut','dekubitus']]
];

const DIRECTIONS=[
  {
    id:'mobility-fall',
    title:'Mobilität / Sturzrisiko',
    test:q=>/(боится ход|страх.*ход|ход.*боится|боится идти|пад|упаст|sturz|sturzangst|gehfähig|gehen|mobil)/i.test(q),
    terms:['gehfähigkeit','gehen','mobilität','bewegung','sturz','sturzrisiko','sturzangst','gang','transfer'],
    description:'Ищу одновременно нарушение ходьбы, страх падения и риск падения. Диагноз автоматически не назначается — показываются подходящие страницы NANDA и ENP.'
  },
  {id:'breathing',title:'Atmung',test:q=>/(одыш|дыш|каш|dyspnoe|atmung|husten)/i.test(q),terms:['atmung','dyspnoe','atemnot','husten'],description:'Ищу страницы по дыханию, одышке и связанным Pflegeproblemen.'},
  {id:'pain',title:'Schmerz',test:q=>/(боль|болит|schmerz)/i.test(q),terms:['schmerz','schmerzen'],description:'Ищу страницы, связанные с болью и Pflegebedarf.'},
  {id:'nutrition',title:'Ernährung / Schlucken',test:q=>/(еда|есть|аппет|глот|ernähr|schluck|dysphag)/i.test(q),terms:['ernährung','nahrungsaufnahme','schlucken','dysphagie'],description:'Ищу страницы по питанию и глотанию.'},
  {id:'elimination',title:'Ausscheidung',test:q=>/(моч|стул|запор|inkont|urin|stuhl|obstipation)/i.test(q),terms:['ausscheidung','urin','miktion','inkontinenz','stuhlgang','obstipation'],description:'Ищу страницы по мочеиспусканию и дефекации.'},
  {id:'skin',title:'Haut / Wunde',test:q=>/(рана|кожа|пролеж|wunde|haut|dekub)/i.test(q),terms:['haut','wunde','dekubitus'],description:'Ищу страницы по коже, ранам и рискам повреждения кожи.'},
  {id:'cognition',title:'Orientierung / Kognition',test:q=>/(демен|путает|дезориент|demenz|kogn|orient)/i.test(q),terms:['demenz','kognition','orientierung','desorientierung'],description:'Ищу страницы по ориентации, когнитивным нарушениям и связанным рискам.'}
];

export function expandQuery(query=''){
  const set=new Set(query.split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1));
  for(const [re,terms] of STEMS) if(re.test(query)) terms.forEach(t=>set.add(t));
  const direction=DIRECTIONS.find(d=>d.test(query))||null;
  direction?.terms.forEach(t=>set.add(t));
  return {terms:[...set],direction};
}

export function createSearchEngine(books=[]){
  const Ctor=MiniSearchCtor();
  if(!Ctor) throw new Error('MiniSearch не загрузился');
  const lookup=new Map();
  const docs=[];
  for(const book of books){
    for(const p of searchablePages(book)){
      const id=`${p.kind}:${p.page}`;
      lookup.set(id,p);
      docs.push({
        id,
        title:p.meta?.title||'',
        text:p.text||'',
        domain:p.meta?.domain||'',
        className:p.meta?.className||'',
        kind:p.kind,
        page:String(p.page)
      });
    }
  }
  const mini=new Ctor({
    fields:['title','text','domain','className'],
    storeFields:['kind','page','title','domain','className'],
    processTerm:term=>normalize(term),
    searchOptions:{prefix:true,fuzzy:0.16,boost:{title:4,domain:1.5,className:1.5}}
  });
  if(docs.length) mini.addAll(docs);

  return {
    count:docs.length,
    search(query,limit=10){
      const {terms,direction}=expandQuery(query);
      const phrase=terms.join(' ');
      const raw=mini.search(phrase,{combineWith:'OR',prefix:true,fuzzy:0.16,boost:{title:5,domain:1.8,className:1.8}}).slice(0,40);
      const ranked=raw.map(r=>{
        const p=lookup.get(String(r.id));
        let bonus=0;
        const hay=normalize((p?.meta?.title||'')+' '+(p?.meta?.className||'')+' '+(p?.text||'').slice(0,1800));
        if(direction) for(const t of direction.terms) if(hay.includes(normalize(t))) bonus+=1.2;
        if(direction?.id==='mobility-fall' && /sturzangst|sturzrisiko|gehfähigkeit|risiko für stürze|risiko des sturzes/i.test(hay)) bonus+=5;
        return {...p,searchScore:r.score+bonus};
      }).filter(Boolean).sort((a,b)=>b.searchScore-a.searchScore);
      const seen=new Set();
      const result=[];
      for(const p of ranked){
        const key=`${p.kind}:${p.page}`;
        if(seen.has(key)) continue;
        seen.add(key);result.push(p);
        if(result.length>=limit) break;
      }
      return {hits:result,direction,terms};
    }
  };
}
