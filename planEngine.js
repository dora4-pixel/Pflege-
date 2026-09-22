import { normalize } from './searchEngine.js';

function section(text='',heads=[],stops=[]){
  const c=String(text).replace(/\s+/g,' ');
  let pos=-1,len=0;
  for(const h of heads){
    const m=new RegExp('\\b'+h+'\\b','i').exec(c);
    if(m&&(pos<0||m.index<pos)){pos=m.index;len=m[0].length}
  }
  if(pos<0)return'';
  const rest=c.slice(pos+len);
  let end=rest.length;
  for(const s of stops){
    const m=new RegExp('\\b'+s+'\\b','i').exec(rest);
    if(m&&m.index<end)end=m.index;
  }
  return rest.slice(0,end).trim();
}

function list(raw='',max=12){
  if(!raw)return[];
  return [...new Set(
    raw.split(/\s*[»•›]\s*|;\s*|\s{2,}/)
      .map(x=>x.replace(/^[-–,:\s]+|[-–,:\s]+$/g,'').trim())
      .filter(x=>x.length>4&&x.length<260)
  )].slice(0,max);
}

function uniq(items=[]){
  const seen=new Set(),out=[];
  for(const item of items){
    const k=normalize(item).replace(/[^\p{L}\p{N}]/gu,'');
    if(!k||seen.has(k))continue;
    seen.add(k);out.push(item);
  }
  return out;
}

function extractFromPage(p){
  const t=p?.text||'';
  const risk=/\bRisiko\b/i.test(p?.meta?.title||'')||/\bRisikofaktoren\b/i.test(t);
  return {
    risk,
    causes:list(section(t,risk?['Risikofaktoren','Beeinflussende Faktoren']:['Beeinflussende Faktoren','Ursachen'],['Risikopopulation','Assoziierte Bedingungen','Bestimmende Merkmale','Kennzeichen','Ressourcen','Pflegeziele','Pflegemaßnahmen','Pflegeinterventionen'])),
    symptoms:risk?[]:list(section(t,['Bestimmende Merkmale','Kennzeichen','Symptome'],['Beeinflussende Faktoren','Ursachen','Assoziierte Bedingungen','Ressourcen','Pflegeziele','Pflegemaßnahmen'])),
    resources:list(section(t,['Ressourcen'],['Pflegeziele','Pflegemaßnahmen','Pflegeinterventionen','Diskussion','Literatur'])),
    goals:list(section(t,['Pflegeziele'],['Pflegemaßnahmen','Pflegeinterventionen','Diskussion','Literatur'])),
    measures:list(section(t,['Pflegemaßnahmen','Pflegeinterventionen'],['Diskussion','Literatur']),14)
  };
}

export function makePlanningContext(hits=[],direction=null){
  const relevant=hits.slice(0,8);
  const extracted=relevant.map(extractFromPage);
  const diagnoses=relevant
    .filter(p=>p?.meta?.title)
    .map(p=>({
      kind:p.kind,page:p.page,code:p.meta?.code||'',title:p.meta.title,
      risk:/\bRisiko\b/i.test(p.meta.title)||/\bRisikofaktoren\b/i.test(p.text||'')
    }));

  const riskDiag=diagnoses.find(d=>d.risk)||null;
  const problemDiag=diagnoses.find(d=>!d.risk)||null;
  const fallback=diagnoses[0]||{kind:'',page:'',code:'',title:direction?.title||'Pflegediagnose',risk:false};

  return {
    direction,
    diagnoses,
    riskDiag,
    problemDiag,
    fallback,
    suggestions:{
      causes:uniq(extracted.flatMap(x=>x.causes)).slice(0,8),
      symptoms:uniq(extracted.flatMap(x=>x.symptoms)).slice(0,8),
      resources:uniq(extracted.flatMap(x=>x.resources)).slice(0,8),
      goals:uniq(extracted.flatMap(x=>x.goals)).slice(0,6),
      measures:uniq(extracted.flatMap(x=>x.measures)).slice(0,10)
    },
    sources:relevant.map(p=>`${p.kind} S. ${p.page}${p.meta?.code?' · '+p.meta.code:''}`).slice(0,6)
  };
}

function timePhrase(period=''){
  const p=String(period||'').trim();
  if(!p)return '[Zeitraum ergänzen]';
  if(/^(innerhalb|bis\b|am\b|in\b|während|für\b)/i.test(p))return p;
  return `innerhalb von ${p}`;
}

function mobilityDefaults(risk,person,period,criterion){
  const when=timePhrase(period);
  if(criterion)return `${person} ${criterion} ${when}.`;
  if(risk){
    return `${person} bewegt sich ${when} bei den vereinbarten Transfers und beim Gehen sicher; Stürze treten nicht auf. [Hilfsmittel/Unterstützungsgrad ergänzen]`;
  }
  return `${person} geht ${when} [Strecke ergänzen] mit [Hilfsmittel/Unterstützungsgrad ergänzen] sicher und ohne beobachteten Gleichgewichtsverlust.`;
}

