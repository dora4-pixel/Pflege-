import assert from 'node:assert/strict';
import { buildKnowledgeBase, buildWizardModel } from '../knowledgeBase.js';
import { enrichBookIndex, calculateRelevancePercent, relevanceLabel } from '../searchEngine.js';
import { buildPlan, makePlanningContext, planToText } from '../planEngine.js';
import { inferSemanticQuery } from '../semanticEngine.js';
import { createCareDialogue, currentDialogueQuestion, answerCareDialogue, compileDialogueData, dialogueSourceInfo } from '../careDialogue.js';

const books=[
  {kind:'NANDA',index:{pages:[
    {kind:'NANDA',page:399,text:'Domäne 4 Aktivität/Ruhe Klasse 2 Aktivität/Bewegung Diagnosencode 00365 Beeinträchtigte Gehfähigkeit\nDefinition Einschränkung, sich unabhängig zu Fuß in der Umgebung zu bewegen.\nBestimmende Merkmale\nSchwierigkeiten beim Gehen\nBeeinträchtigtes Gangbild\nBeeinflussende Faktoren\nSturzangst\nUnzureichende Muskelkraft',meta:{title:'Beeinträchtigte Gehfähigkeit',code:'00365'}},
    {kind:'NANDA',page:635,text:'Domäne 11 Sicherheit/Schutz Klasse 2 Physische Verletzung Diagnosencode 00303 Risiko für Stürze beim Erwachsenen\nDefinition Anfälligkeit für Sturz.\nRisikofaktoren\nBeeinträchtigte physische Mobilität\nVerminderte Muskelkraft\nSturzangst',meta:{title:'Risiko für Stürze beim Erwachsenen',code:'00303'}}
  ]}},
  {kind:'ENP',index:{pages:[
    {kind:'ENP',page:438,text:'Beeinträchtigtes Gehen\nKennzeichen\nUnsicheres Gangbild\nUrsachen\nReduzierte Muskelkraft\nRessourcen\nAkzeptiert Unterstützung\nPflegeziele\nGeht mit Rollator sicher\nPflegemaßnahmen\nBeim Gehen begleiten\nHilfsmittel bereitstellen',meta:{title:'Beeinträchtigtes Gehen'}},
    {kind:'ENP',page:445,text:'Risiko des Sturzes\nUrsachen\nReduzierte Muskelkraft\nRessourcen\nIst mit dem Rollator vertraut\nPflegeziele\nBewegt sich sicher\nPflegemaßnahmen\nSturzrisiko einschätzen\nUmgebung sichern',meta:{title:'Risiko des Sturzes'}}
  ]}}
];

const enrichedBooks=books.map(enrichBookIndex);
const kb=buildKnowledgeBase(enrichedBooks);
assert.ok(kb.count>=4,'knowledge base should contain diagnoses');
const impaired=kb.entries.find(e=>e.code==='00365');
assert.ok(impaired,'NANDA diagnosis 00365 missing');
assert.match(impaired.domain,/4 Aktivität\/Ruhe/);
assert.match(impaired.className,/2 Aktivität\/Bewegung/);
const skinSemantic=inferSemanticQuery('Риск раздражений кожи');
assert.equal(skinSemantic.riskIntent,true,'risk intent should be detected');
assert.ok(skinSemantic.concepts.some(x=>x.id==='skin-integrity'),'skin concept should be inferred');
assert.ok(skinSemantic.terms.includes('hautintegrität'),'German skin-integrity term should be expanded');
const rel=calculateRelevancePercent({page:{meta:{title:'Risiko einer beeinträchtigten Hautintegrität',area:'Haut / Wunde'},text:'Risikofaktoren Hautreizung Rötung'},terms:['hautintegrität','hautreizung','risiko'],concepts:skinSemantic.concepts,riskIntent:true,rawScore:10,maxRawScore:10,matchSections:['Risikofaktoren']});
assert.ok(rel>=80,'relevance score should be high for aligned skin risk');
const exactNandaRel=calculateRelevancePercent({
  page:{
    kind:'NANDA',
    meta:{title:'Risiko einer beeinträchtigten Hautintegrität',area:'Haut / Wunde',domain:'11 Sicherheit/Schutz',className:'2 Physische Verletzung',code:'00999'},
    text:'Definition Hautintegrität. Risikofaktoren Hautreizung Rötung'
  },
  terms:['hautintegrität','hautreizung','risiko'],
  concepts:skinSemantic.concepts,
  riskIntent:true,
  rawScore:10,
  maxRawScore:10,
  matchSections:['Titel / Klassifikation','Risikofaktoren']
});
assert.equal(exactNandaRel,100,'canonical aligned NANDA match should reach 100% search relevance');
assert.ok(/hoch|соответствие/i.test(relevanceLabel(rel)),'relevance label should describe high match');
const model=buildWizardModel(kb,enrichedBooks.flatMap(b=>b.index.pages),{id:'mobility-fall',title:'Mobilität / Sturzrisiko',terms:['gehen','sturz','mobilität']},'боится встать и плохо ходит');
assert.ok(model.diagnoses.length>0,'wizard should offer diagnoses');
assert.ok(model.symptoms.length>0,'wizard should offer symptoms');
assert.ok(model.measures.length>0,'wizard should offer measures');
assert.ok(model.risks.some(r=>r.type==='book'),'wizard should offer risk diagnosis');

