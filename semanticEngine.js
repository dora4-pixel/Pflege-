export const SEMANTIC_CONCEPTS=[
  {
    id:'skin-integrity',label:'Haut / Hautintegrität',
    triggers:[/кож/i,/раздраж/i,/покрасн/i,/опрел/i,/сып/i,/зуд/i,/рана/i,/пролеж/i,/haut/i,/irrit/i,/röt/i,/erythem/i,/intertrig/i,/läsion/i,/dekubit/i,/wund/i],
    terms:['haut','hautintegrität','beeinträchtigte hautintegrität','hautirritation','hautreizung','rötung','erythem','intertrigo','juckreiz','läsion','wunde','dekubitus','druckschädigung']
  },
  {
    id:'mobility',label:'Mobilität / Bewegung',
    triggers:[/ход/i,/идт/i,/шага/i,/встав/i,/стоять/i,/садит/i,/движ/i,/mobil/i,/geh/i,/gang/i,/transfer/i,/aufsteh/i,/steh/i],
    terms:['mobilität','bewegung','gehen','gehfähigkeit','gang','transfer','aufstehen','stehen','sitzen','bewegungsfähigkeit']
  },
  {
    id:'fall',label:'Sturz / Sturzrisiko',
    triggers:[/пад/i,/упаст/i,/sturz/i,/sturzangst/i,/fall risk/i],
    terms:['sturz','sturzrisiko','sturzgefährdung','sturzangst','angst zu fallen','gleichgewicht','standsicherheit']
  },
  {
    id:'breathing',label:'Atmung',
    triggers:[/одыш/i,/дыш/i,/каш/i,/мокрот/i,/atm/i,/dyspn/i,/hust/i,/sekret/i],
    terms:['atmung','atemnot','dyspnoe','husten','sekret','sauerstoff','pneumonie','aspiration']
  },
  {
    id:'nutrition',label:'Ernährung / Flüssigkeit',
    triggers:[/еда/i,/есть/i,/аппет/i,/питани/i,/жажд/i,/обезвож/i,/ernähr/i,/nahrung/i,/appetit/i,/dehyd/i],
    terms:['ernährung','nahrungsaufnahme','appetit','mangelernährung','flüssigkeitsaufnahme','dehydratation','exsikkose']
  },
  {
    id:'swallowing',label:'Schlucken / Aspiration',
    triggers:[/глот/i,/подав/i,/аспирац/i,/schluck/i,/dysphag/i,/aspirat/i],
    terms:['schlucken','dysphagie','aspiration','aspirationsrisiko','schluckstörung']
  },
  {
    id:'urinary',label:'Miktion / Kontinenz',
    triggers:[/моч/i,/писа/i,/недерж/i,/катетер/i,/urin/i,/miktion/i,/inkont/i,/katheter/i],
    terms:['urin','miktion','harninkontinenz','inkontinenz','harnverhalt','katheter','kontinenz']
  },
  {
    id:'bowel',label:'Stuhl / Defäkation',
    triggers:[/стул/i,/запор/i,/понос/i,/дефек/i,/stuhl/i,/obstip/i,/diarr/i,/defäk/i],
    terms:['stuhlgang','defäkation','obstipation','diarrhoe','stuhlinkontinenz','ausscheidung']
  },
  {
    id:'pain',label:'Schmerz',
    triggers:[/боль/i,/болит/i,/schmerz/i,/analges/i],
    terms:['schmerz','schmerzen','akuter schmerz','chronischer schmerz','schmerzmanagement']
  },
  {
    id:'sleep',label:'Schlaf / Ruhe',
    triggers:[/спат/i,/сон/i,/бессон/i,/schlaf/i,/ruhe/i],
    terms:['schlaf','schlafstörung','ruhen','ruhe','insomnie']
  },
  {
    id:'cognition',label:'Kognition / Orientierung',
    triggers:[/демен/i,/пута/i,/дезориент/i,/забыв/i,/когнит/i,/demenz/i,/orient/i,/kogn/i,/verwirr/i],
    terms:['demenz','kognition','orientierung','desorientierung','verwirrtheit','gedächtnis']
  },
  {
    id:'anxiety',label:'Angst / Furcht',
    triggers:[/страх/i,/боится/i,/тревог/i,/angst/i,/furcht/i],
    terms:['angst','furcht','ängstlichkeit','unsicherheit']
  },
  {
    id:'self-care',label:'Selbstversorgung / Körperpflege',
    triggers:[/мыть/i,/умыва/i,/душ/i,/гигиен/i,/одев/i,/körperpflege/i,/wasch/i,/kleid/i,/selbstfürs/i],
    terms:['körperpflege','körperwaschung','selbstfürsorge','kleiden','anziehen','selbstversorgung']
  },
  {
    id:'communication',label:'Kommunikation',
    triggers:[/говор/i,/понима/i,/реч/i,/общен/i,/kommunik/i,/sprech/i,/aphas/i,/sprache/i],
    terms:['kommunikation','sprechen','sprache','verständigung','aphasie']
  },
  {
    id:'circulation',label:'Kreislauf',
    triggers:[/давлен/i,/пульс/i,/обмор/i,/головокруж/i,/kreislauf/i,/blutdruck/i,/puls/i,/synkop/i,/schwindel/i],
    terms:['kreislauf','blutdruck','puls','synkope','schwindel','orthostase']
  },
  {
    id:'temperature',label:'Körpertemperatur',
    triggers:[/температур/i,/жар/i,/озноб/i,/fieber/i,/temperatur/i],
    terms:['körpertemperatur','fieber','hyperthermie','hypothermie','temperaturregulation']
  },
  {
    id:'infection',label:'Infektion',
    triggers:[/инфек/i,/воспал/i,/гной/i,/infekt/i,/entzünd/i,/sepsis/i],
    terms:['infektion','infektionsrisiko','entzündung','sepsis','keimbesiedlung']
  },
  {
    id:'edema',label:'Ödem / Flüssigkeit',
    triggers:[/отек/i,/отёк/i,/ödem/i,/wasseransammlung/i],
    terms:['ödem','flüssigkeitsansammlung','peripheres ödem','schwellung']
  },
  {
    id:'contracture',label:'Kontraktur',
    triggers:[/контрактур/i,/скован/i,/kontraktur/i],
    terms:['kontraktur','kontrakturrisiko','bewegungseinschränkung','gelenkbeweglichkeit']
  },
  {
    id:'thrombosis',label:'Thrombose',
    triggers:[/тромб/i,/thromb/i],
    terms:['thrombose','thromboserisiko','venöse thromboembolie']
  }
];

const RISK_RE=/\b(risk|risiko|gefährd|gefahr|prävention|prophylaxe)\b/i;
const RISK_RU=/риск|опасност|угроз|вероятност|профилакт/i;

export function inferSemanticQuery(query=''){
  const q=String(query||'');
  const matched=[];
  const terms=new Set(q.split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1));
  for(const concept of SEMANTIC_CONCEPTS){
    if(concept.triggers.some(re=>re.test(q))){
      matched.push(concept);
      concept.terms.forEach(t=>terms.add(t));
    }
  }
  const riskIntent=RISK_RE.test(q)||RISK_RU.test(q);
  if(riskIntent){
    ['risiko','gefährdung','gefährdet','prävention','prophylaxe'].forEach(t=>terms.add(t));
  }
  const negated=/kein|keine|ohne|нет|не\s+имеет|отсутств/i.test(q);
  return {
    original:q,
    riskIntent,
    negated,
    concepts:matched.map(c=>({id:c.id,label:c.label,terms:c.terms})),
    terms:[...terms]
  };
}

export function semanticLabels(query=''){
  return inferSemanticQuery(query).concepts.map(x=>x.label);
}
