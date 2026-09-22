import { getInterviewDefinition, SOURCE_REGISTRY } from './clinicalKnowledge.js';

function cleanSourceText(value=''){
  let v=String(value??'').normalize('NFKC');
  const fixes=[
    ['Ã¤','ä'],['Ã¶','ö'],['Ã¼','ü'],['Ã„','Ä'],['Ã–','Ö'],['Ãœ','Ü'],['ÃŸ','ß'],
    ['â€“','–'],['â€”','—'],['â€ž','„'],['â€œ','“'],['â€','”'],['â†’','→'],['Â','']
  ];
  for(const [bad,good] of fixes)v=v.split(bad).join(good);
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ')
    .replace(/�+/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function readableEnough(value=''){
  const v=cleanSourceText(value);
  if(v.length<3)return false;
  const letters=(v.match(/[A-Za-zÀ-ÖØ-öø-ÿА-Яа-яЁё]/g)||[]).length;
  const odd=(v.match(/[^A-Za-zÀ-ÖØ-öø-ÿА-Яа-яЁё0-9\s.,;:()\-–—/+'%≤≥]/g)||[]).length;
  return letters/Math.max(v.length,1)>=0.35 && odd<=Math.max(4,Math.floor(v.length*0.08));
}

function uniq(items=[]){
  const out=[],seen=new Set();
  for(const x of items){
    const v=String(x||'').trim();
    if(!v)continue;
    const k=v.toLowerCase();
    if(seen.has(k))continue;
    seen.add(k);out.push(v);
  }
  return out;
}

function optionValue(question,raw=''){
  const input=String(raw||'').trim();
  if(!question?.options?.length)return input;
  const n=input.toLowerCase();
  const direct=question.options.find(o=>
    o.value===input||
    String(o.ru||'').toLowerCase()===n||
    String(o.de||'').toLowerCase()===n
  );
  if(direct)return direct.value;
  if(/^(да|yes|ja|ага|есть)$/i.test(input)){
    const yes=question.options.find(o=>o.value==='yes');if(yes)return yes.value;
  }
  if(/^(нет|no|nein|неа)$/i.test(input)){
    const no=question.options.find(o=>o.value==='no');if(no)return no.value;
  }
  if(/не знаю|unknown|unbekannt|неизвест/i.test(input)){
    const u=question.options.find(o=>o.value==='unknown');if(u)return u.value;
  }
  return input;
}

function optionLabel(question,value,lang='ru'){
  const o=question?.options?.find(x=>x.value===value);
  if(!o)return String(value||'');
  return lang==='de'?(o.de||o.ru||o.value):(o.ru||o.de||o.value);
}

function questionEnabled(q,answers){
  if(typeof q.askIf!=='function')return true;
  try{return q.askIf(answers)!==false}catch{return true}
}

function bookItems(items=[],limit=6){
  const out=[];
  const seen=new Set();
  for(const item of items||[]){
    const text=cleanSourceText(item?.text||item||'');
    if(text.length<3||text.length>220||!readableEnough(text))continue;
    const k=text.toLowerCase();
    if(seen.has(k))continue;
    seen.add(k);
    out.push({
      value:text,
      ru:text,
      de:text,
      source:item?.kind&&item?.page?item.kind+' S. '+item.page:(item?.source||'')
    });
    if(out.length>=limit)break;
  }
  return out;
}

export function createCareDialogue({query='',selectedHit=null,hits=[],direction=null,patient=null,model=null,concepts=[]}={}){
  const def=getInterviewDefinition({
    query,
    title:selectedHit?.meta?.title||'',
    concepts
  });

  const questions=[...def.questions];
  const selectedRisk=/\bRisiko\b/i.test(selectedHit?.meta?.title||'')||model?.diagnoses?.find(d=>d.title===selectedHit?.meta?.title)?.risk===true;

  const factorOptions=bookItems((selectedRisk?model?.riskFactors:model?.causes)||[],6);
  if(factorOptions.length){
    const insertAt=Math.max(1,questions.findIndex(q=>q.id==='goal'));
    questions.splice(insertAt,0,{
      id:'bookFactors',
      ru:selectedRisk?'NANDA/ENP нашли дополнительные Risikofaktoren. Какие из них реально есть у пациента?':'NANDA/ENP нашли дополнительные Ursachen/Einflussfaktoren. Какие из них реально относятся к пациенту?',
      de:selectedRisk?'NANDA/ENP zeigen zusätzliche Risikofaktoren. Welche treffen tatsächlich zu?':'NANDA/ENP zeigen zusätzliche Ursachen/Einflussfaktoren. Welche treffen tatsächlich zu?',
      type:'multi',
      options:factorOptions
    });
  }

  const symptomOptions=bookItems(model?.symptoms||[],6);
  if(!selectedRisk&&symptomOptions.length){
    const insertAt=Math.max(1,questions.findIndex(q=>q.id==='goal'));
    questions.splice(insertAt,0,{
      id:'bookSymptoms',
      ru:'Какие Kennzeichen/Symptome из книги реально наблюдаются?',
      de:'Welche Kennzeichen/Symptome aus dem Buch sind tatsächlich beobachtbar?',
      type:'multi',
      options:symptomOptions
    });
  }

  const resourceOptions=bookItems(model?.resources||[],5);
  if(resourceOptions.length){
    const insertAt=Math.max(1,questions.findIndex(q=>q.id==='goal'));
    questions.splice(insertAt,0,{
      id:'bookResources',
      ru:'Какие Ressourcen из книги реально есть у пациента?',
      de:'Welche Ressourcen aus dem Buch sind tatsächlich vorhanden?',
      type:'multi',
      options:resourceOptions
    });
  }

  const bookGoalOptions=bookItems(model?.goals||[],5);
  if(bookGoalOptions.length){
    const idx=Math.max(0,questions.findIndex(q=>q.id==='goal'));
    questions.splice(idx,0,{
      id:'bookGoal',
      ru:'Из ENP/NANDA есть готовые варианты цели. Выбери основу или нажми «Своя формулировка».',
      de:'Aus ENP/NANDA gibt es Zielvorschläge. Wähle eine Grundlage oder eine eigene Formulierung.',
      type:'choice',
      options:[
        ...bookGoalOptions,
        {value:'custom',ru:'Своя формулировка',de:'Eigene Formulierung'}
      ]
    });
  }

  const measureOptions=bookItems(model?.measures||[],7);
  if(measureOptions.length){
    const pidx=Math.max(0,questions.findIndex(q=>q.id==='period'));
    questions.splice(pidx<0?questions.length:pidx+1,0,{
      id:'measures',
      ru:'Какие меры из ENP подходят этому пациенту? Можно выбрать несколько.',
      de:'Welche Maßnahmen aus ENP passen zu dieser Person? Mehrfachauswahl möglich.',
      type:'multi',
      options:measureOptions
    });
  }

  questions.push({
    id:'evaluation',
    ru:'Как будем проверять результат? Например: ежедневно при Frühdienst или в конце срока по конкретному Messkriterium.',
    de:'Wie soll das Ergebnis evaluiert werden? Zum Beispiel täglich im Frühdienst oder am Ende des Zeitraums anhand des Messkriteriums.',
    type:'text'
  });

  return {
    id:'dlg-'+Date.now(),
    query,
    selectedHit,
    hits,
    direction,
    patient,
    model,
    definition:def,
    questions,
    answers:{},
    displayAnswers:{},
    index:0,
    done:false,
    redFlags:[],
    sourceIds:def.sources||[],
    startedAt:Date.now()
  };
}

export function currentDialogueQuestion(session){
  if(!session||session.done)return null;
  while(session.index<session.questions.length){
    const q=session.questions[session.index];
    if(questionEnabled(q,session.answers))return q;
    session.index++;
  }
  session.done=true;
  return null;
}

export function answerCareDialogue(session,raw,lang='ru'){
  const q=currentDialogueQuestion(session);
  if(!q)return {done:true,question:null};

  let value;
  if(q.type==='multi'){
    value=Array.isArray(raw)?raw.map(String):String(raw||'').split(/\s*[,;]\s*/).filter(Boolean);
  }else{
    value=optionValue(q,raw);
  }

  session.answers[q.id]=value;
  if(q.type==='multi'){
    session.displayAnswers[q.id]=value.join('; ');
  }else{
    session.displayAnswers[q.id]=optionLabel(q,value,lang);
  }

  const checkMap=(map,label)=>{
    const x=map?.[value];
    if(x)return {label,text:x};
    return null;
  };

  const flag=q.redFlag?.[value];
  if(flag&&!session.redFlags.includes(flag))session.redFlags.push(flag);

  session.index++;
  const next=currentDialogueQuestion(session);
  if(!next)session.done=true;

  return {
    done:session.done,
    answered:q,
    value,
    next
  };
}

export function dialogueQuickOptions(question,lang='ru'){
  if(!question?.options?.length)return [];
  return question.options.map(o=>({
    value:o.value,
    label:cleanSourceText(lang==='de'?(o.de||o.ru||o.value):(o.ru||o.de||o.value)),
    source:o.source||''
  }));
}

function factFrom(question,answer,key){
  const map=question?.[key];
  if(!map)return '';
  if(Array.isArray(answer))return '';
  return map[answer]||'';
}

export function compileDialogueData(session){
  const factors=[],symptoms=[],resources=[],facts=[];
  for(const q of session.questions){
    const ans=session.answers[q.id];
    if(ans===undefined)continue;
    const factor=factFrom(q,ans,'factor');if(factor)factors.push(factor);
    const symptom=factFrom(q,ans,'symptom');if(symptom)symptoms.push(symptom);
    const resource=factFrom(q,ans,'resourceMap');if(resource)resources.push(resource);
    const fact=factFrom(q,ans,'fact');if(fact)facts.push(fact);
  }

  if(session.answers.walkingDetail)resources.push(String(session.answers.walkingDetail));
  if(session.answers.observed)symptoms.push(String(session.answers.observed));
  if(session.answers.cause)factors.push(String(session.answers.cause));
  if(session.answers.resource)resources.push(String(session.answers.resource));
  if(session.answers.location)facts.push('Lokalisation: '+session.answers.location);
  if(session.answers.painSite)facts.push('Schmerzlokalisation: '+session.answers.painSite);
  if(session.answers.painNrs)facts.push('Schmerzintensität NRS: '+session.answers.painNrs);
  if(session.answers.painEffect)symptoms.push(String(session.answers.painEffect));

  const goal=session.answers.goal||
    (session.answers.bookGoal&&session.answers.bookGoal!=='custom'?session.answers.bookGoal:'')||
    '';
  const period=session.answers.period||'';
  const measures=Array.isArray(session.answers.measures)?session.answers.measures:[];
  const bookFactors=Array.isArray(session.answers.bookFactors)?session.answers.bookFactors:[];
  const bookSymptoms=Array.isArray(session.answers.bookSymptoms)?session.answers.bookSymptoms:[];
  const bookResources=Array.isArray(session.answers.bookResources)?session.answers.bookResources:[];

  return {
    factors:uniq([...factors,...facts,...bookFactors]),
    symptoms:uniq([...symptoms,...bookSymptoms]),
    resources:uniq([...resources,...bookResources]),
    goal:String(goal||'').trim(),
    period:String(period||'').trim(),
    measures:uniq(measures),
    evaluation:String(session.answers.evaluation||'').trim(),
    redFlags:[...session.redFlags],
    sourceIds:[...session.sourceIds]
  };
}

export function dialogueSourceInfo(session){
  return (session?.sourceIds||[]).map(id=>SOURCE_REGISTRY[id]).filter(Boolean);
}

export function dialogueSummary(session,lang='ru'){
  const data=compileDialogueData(session);
  const yes=lang==='de';
  const rows=[];
  if(data.factors.length)rows.push((yes?'Faktoren/Ursachen: ':'Факторы/причины: ')+data.factors.join('; '));
  if(data.symptoms.length)rows.push((yes?'Symptome/Kennzeichen: ':'Симптомы/признаки: ')+data.symptoms.join('; '));
  if(data.resources.length)rows.push((yes?'Ressourcen: ':'Ресурсы: ')+data.resources.join('; '));
  if(data.goal)rows.push((yes?'Ziel: ':'Цель: ')+data.goal);
  if(data.period)rows.push((yes?'Zeitraum: ':'Срок: ')+data.period);
  if(data.measures.length)rows.push((yes?'Maßnahmen: ':'Меры: ')+data.measures.join('; '));
  return rows.join('\n');
}