function genericGoal(risk,person,period,criterion){
  const when=timePhrase(period);
  if(criterion)return `${person} ${criterion} ${when}.`;
  return risk
    ? `${person} bleibt ${when} bezüglich des beschriebenen Risikos ohne Ereignis; das vereinbarte Sicherheitsverhalten wird eingehalten. [Messkriterium ergänzen]`
    : `${person} verbessert ${when} das beschriebene Pflegeproblem in einem konkret beobachtbaren Ausmaß. [Messkriterium ergänzen]`;
}

export function buildPlan(context,input={}){
  const mode=input.mode==='risk'?'risk':'problem';
  const selected=mode==='risk'
    ? (context.riskDiag||context.problemDiag||context.fallback)
    : (context.problemDiag||context.riskDiag||context.fallback);
  const risk=mode==='risk'||selected?.risk===true;
  const person=(input.person||'Frau/Herr X').trim()||'Frau/Herr X';
  const period=(input.period||'').trim();
  const situation=(input.situation||'').trim();
  const factors=(input.factors||'').trim();
  const symptoms=(input.symptoms||'').trim();
  const resources=(input.resources||'').trim();
  const criterion=(input.criterion||'').trim();
  const measures=(input.measures||'').trim();

  const isMobility=context.direction?.id==='mobility-fall'||/Geh|Mobil|Sturz|Beweg/i.test(selected?.title||'');
  const goal=isMobility?mobilityDefaults(risk,person,period,criterion):genericGoal(risk,person,period,criterion);

  const sSpecific=criterion
    ? criterion
    : isMobility
      ? (risk?'sichere Mobilisation/Transfers ohne Sturz':'sicheres Gehen mit konkret festgelegter Strecke und Unterstützung')
      : 'konkrete Verbesserung des Pflegeproblems';
  const mMeasurable=criterion||'[Messkriterium ergänzen: z. B. Strecke, Häufigkeit, Hilfebedarf, Skala oder Ereignisfreiheit]';
  const aAccepted='[mit Patient/in abstimmen und Akzeptanz dokumentieren]';
  const rRealistic=resources||'[Ressourcen/Fähigkeiten des Patienten ergänzen]';
  const tTimed=period||'[Zeitraum/Datum ergänzen]';

  const sourceMeasures=context.suggestions.measures.slice(0,6);

  return {
    mode,risk,diagnosis:selected||context.fallback,person,period,situation,
    factors:factors||'[patientenspezifisch ergänzen]',
    symptoms:risk?'':(symptoms||'[patientenspezifisch ergänzen]'),
    resources:resources||'[patientenspezifisch ergänzen]',
    criterion:criterion||'[Messkriterium ergänzen]',
    measures:measures
      ? measures.split(/\n|;/).map(x=>x.trim()).filter(Boolean)
      : [],
    sourceMeasures,
    goal,
    smart:{S:sSpecific,M:mMeasurable,A:aAccepted,R:rRealistic,T:tTimed},
    sources:context.sources
  };
}

export function planToText(plan){
  const d=plan.diagnosis||{};
  const lines=[
    `Pflegediagnose: ${d.title||'Pflegediagnose'}${d.code?' ('+d.code+')':''}`,
    plan.risk?`Risikofaktoren: ${plan.factors}`:`Ursachen: ${plan.factors}`,
    ...(plan.risk?[]:[`Kennzeichen/Symptome: ${plan.symptoms}`]),
    `Ressourcen: ${plan.resources}`,
    '',
    'SMART:',
    `S – Spezifisch: ${plan.smart.S}`,
    `M – Messbar: ${plan.smart.M}`,
    `A – Akzeptiert: ${plan.smart.A}`,
    `R – Realistisch: ${plan.smart.R}`,
    `T – Terminiert: ${plan.smart.T}`,
    '',
    `SMART-Pflegeziel: ${plan.goal}`,
    '',
    'Pflegemaßnahmen:'
  ];
  if(plan.measures.length) plan.measures.forEach((m,i)=>lines.push(`${i+1}. ${m}`));
  else lines.push('[passende Maßnahmen aus den Quellen auswählen und patientenspezifisch konkretisieren]');
  lines.push('',`Evaluation: am/innerhalb von ${plan.period||'[Zeitraum ergänzen]'} anhand des Messkriteriums prüfen.`);
  if(plan.sources.length)lines.push(`Quellen: ${plan.sources.join(' · ')}`);
  return lines.join('\n');
}

export function renderSuggestions(context){
  const s=context.suggestions;
  const ul=arr=>arr.length?'<ul>'+arr.map(x=>`<li>${escapeHtml(x)}</li>`).join('')+'</ul>':'<p>В выбранных страницах не найдено.</p>';
  return `<div class="sourceSuggestions">
    <b>Что найдено в книгах — это подсказки, а не автоматически данные пациента:</b>
    <details><summary>Ursachen / Risikofaktoren (${s.causes.length})</summary>${ul(s.causes)}</details>
    <details><summary>Kennzeichen / Symptome (${s.symptoms.length})</summary>${ul(s.symptoms)}</details>
    <details><summary>Ressourcen (${s.resources.length})</summary>${ul(s.resources)}</details>
    <details><summary>Pflegemaßnahmen (${s.measures.length})</summary>${ul(s.measures)}</details>
  </div>`;
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