// conversational SMART interview should ask relevant fall-risk questions and reuse book data
const fallHit=enrichedBooks[0].index.pages.find(p=>p.meta?.code==='00303');
const dialogue=createCareDialogue({
  query:'Риск падения',
  selectedHit:fallHit,
  hits:enrichedBooks.flatMap(b=>b.index.pages),
  direction:{id:'mobility-fall',title:'Mobilität / Sturzrisiko',terms:['gehen','sturz','mobilität']},
  model,
  concepts:[{id:'fall'},{id:'mobility'}]
});
const answerMap={
  recentFall:'no',dizziness:'yes',syncope:'no',standAbility:'one_help',walkAbility:'aid',
  walkingDetail:'Rollator, 10 Meter, Begleitung',balance:'yes',vision:'no',medRisk:'unknown',
  environment:'no',toiletUrgency:'yes',fear:'yes',bookGoal:'custom',
  goal:'geht 10 Meter mit Rollator und Begleitung ohne Gleichgewichtsverlust',
  period:'7 Tage',evaluation:'täglich im Frühdienst anhand der sicheren Gehstrecke'
};
for(let guard=0;guard<50&&!dialogue.done;guard++){
  const q=currentDialogueQuestion(dialogue);
  assert.ok(q,'dialogue question missing before completion');
  let ans=answerMap[q.id];
  if(ans===undefined){
    if(q.type==='multi')ans=(q.options||[]).slice(0,2).map(o=>o.value);
    else if(q.type==='choice')ans=q.options?.[0]?.value||'unknown';
    else ans='Testangabe';
  }
  answerCareDialogue(dialogue,ans,'ru');
}
assert.equal(dialogue.done,true,'conversational SMART interview did not finish');
const dialogueData=compileDialogueData(dialogue);
assert.ok(dialogueData.factors.some(x=>/Schwindel/i.test(x)),'dizziness should become a care-plan factor');
assert.ok(dialogueData.resources.some(x=>/Rollator|10 Meter/i.test(x)),'walking detail should become a resource/context fact');
assert.equal(dialogueData.period,'7 Tage');
assert.match(dialogueData.goal,/10 Meter/);
assert.ok(dialogueData.measures.length>0,'ENP measure selection should be offered in dialogue');
assert.ok(dialogueSourceInfo(dialogue).some(x=>/Sturzprophylaxe/i.test(x.title)),'DNQP fall source missing from dialogue');

const context=makePlanningContext(enrichedBooks.flatMap(b=>b.index.pages),{id:'mobility-fall'});
assert.equal(context.sourceCompleteness.complete,true,'planning context should contain both NANDA and ENP');
assert.ok(context.primaryNanda,'primary NANDA source missing');
assert.ok(context.primaryEnp,'primary ENP source missing');
assert.ok(context.sources.some(x=>x.startsWith('NANDA')),'NANDA source missing from plan context');
assert.ok(context.sources.some(x=>x.startsWith('ENP')),'ENP source missing from plan context');
context.problemDiag={kind:'NANDA',page:399,code:'00365',title:'Beeinträchtigte Gehfähigkeit',risk:false};
context.fallback=context.problemDiag;
const plan=buildPlan(context,{
  mode:'problem',person:'Frau A.',period:'7 Tage',situation:'hat Angst aufzustehen und geht unsicher',
  factors:'Sturzangst; Reduzierte Muskelkraft',symptoms:'Unsicheres Gangbild',
  resources:'Akzeptiert Unterstützung',criterion:'geht 10 Meter mit Rollator und Begleitung ohne Gleichgewichtsverlust',
  measures:'Beim Gehen begleiten\nHilfsmittel bereitstellen'
});
const text=planToText(plan);
assert.match(text,/Beeinträchtigte Gehfähigkeit/);
assert.match(text,/10 Meter/);
assert.match(text,/Beim Gehen begleiten/);
console.log('careplan regression: OK');
