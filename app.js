import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
import { createSearchEngine, nandaMeta, enpMeta, enrichBookIndex } from './searchEngine.js';
import { makePlanningContext, buildPlan, planToText, renderSuggestions } from './planEngine.js';
import { buildKnowledgeBase, buildWizardModel, optionsForDiagnosis, frameworkInfo } from './knowledgeBase.js';
import { listPatients, getPatient, savePatient, deletePatient, getActivePatientId, setActivePatientId } from './patientStore.js';
import { getLang, toggleLang, t, bi, applyStaticI18n } from './i18n.js';
import { translateDeRu, translateRuDe } from './translator.js';

pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const $=s=>document.querySelector(s);
const books=[];
let hits=[];
let engine=null;
let lastDirection=null;
let lastInference=[];
let lastBySource={NANDA:[],ENP:[]};
let lastPrimary={NANDA:null,ENP:null};
let lastFallbackTranslation='';
let lastQuery='';
let currentPlan=null;
let knowledgeBase=null;
let activePatient=null;
let patientCache=[];
let reopenModal=null;
let appMode='books';

const byKind=k=>books.find(b=>b.kind===k);
const ui=(ru,de)=>bi(ru,de);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function showProgress(title,text,p=0){$('#progress').classList.remove('hidden');$('#progressTitle').textContent=title;$('#progressText').textContent=text;$('#progressBar').style.width=Math.max(1,p)+'%'}
function hideProgress(){setTimeout(()=>$('#progress').classList.add('hidden'),350)}
function modal(html){$('#modalContent').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden');$('#modalContent').innerHTML='';currentPlan=null;reopenModal=null}
$('#modalClose').onclick=closeModal;
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});

async function api(path,body){
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const raw=await r.text();
  if(!r.ok)throw new Error(raw||`HTTP ${r.status}`);
  try{return JSON.parse(raw)}catch{throw new Error('Некорректный ответ сервера')}
}

function openDb(){return new Promise((ok,bad)=>{const r=indexedDB.open('pflegebuch-static',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('books'))r.result.createObjectStore('books',{keyPath:'kind'});if(!r.result.objectStoreNames.contains('patients'))r.result.createObjectStore('patients',{keyPath:'id'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)})}
async function saveBook(b){try{const db=await openDb();await new Promise((ok,bad)=>{const tx=db.transaction('books','readwrite');tx.objectStore('books').put(b);tx.oncomplete=ok;tx.onerror=()=>bad(tx.error)});db.close()}catch{}}
async function removeBook(kind){try{const db=await openDb();await new Promise((ok,bad)=>{const tx=db.transaction('books','readwrite');tx.objectStore('books').delete(kind);tx.oncomplete=ok;tx.onerror=()=>bad(tx.error)});db.close()}catch{};const i=books.findIndex(b=>b.kind===kind);if(i>=0)books.splice(i,1);refreshEngine();renderBooks()}

function remapBookMeta(book){
  return enrichBookIndex(book);
}

async function loadBooks(){
  try{
    const db=await openDb();
    const rows=await new Promise((ok,bad)=>{const tx=db.transaction('books','readonly');const r=tx.objectStore('books').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(r.error)});
    db.close();
    books.splice(0,books.length,...rows.map(remapBookMeta));
    refreshEngine();renderBooks();
  }catch{}
}

function refreshEngine(){
  try{
    for(let i=0;i<books.length;i++)books[i]=enrichBookIndex(books[i]);
    engine=books.length?createSearchEngine(books):null;
    knowledgeBase=books.length?buildKnowledgeBase(books):null;
    $('#status').textContent=books.length
      ? books.map(b=>b.kind).join(' + ')+' · '+(knowledgeBase?.count||0)+' '+t('diagnoses')
      : t('noBooks');
  }catch(e){engine=null;knowledgeBase=null;$('#status').textContent=ui('Ошибка индекса','Indexfehler');console.error(e)}
}

function renderBooks(){
  const wrap=$('#books');
  wrap.innerHTML=books.map(b=>`<div class="bookCard"><b>${b.kind}</b><small>${esc(b.name)}</small><small>${b.index.pages.length} страниц</small><button data-del="${b.kind}">Удалить</button></div>`).join('');
  wrap.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>removeBook(x.dataset.del));
  $('#welcome').classList.toggle('hidden',books.length>0);
}

function pdfTextWithLines(content){
  const lines=[];
  let current=[],lastY=null;
  for(const item of content.items||[]){
    const str=String(item.str||'').trim();
    if(!str)continue;
    const y=Number(item.transform?.[5]||0);
    if(lastY!==null && Math.abs(y-lastY)>2.2){
      if(current.length)lines.push(current.join(' ').replace(/\s+/g,' ').trim());
      current=[];
    }
    current.push(str);
    lastY=y;
  }
  if(current.length)lines.push(current.join(' ').replace(/\s+/g,' ').trim());
  return lines.filter(Boolean).join('\n');
}



function setAppMode(mode){
  appMode=mode==='patient'?'patient':'books';
  $('#bookSearchTab')?.classList.toggle('active',appMode==='books');
  $('#patientPlanTab')?.classList.toggle('active',appMode==='patient');
  renderPatientBar();
  if(hits.length){renderDirection();renderResults()}
}

function renderPatientBar(){
  const bar=$('#patientBar');
  if(appMode!=='patient'||!activePatient){bar.classList.add('hidden');return}
  bar.classList.remove('hidden');
  $('#activePatientAlias').textContent=activePatient.alias||t('noPatient');
  $('#activePatientSituation').textContent=activePatient.situation||'';
}

async function refreshPatients(){
  try{patientCache=await listPatients()}catch{patientCache=[]}
  const id=getActivePatientId();
  activePatient=id?await getPatient(id):null;
  if(id&&!activePatient)setActivePatientId('');
  renderPatientBar();
}

async function activatePatient(id,{autoContinue=false}={}){
  const p=await getPatient(id);
  if(!p)return;
  activePatient=p;setActivePatientId(id);setAppMode('patient');renderPatientBar();
  closeModal();
  if(p.situation){
    $('#query').value=p.situation;
    search(p.situation);
    if(autoContinue && hits.length)openWizard(hits,lastDirection,null);
  }
}

function patientListModal(){
  reopenModal=()=>patientListModal();
  const rows=patientCache.length?patientCache.map(p=>`
    <article class="patientCard">
      <div><b>${esc(p.alias||t('noPatient'))}</b><small>${esc(p.situation||'')}</small><small>${new Date(p.updatedAt||Date.now()).toLocaleString(getLang()==='de'?'de-DE':'ru-RU')}</small></div>
      <div class="patientCardActions">
        <button data-open-patient="${p.id}">${t('open')}</button>
        <button data-plan-patient="${p.id}">${t('continuePlan')}</button>
        <button class="dangerBtn" data-delete-patient="${p.id}">${t('delete')}</button>
      </div>
    </article>`).join(''):`<div class="emptyPatients">${t('emptyPatients')}</div>`;

  modal(`<h2>${t('patients')}</h2><div class="actions"><button id="patientNewFromList">${t('newPatient')}</button></div><div class="patientList">${rows}</div>`);
  $('#patientNewFromList').onclick=()=>newPatientModal();
  document.querySelectorAll('[data-open-patient]').forEach(b=>b.onclick=()=>activatePatient(b.dataset.openPatient));
  document.querySelectorAll('[data-plan-patient]').forEach(b=>b.onclick=()=>activatePatient(b.dataset.planPatient,{autoContinue:true}));
  document.querySelectorAll('[data-delete-patient]').forEach(b=>b.onclick=async()=>{
    if(!confirm(getLang()==='de'?'Patient wirklich löschen?':'Удалить пациента?'))return;
    await deletePatient(b.dataset.deletePatient);
    if(activePatient?.id===b.dataset.deletePatient){activePatient=null;setActivePatientId('');renderPatientBar()}
    await refreshPatients();patientListModal();
  });
}

function newPatientModal(existing=activePatient){
  const editing=Boolean(existing?.id);
  reopenModal=()=>newPatientModal(editing?activePatient:null);
  modal(`<h2>${editing?t('editPatient'):t('newPatient')}</h2>
    <div class="hintBox">${t('patientHint')}</div>
    <div class="formGrid" style="margin-top:12px">
      <div class="field"><label>${t('alias')}<input id="patientAlias" value="${esc(existing?.alias||'')}" placeholder="${getLang()==='de'?'z. B. Frau A.':'например Frau A.'}"></label></div>
      <div class="field"><label>${t('situation')}<textarea id="patientSituation" placeholder="${getLang()==='de'?'z. B. hat Angst aufzustehen und geht unsicher':'например боится встать и плохо ходит'}">${esc(existing?.situation||'')}</textarea></label></div>
    </div>
    <div class="actions"><button id="savePatientBtn">${editing?t('save'):t('createContinue')}</button><button id="cancelPatientBtn">${t('cancel')}</button></div>`);
  $('#cancelPatientBtn').onclick=closeModal;
  $('#savePatientBtn').onclick=async()=>{
    const alias=$('#patientAlias').value.trim();
    const situation=$('#patientSituation').value.trim();
    if(!alias){toast(getLang()==='de'?'Bitte Pseudonym eingeben':'Укажи псевдоним');return}
    const saved=await savePatient({...existing,alias,situation});
    activePatient=saved;setActivePatientId(saved.id);await refreshPatients();
    setAppMode('patient');
    closeModal();
    if(situation){
      $('#query').value=situation;
      search(situation);
      if(hits.length)openWizard(hits,lastDirection,null);
    }
  };
}

async function persistPatientPlan(selection,planText){
  if(!activePatient)return;
  activePatient=await savePatient({...activePatient,lastQuery:lastQuery,selection,planText});
  setActivePatientId(activePatient.id);
  await refreshPatients();
}

function refreshLanguage(){
  applyStaticI18n();
  $('#langBtn').textContent=t('langButton');
  $('#modalLangBtn').textContent=t('langButton');
  renderBooks();refreshEngine();renderPatientBar();
  if(hits.length){renderDirection();renderResults()}
}

function toggleInterfaceLanguage(){
  const reopen=!$('#modal').classList.contains('hidden')?reopenModal:null;
  toggleLang();refreshLanguage();
  if(reopen){$('#modal').classList.add('hidden');$('#modalContent').innerHTML='';setTimeout(()=>reopen(),0)}
}

async function upload(kind,file){
  showProgress(kind,'Читаю PDF…',2);
  try{
    const data=new Uint8Array(await file.arrayBuffer());
    const pdf=await pdfjsLib.getDocument({data}).promise;
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      const p=await pdf.getPage(n);
      const c=await p.getTextContent();
      const text=pdfTextWithLines(c);
      const meta=kind==='NANDA'?nandaMeta(text):enpMeta(text);
      pages.push({kind,page:n,text,meta});
      if(n===1||n%10===0||n===pdf.numPages){showProgress(kind,`Извлекаю ${n} из ${pdf.numPages}`,Math.round(n/pdf.numPages*92));await new Promise(r=>setTimeout(r,0))}
    }
    const b=enrichBookIndex({kind,name:file.name,blob:file,index:{kind,name:file.name,pages}});
    const old=books.findIndex(x=>x.kind===kind);if(old>=0)books[old]=b;else books.push(b);
    showProgress(kind,'Строю быстрый индекс…',96);
    await saveBook(b);
    refreshEngine();renderBooks();
    showProgress(kind,'Готово',100);toast(`${kind}: индекс готов`);
  }catch(e){toast('Ошибка PDF: '+(e.message||e))}finally{hideProgress()}
}

$('#nandaBtn').onclick=()=>$('#nandaFile').click();
$('#enpBtn').onclick=()=>$('#enpFile').click();
$('#nandaFile').onchange=e=>e.target.files[0]&&upload('NANDA',e.target.files[0]);
$('#enpFile').onchange=e=>e.target.files[0]&&upload('ENP',e.target.files[0]);

function demo(){
  books.splice(0,books.length,
    {kind:'NANDA',name:'NANDA Demo',blob:null,index:{pages:[
      {kind:'NANDA',page:399,text:'Domäne 4 Aktivität/Ruhe Klasse 2 Aktivität/Bewegung Diagnosencode 00365 Beeinträchtigte Gehfähigkeit. Definition Einschränkung, sich unabhängig zu Fuß in der Umgebung zu bewegen. Bestimmende Merkmale Schwierigkeiten beim Gehen auf unebenem Untergrund; Schwierigkeiten beim Treppensteigen. Beeinflussende Faktoren unzureichende Muskelkraft; Sturzangst.',meta:{}},
      {kind:'NANDA',page:635,text:'Domäne 11 Sicherheit/Schutz Klasse 2 Physische Verletzung Diagnosencode 00303 Risiko für Stürze beim Erwachsenen. Definition Anfälligkeit für ein Ereignis, bei dem eine Person unbeabsichtigt zu Boden gelangt. Risikofaktoren Beeinträchtigte physische Mobilität; verminderte Muskelkraft der unteren Extremitäten; Sturzangst.',meta:{}}
    ].map(p=>({...p,meta:nandaMeta(p.text)}))}},
    {kind:'ENP',name:'ENP Demo',blob:null,index:{pages:[
      {kind:'ENP',page:445,text:'Bewegung/Mobilität. Risiko des Sturzes. Definition. Ursachen Reduzierte Muskelkraft; unsicheres Gehen. Ressourcen Ist mit dem Rollator vertraut; ist motiviert. Pflegeziele Bewegt sich in der Alltagsumgebung sicher. Pflegemaßnahmen Sturzrisiko einschätzen; sichere Umgebung gestalten; geeignetes Hilfsmittel bereitstellen.',meta:{}},
      {kind:'ENP',page:438,text:'Bewegung/Mobilität. Beeinträchtigtes Gehen. Kennzeichen Unsicheres Gangbild; reduzierte Schrittlänge. Ursachen Reduzierte Muskelkraft. Ressourcen Akzeptiert Unterstützung. Pflegeziele Geht mit vereinbartem Hilfsmittel sicher. Pflegemaßnahmen Beim Gehen entsprechend Unterstützungsbedarf begleiten; Hilfsmittel bereitstellen; Gangbild beobachten.',meta:{}},
      {kind:'ENP',page:512,text:'Haut/Wunde. Risiko einer beeinträchtigten Hautintegrität. Definition Gefährdung der Hautintegrität. Ursachen Feuchtigkeit; Reibung; Druckbelastung. Ressourcen Kann Hautveränderungen mitteilen. Pflegeziele Haut bleibt intakt. Pflegemaßnahmen Hautzustand beobachten; Haut trocken halten; Druck und Reibung reduzieren.',meta:{}}
    ].map(p=>({...p,meta:enpMeta(p.text)}))}}
  );
  refreshEngine();renderBooks();toast('Демо включено');
}
$('#demoBtn').onclick=demo;

function message(role,text){const d=document.createElement('div');d.className='msg '+(role==='user'?'user':'bot');d.innerHTML='<span>'+esc(text)+'</span>';$('#messages').appendChild(d)}

function renderDirection(){
  const box=$('#direction');
  if(appMode==='books'){box.innerHTML='';return}
  if(!hits.length){box.innerHTML='';return}
  const ctx=makePlanningContext(hits,lastDirection);
  const title=lastDirection?.title||ctx.problemDiag?.title||ctx.riskDiag?.title||'Найденное направление';
  const desc=lastDirection?.description||'Соберу общий план по наиболее релевантным страницам NANDA/ENP. Перед использованием нужно заполнить только факты конкретного пациента.';
  box.innerHTML=`<div class="directionCard"><small>${ui('Общее направление','Pflegebereich')}</small><h3>${esc(title)}</h3><p>${esc(getLang()==='de'?'Passende NANDA-/ENP-Seiten wurden lokal gefunden. Wähle anschließend nur die Patientendaten aus, die tatsächlich vorliegen.':desc)}</p><button id="generalPlanBtn">${ui('Собрать Pflegeplan по вариантам','Pflegeplan aus Varianten erstellen')}</button></div>`;
  $('#generalPlanBtn').onclick=()=>openWizard(hits,lastDirection,null);
}

async function search(q){
  if(!books.length){toast(t('chooseBooks'));return}
  if(!engine)refreshEngine();
  if(!engine){toast(ui('Не удалось создать индекс','Index konnte nicht erstellt werden'));return}
  lastQuery=q;lastFallbackTranslation='';message('user',q);$('#welcome').classList.add('hidden');
  const t0=performance.now();

  let found=engine.search(q,10);
  if(!found.hits.length && /[а-яё]/i.test(q)){
    const translated=await translateRuDe(q);
    if(translated){
      lastFallbackTranslation=translated;
      found=engine.search(q+' '+translated,10);
    }
  }

  hits=found.hits;
  lastBySource=found.bySource||{NANDA:hits.filter(x=>x.kind==='NANDA'),ENP:hits.filter(x=>x.kind==='ENP')};
  lastPrimary=found.primary||{NANDA:lastBySource.NANDA?.[0]||null,ENP:lastBySource.ENP?.[0]||null};
  lastDirection=found.direction;
  lastInference=(found.concepts||[]).map(x=>x.label);
  renderDirection();renderResults();

  const ms=Math.max(1,Math.round(performance.now()-t0));
  const inferred=lastInference.length
    ? (getLang()==='de'?'Erkannt: ':'Распознано: ')+lastInference.join(' · ')+(found.riskIntent?' · '+ui('риск','Risiko'):'')
    : '';
  const fallback=lastFallbackTranslation
    ? (getLang()==='de'?'Zusätzliche Übersetzung für die Suche: ':'Дополнительный перевод для поиска: ')+lastFallbackTranslation
    : '';

  if(!hits.length){
    message('bot',[
      ui('Подходящих диагнозов/информационных страниц в загруженных NANDA/ENP не найдено. Я искал не только точные слова, но и связанные понятия.','Keine passenden Diagnosen/Informationsseiten in den geladenen NANDA/ENP gefunden. Es wurden auch semantisch verwandte Begriffe geprüft.'),
      inferred,fallback
    ].filter(Boolean).join('\n'));
  }else if(appMode==='books'){
    message('bot',[
      getLang()==='de'
        ? `NANDA: ${lastPrimary.NANDA?.relevancePct??'—'}% · ENP: ${lastPrimary.ENP?.relevancePct??'—'}%. Beide Quellen werden getrennt bewertet und gemeinsam für die Pflegeplanung verwendet.`
        : `NANDA: ${lastPrimary.NANDA?.relevancePct??'—'}% · ENP: ${lastPrimary.ENP?.relevancePct??'—'}%. Обе книги оцениваются отдельно и вместе используются для Pflegeplan.`,
      inferred,fallback
    ].filter(Boolean).join('\n'));
  }else{
    message('bot',[
      getLang()==='de'?`Gefunden: ${hits.length} passende Pflegediagnosen. Der Pflegeplan-Assistent nutzt diese als Auswahlbasis.`:`Нашёл ${hits.length} подходящих Pflegediagnosen. Pflegeplan-Assistent использует их как варианты для выбора.`,
      inferred,fallback
    ].filter(Boolean).join('\n'));
  }
}

$('#searchForm').onsubmit=e=>{e.preventDefault();const q=$('#query').value.trim();if(!q)return;$('#query').value='';search(q)};

function resultMetaRows(h){
  const rows=[];
  const topic=h.meta?.topic||h.meta?.area||lastDirection?.title||'';
  if(topic)rows.push([ui('Тема / Pflegebereich','Thema / Pflegebereich'),topic]);
  if(h.kind==='NANDA'){
    rows.push(['Domäne',h.meta?.domain||'—']);
    rows.push(['Klasse',h.meta?.className||'—']);
    rows.push(['Diagnosencode',h.meta?.code||'—']);
  }else{
    rows.push([ui('Система','System'),'ENP']);
    rows.push([ui('Область','Bereich'),h.meta?.area||'—']);
  }
  rows.push(['Pflegediagnose',h.meta?.title||'—']);
  if(h.matchSections?.length)rows.push([ui('Найдено в разделе','Treffer in'),h.matchSections.join(' · ')]);
  const bestBook=h.bookPage?String(h.bookPage):'';
  rows.push([ui('Страница книги','Buchseite'),bestBook||String(h.page)]);
  if(bestBook&&String(bestBook)!==String(h.page))rows.push([ui('PDF-страница','PDF-Seite'),String(h.page)]);
  return rows;
}

function renderResultCard(h,i){
  const planButton=appMode==='patient'
    ? `<button class="planBtn" data-plan="${i}">${ui('Pflegeplan по вариантам','Pflegeplan auswählen')}</button>`
    : '';
  const rows=resultMetaRows(h).map(([k,v])=>`<div class="resultMetaRow"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const related=(h.relatedPages||[]).slice(0,5);
  const relatedHtml=related.length>1
    ? `<div class="relatedPages"><span>${ui('Релевантные страницы','Relevante Seiten')}:</span> ${related.map(p=>`<button data-related-open="${i}:${p.page}">${p.bookPage||p.page}</button>`).join(' ')}</div>`
    : '';
  const bestLabel=h.sourceBest
    ? (h.kind==='NANDA'?ui('Лучшее в NANDA · ','Beste in NANDA · '):ui('Лучшее в ENP · ','Beste in ENP · '))
    : '';
  return `<article class="result detailedResult">
    <div class="resultHead">
      <div class="rank">${h.sourceRank||i+1}</div>
      <div class="resultBody">
        <div class="tags"><span class="tag ${h.kind.toLowerCase()}">${h.kind}</span><span class="tag">${ui('книга стр.','Buch S.')} ${esc(h.bookPage||h.page)}</span>${h.meta?.code?`<span class="tag">${esc(h.meta.code)}</span>`:''}${Number.isFinite(h.relevancePct)?`<span class="tag relevanceTag">${bestLabel}${h.relevancePct}%</span>`:''}</div>
        <h3>${esc(h.meta?.title||ui('Информационная страница','Informationsseite'))}</h3>
        ${Number.isFinite(h.relevancePct)?`<div class="relevanceBlock"><div class="relevanceTop"><span>${ui('Соответствие запросу','Relevanz zur Anfrage')}</span><b>${h.relevancePct}% · ${esc(h.relevanceLabel||'')}</b></div><div class="relevanceTrack"><i style="width:${h.relevancePct}%"></i></div></div>`:''}
        <div class="resultMetaGrid">${rows}</div>
        ${relatedHtml}
      </div>
    </div>
    <div class="resultBtns"><button class="openBtn" data-open="${i}">${ui('Открыть лучшую страницу','Beste Seite öffnen')}</button>${planButton}</div>
  </article>`;
}

function renderResults(){
  const r=$('#results');
  const indexed=hits.map((h,i)=>({h,i}));
  const sections=[];
  for(const kind of ['NANDA','ENP']){
    const items=indexed.filter(x=>x.h.kind===kind);
    if(!items.length)continue;
    const top=items[0].h;
    const role=kind==='NANDA'
      ? ui('Диагноз, Domäne/Klasse, Diagnosencode, признаки и факторы','Diagnose, Domäne/Klasse, Diagnosencode, Merkmale und Faktoren')
      : ui('Практическая Pflegeplanung: Ressourcen, Ziele и Maßnahmen','Praktische Pflegeplanung: Ressourcen, Ziele und Maßnahmen');
    sections.push(`<section class="sourceResultGroup">
      <div class="sourceGroupHeader"><div><b>${kind}</b><span>${role}</span></div><strong>${top.relevancePct??'—'}%</strong></div>
      ${items.map(x=>renderResultCard(x.h,x.i)).join('')}
    </section>`);
  }
  r.innerHTML=sections.join('');

  r.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openPage(hits[+b.dataset.open]));
  r.querySelectorAll('[data-related-open]').forEach(b=>b.onclick=()=>{
    const [hitIndex,pageNo]=b.dataset.relatedOpen.split(':').map(Number);
    const base=hits[hitIndex];
    const book=byKind(base.kind);
    const page=book?.index?.pages?.find(p=>Number(p.page)===pageNo);
    if(page)openPage({...page,matchSections:base.matchSections,relatedPages:base.relatedPages});
  });
  r.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{
    const h=hits[+b.dataset.plan];
    const planningHits=[lastPrimary.NANDA,lastPrimary.ENP,h,...hits].filter(Boolean)
      .filter((x,idx,arr)=>arr.findIndex(y=>y.key===x.key)===idx);
    openWizard(planningHits,lastDirection,h);
  });
}

async function renderPdf(book,pageNo,canvas){
  if(!book?.blob)return;
  const data=new Uint8Array(await book.blob.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const page=await pdf.getPage(pageNo);
  const base=page.getViewport({scale:1});
  const width=Math.min(860,Math.max(300,canvas.parentElement.clientWidth||650));
  const v=page.getViewport({scale:width/base.width});canvas.width=v.width;canvas.height=v.height;
  await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;
}

async function translateInto(text,box,meta={}){
  box.textContent=ui('Перевожу…','Übersetzung läuft…');
  try{
    const translation=await translateDeRu(String(text||'').slice(0,11000));
    box.textContent=translation||ui('Перевод не получен.','Keine Übersetzung erhalten.');
  }catch(e){box.textContent=ui('Не удалось получить перевод. ','Übersetzung fehlgeschlagen. ')+(e.message||'')}
}

async function openPage(h){
  reopenModal=()=>openPage(h);
  const rows=resultMetaRows(h).map(([k,v])=>`<div class="pageMetaRow"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  modal(`<h2>${esc(h.meta?.title||h.kind+' Seite '+h.page)}</h2>
    <div class="pageMetaCard">${rows}</div>
    <div class="split">
      <div class="pane"><h3>${ui('Оригинальная страница','Originalseite')}</h3>${byKind(h.kind)?.blob?'<div class="pdfBox"><canvas id="pdfCanvas"></canvas></div>':`<div class="pageText">${esc(h.text)}</div>`}</div>
      <div class="pane"><h3>${ui('Русский перевод','Russische Übersetzung')}</h3><div id="translation" class="translation">${ui('Нажми «Перевести».','„Übersetzen“ tippen.')}</div><div class="actions"><button id="translateBtn">${ui('Перевести страницу','Seite übersetzen')}</button></div></div>
    </div>`);
  if(byKind(h.kind)?.blob)renderPdf(byKind(h.kind),h.page,$('#pdfCanvas')).catch(()=>{$('#pdfCanvas').replaceWith(document.createTextNode(h.text))});
  $('#translateBtn').onclick=()=>translateInto(h.text,$('#translation'),{source:h.kind,page:h.page,title:h.meta?.title||''});
}

function listHtml(items){return items?.length?`<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>Не заполнено.</p>'}
function renderStructuredPlan(plan){
  const d=plan.diagnosis||{};
  const measures=plan.measures?.length?plan.measures:[];
  return `<div class="planSections">
    <section class="planSection"><h4>1. Pflegediagnose</h4><p><b>${esc(d.title||'Pflegediagnose')}</b>${d.code?' · '+esc(d.code):''}<br><span class="note">${plan.risk?'Risikodiagnose':'Problemorientierte Pflegediagnose'}</span></p></section>
    ${plan.situation?`<section class="planSection"><h4>2. Ситуация пациента</h4><p>${esc(plan.situation)}</p></section>`:''}
    <section class="planSection"><h4>${plan.risk?'3. Risikofaktoren':'3. Ursachen'}</h4><p>${esc(plan.factors)}</p></section>
    ${plan.risk?'':`<section class="planSection"><h4>4. Kennzeichen / Symptome</h4><p>${esc(plan.symptoms)}</p></section>`}
    <section class="planSection"><h4>${plan.risk?'4':'5'}. Ressourcen</h4><p>${esc(plan.resources)}</p></section>
    <section class="planSection"><h4>SMART — раздельно по пунктам</h4><div class="smartGrid">
      <div class="smartCell"><b>S</b><span>${esc(plan.smart.S)}</span></div>
      <div class="smartCell"><b>M</b><span>${esc(plan.smart.M)}</span></div>
      <div class="smartCell"><b>A</b><span>${esc(plan.smart.A)}</span></div>
      <div class="smartCell"><b>R</b><span>${esc(plan.smart.R)}</span></div>
      <div class="smartCell"><b>T</b><span>${esc(plan.smart.T)}</span></div>
    </div></section>
    <section class="planSection"><h4>Готовая формулировка SMART-Pflegeziel</h4><div class="finalGoal">${esc(plan.goal)}</div></section>
    <section class="planSection"><h4>Pflegemaßnahmen</h4>${measures.length?listHtml(measures):'<p>[Выбери и конкретизируй подходящие меры из подсказок книги ниже или введи свои меры.]</p>'}</section>
    <section class="planSection"><h4>Evaluation</h4><p>Проверить ${esc(plan.period||'[Zeitraum ergänzen]')} по указанному Messkriterium и задокументировать результат.</p></section>
    <section class="planSection"><h4>Quellen</h4><p>${esc(plan.sources?.join(' · ')||'—')}</p></section>
  </div>`;
}

function openPlanning(contextHits,direction,preferred){
  const context=makePlanningContext(contextHits,direction);
  const preferredRisk=preferred && (/\bRisiko\b/i.test(preferred.meta?.title||'')||/\bRisikofaktoren\b/i.test(preferred.text||''));
  const defaultMode=preferred? (preferredRisk?'risk':'problem') : (context.problemDiag?'problem':'risk');
  modal(`<h2>Pflegeplanung / SMART</h2>
    <div class="hintBox"><b>Что сюда писать:</b><br>Заполняй только факты о конкретном пациенте. Пример: «боится ходить», «ходит 5 м с Rollator и Begleitung», «при вставании Schwindel». Книга ниже даёт подсказки, но они не считаются автоматически фактами пациента.</div>
    <div class="formGrid" style="margin-top:12px">
      <div class="field"><label>Тип плана<select id="planMode"><option value="problem">Problemorientiert</option><option value="risk">Risikodiagnose</option></select></label><small>Problem = уже есть признаки/симптомы. Risiko = проблема ещё не наступила, но есть риск.</small></div>
      <div class="field"><label>Person<input id="person" value="Frau/Herr X"></label><small>Например: Frau M. или Herr K.</small></div>
      <div class="field"><label>Zeitraum<input id="period" placeholder="z. B. 7 Tage или bis 29.09.2026"></label><small>Срок, к которому цель должна быть достигнута.</small></div>
      <div class="field"><label>Ситуация пациента<textarea id="situation" placeholder="z. B. боится ходить, встаёт только с помощью…">${esc(lastQuery)}</textarea></label><small>Коротко: что происходит именно у этого пациента.</small></div>
      <div class="field"><label id="factorLabel">Ursachen / Risikofaktoren<textarea id="factors" placeholder="Только факты пациента"></textarea></label><small>Например: Schwindel, reduzierte Muskelkraft, unsicheres Gangbild.</small></div>
      <div class="field" id="symptomField"><label>Kennzeichen / Symptome<textarea id="symptoms" placeholder="Что конкретно наблюдается"></textarea></label><small>Только для problemorientierte Diagnose.</small></div>
      <div class="field"><label>Ressourcen<textarea id="resources" placeholder="Что пациент может / использует / принимает помощь"></textarea></label><small>Например: nutzt Rollator selbstständig; akzeptiert Unterstützung.</small></div>
      <div class="field"><label>Messkriterium<textarea id="criterion" placeholder="z. B. geht 10 Meter mit Rollator und Begleitung ohne Gleichgewichtsverlust"></textarea></label><small>Самая важная часть: конкретно и наблюдаемо, по чему видно успех.</small></div>
      <div class="field" style="grid-column:1/-1"><label>Pflegemaßnahmen<textarea id="measures" placeholder="Каждую меру с новой строки. Оставь пустым, если сначала хочешь посмотреть подсказки из книги."></textarea></label><small>Меры должны описывать конкретное действие Pflegekraft и быть адаптированы к пациенту.</small></div>
    </div>
    <div class="actions"><button id="makePlan">Создать структурированный SMART</button><button id="copyPlan">Копировать</button><button id="translatePlan">Перевести весь план</button></div>
    <div id="planOut"></div><div id="planRu" class="translation hidden"></div>
    ${renderSuggestions(context)}
  `);
  $('#planMode').value=defaultMode;
  const syncMode=()=>{const risk=$('#planMode').value==='risk';$('#symptomField').classList.toggle('hidden',risk);$('#factorLabel').firstChild.textContent=risk?'Risikofaktoren':'Ursachen'};
  syncMode();$('#planMode').onchange=syncMode;

  const make=()=>{
    currentPlan=buildPlan(context,{
      mode:$('#planMode').value,
      person:$('#person').value,
      period:$('#period').value,
      situation:$('#situation').value,
      factors:$('#factors').value,
      symptoms:$('#symptoms').value,
      resources:$('#resources').value,
      criterion:$('#criterion').value,
      measures:$('#measures').value
    });
    $('#planOut').innerHTML=renderStructuredPlan(currentPlan);
    return currentPlan;
  };
  $('#makePlan').onclick=make;
  $('#copyPlan').onclick=async()=>{const p=currentPlan||make();await navigator.clipboard.writeText(planToText(p));toast('План скопирован')};
  $('#translatePlan').onclick=async()=>{const p=currentPlan||make();const box=$('#planRu');box.classList.remove('hidden');await translateInto(planToText(p),box,{source:'Pflegeplanung',title:p.diagnosis?.title||'SMART Pflegeplanung'})};
}


function wizardChoiceHtml(name,items,mode='checkbox'){
  if(!items?.length)return '<div class="emptyChoice">В книгах подходящих вариантов не найдено.</div>';
  return '<div class="choiceGrid">'+items.map((o,i)=>{
    const text=o.text||o.title||String(o);
    const source=o.source||(o.kind&&o.page?o.kind+' S. '+o.page:'');
    const value=encodeURIComponent(text);
    return '<label class="choice"><input type="'+mode+'" name="'+name+'" value="'+value+'" data-index="'+i+'"><span><b>'+esc(text)+'</b>'+(source?'<small>'+esc(source)+'</small>':'')+'</span></label>';
  }).join('')+'</div>';
}

function selectedTexts(name){
  return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(x=>decodeURIComponent(x.value));
}
function selectedOne(name){
  const x=document.querySelector('input[name="'+name+'"]:checked');
  return x?decodeURIComponent(x.value):'';
}

function wizardDiagnosisHtml(model,preferred){
  let list=[...(model.diagnoses||[])];
  if(preferred?.meta?.title && !list.some(x=>x.title===preferred.meta.title)){
    list.unshift({key:preferred.kind+':preferred',kind:preferred.kind,title:preferred.meta.title,code:preferred.meta.code||'',risk:/\bRisiko\b/i.test(preferred.meta.title),source:preferred.kind+' S. '+preferred.page});
  }
  if(!list.length)return '<div class="emptyChoice">Диагноз пока не найден.</div>';
  return '<div class="choiceGrid diagnosisChoices">'+list.map((d,i)=>{
    const checked=i===0?' checked':'';
    const value=encodeURIComponent(d.key);
    return '<label class="choice"><input type="radio" name="wizDiagnosis" value="'+value+'"'+checked+'><span><b>'+esc(d.title)+'</b><small>'+esc([d.kind,d.code,d.source,d.risk?'Risikodiagnose':'Problemorientiert'].filter(Boolean).join(' · '))+'</small></span></label>';
  }).join('')+'</div>';
}

function wizardRiskHtml(model){
  if(!model.risks?.length)return '<div class="emptyChoice">По текущему запросу дополнительных рисков не найдено.</div>';
  return '<div class="riskList">'+model.risks.map((r,i)=>{
    if(r.type==='book'){
      const factorName='riskFactors_'+i,goalName='riskGoals_'+i,measureName='riskMeasures_'+i;
      return '<div class="riskItem"><label class="choice riskMain"><input type="checkbox" name="wizRisk" value="'+i+'"><span><b>'+esc(r.title)+'</b><small>'+esc(r.source||'NANDA/ENP')+'</small></span></label>'+
        '<div class="riskDetails" data-risk-details="'+i+'">'+
        '<div><strong>Risikofaktoren — отметить только те, что реально есть у пациента</strong>'+wizardChoiceHtml(factorName,r.riskFactors||[])+'</div>'+
        '<div><strong>Pflegeziele aus dem Buch</strong>'+wizardChoiceHtml(goalName,r.goals||[],'radio')+'</div>'+
        '<div><strong>Maßnahmen aus dem Buch</strong>'+wizardChoiceHtml(measureName,r.measures||[])+'</div>'+
        '</div></div>';
    }
    return '<div class="riskItem"><label class="choice riskMain"><input type="checkbox" name="wizRisk" value="'+i+'"><span><b>'+esc(r.title)+'</b><small>'+esc(r.standard||'DNQP')+' · сначала подтвердить риск/Assessment</small></span></label></div>';
  }).join('')+'</div>';
}

function syncWizardOptions(model){
  const raw=document.querySelector('input[name="wizDiagnosis"]:checked')?.value||'';
  const key=raw?decodeURIComponent(raw):'';
  const exact=knowledgeBase?optionsForDiagnosis(knowledgeBase,key):null;
  const risk=exact?.risk===true;
  const factors=risk?(exact?.riskFactors?.length?exact.riskFactors:model.riskFactors):(exact?.causes?.length?exact.causes:model.causes);
  const symptoms=exact?.symptoms?.length?exact.symptoms:model.symptoms;
  const resources=exact?.resources?.length?exact.resources:model.resources;
  const goals=exact?.goals?.length?exact.goals:model.goals;
  const measures=exact?.measures?.length?exact.measures:model.measures;

  $('#wizFactorsTitle').textContent=risk?'2. Risikofaktoren':'2. Ätiologie / Ursachen';
  $('#wizFactorsChoices').innerHTML=wizardChoiceHtml('wizFactors',factors);
  $('#wizSymptomsStep').classList.toggle('hidden',risk);
  $('#wizSymptomsChoices').innerHTML=wizardChoiceHtml('wizSymptoms',symptoms);
  $('#wizResourcesChoices').innerHTML=wizardChoiceHtml('wizResources',resources);
  $('#wizGoalsChoices').innerHTML=wizardChoiceHtml('wizBookGoal',goals,'radio');
  $('#wizMeasuresChoices').innerHTML=wizardChoiceHtml('wizMeasures',measures);
}


function setSelectedValues(name,values=[]){
  const want=new Set((values||[]).map(String));
  document.querySelectorAll('input[name="'+name+'"]').forEach(x=>{
    const decoded=decodeURIComponent(x.value);
    x.checked=want.has(decoded);
  });
}

function restoreWizardSelection(model){
  const saved=activePatient?.selection;
  if(!saved)return;
  if(saved.diagnosisKey){
    const radio=[...document.querySelectorAll('input[name="wizDiagnosis"]')].find(x=>decodeURIComponent(x.value)===saved.diagnosisKey);
    if(radio){radio.checked=true;syncWizardOptions(model)}
  }
  setSelectedValues('wizFactors',saved.factors);
  setSelectedValues('wizSymptoms',saved.symptoms);
  setSelectedValues('wizResources',saved.resources);
  setSelectedValues('wizMeasures',saved.measures);
  if(saved.bookGoal)setSelectedValues('wizBookGoal',[saved.bookGoal]);
  if(saved.smartTemplate)setSelectedValues('wizSmartTemplate',[saved.smartTemplate]);
  if($('#wizPeriod'))$('#wizPeriod').value=saved.period||'';
  if($('#wizCriterion'))$('#wizCriterion').value=saved.criterion||'';
  if($('#wizSituation'))$('#wizSituation').value=saved.situation||activePatient?.situation||lastQuery||'';
  if($('#wizEvaluation'))$('#wizEvaluation').value=saved.evaluationWhen||'';
  if($('#wizEvalCriterion'))$('#wizEvalCriterion').value=saved.evaluationCriterion||'';
  if($('#wizCustomMeasures'))$('#wizCustomMeasures').value=(saved.customMeasures||[]).join('\n');
  for(const savedRisk of saved.riskSelections||[]){
    const idx=(model.risks||[]).findIndex(r=>r.title===savedRisk.title);
    if(idx<0)continue;
    const riskBox=document.querySelector('input[name="wizRisk"][value="'+idx+'"]');
    if(riskBox){riskBox.checked=true;document.querySelector('[data-risk-details="'+idx+'"]')?.classList.add('open')}
    setSelectedValues('riskFactors_'+idx,savedRisk.factors||[]);
    if(savedRisk.goal)setSelectedValues('riskGoals_'+idx,[savedRisk.goal]);
    setSelectedValues('riskMeasures_'+idx,savedRisk.measures||[]);
  }
}

function renderRiskPlans(model,person,period){
  const selected=[...document.querySelectorAll('input[name="wizRisk"]:checked')];
  if(!selected.length)return {html:'',text:''};
  const html=[],text=[];
  for(const input of selected){
    const idx=Number(input.value),r=model.risks[idx];
    if(!r)continue;
    if(r.type==='book'){
      const factors=selectedTexts('riskFactors_'+idx);
      const selectedGoal=selectedOne('riskGoals_'+idx);
      const measures=selectedTexts('riskMeasures_'+idx);
      html.push('<section class="planSection riskPlan"><h4>Zusätzliche Risikodiagnose</h4><p><b>'+esc(r.title)+'</b></p>'+
        '<p><b>Risikofaktoren:</b> '+esc(factors.length?factors.join('; '):'[vom Patientenfall auswählen]')+'</p>'+
        '<p><b>Pflegeziel:</b> '+esc(selectedGoal||person+' bleibt '+(period||'[Zeitraum ergänzen]')+' hinsichtlich dieses bestätigten Risikos ohne Ereignis; das vereinbarte Sicherheitsverhalten wird eingehalten.')+'</p>'+
        '<p><b>Maßnahmen:</b></p>'+listHtml(measures.length?measures:['[passende Maßnahmen auswählen]'])+
        '<p class="note">Quelle: '+esc(r.source||'NANDA/ENP')+'</p></section>');
      text.push('Risikodiagnose: '+r.title+'\nRisikofaktoren: '+(factors.join('; ')||'[auswählen]')+'\nPflegeziel: '+(selectedGoal||person+' bleibt '+(period||'[Zeitraum ergänzen]')+' hinsichtlich dieses bestätigten Risikos ohne Ereignis.')+'\nPflegemaßnahmen:\n'+(measures.map((m,i)=>(i+1)+'. '+m).join('\n')||'[auswählen]'));
    }else{
      html.push('<section class="planSection riskPlan"><h4>DNQP-Risikocheck</h4><p><b>'+esc(r.title)+'</b></p><p>Этот пункт отмечен как область для проверки. Сначала нужен конкретный Pflegebefund/Assessment; приложение не превращает его автоматически в диагноз.</p><p class="note">'+esc(r.standard||'DNQP')+'</p></section>');
      text.push('DNQP-Risikocheck: '+r.title+' — Assessment/Befund erforderlich.');
    }
  }
  return {html:html.join(''),text:text.join('\n\n')};
}

function wizardPlanHtml(plan,riskHtml){
  return '<div class="finalBundle"><div class="frameworkBanner"><b>PESR / PÄS(R) + SMART</b><span>Problem/Ätiologie/Symptome/Ressourcen → Ziel → Maßnahmen → Evaluation</span></div>'+
    renderStructuredPlan(plan)+riskHtml+'</div>';
}


function localizeWizardGerman(){
  if(getLang()!=='de')return;
  const hint=document.querySelector('#modalContent .hintBox');
  if(hint)hint.innerHTML='<b>Logik:</b> Zuerst wählst du die Pflegediagnose und nur tatsächlich vorhandene Patientendaten. Danach Ziel, Risiken und Maßnahmen. Erst anschließend wird PÄS(R), SMART-Ziel, Maßnahmen, Risiken und Evaluation erzeugt.';
  const steps=[...document.querySelectorAll('#modalContent .wizardStep')];
  const texts=[
    'Die passendste Pflegediagnose auswählen. Problemorientierte Diagnosen werden nach PÄS(R) aufgebaut; bei Risikodiagnosen werden keine Symptome erfunden.',
    'Nur Ursachen bzw. Risikofaktoren markieren, die beim Patienten tatsächlich vorliegen.',
    'Welche Kennzeichen oder Symptome sind tatsächlich beobachtbar oder werden vom Patienten angegeben?',
    'Welche Ressourcen hat der Patient? Was kann er selbst, welche Hilfsmittel nutzt er, welche Unterstützung akzeptiert er?',
    'Gefundene Risikodiagnosen aus NANDA/ENP sowie passende DNQP-Risikobereiche. Ein Risiko wird nur übernommen, wenn du es auswählst und es im Fall bestätigt ist.',
    'Ein Pflegeziel aus ENP kann als Grundlage gewählt und anschließend nach SMART messbar formuliert werden.',
    'Passende Maßnahmen aus ENP auswählen. Nur markierte Maßnahmen werden in den finalen Pflegeplan übernommen.',
    'Zeitpunkt und Kriterium der Evaluation festlegen.'
  ];
  steps.forEach((step,i)=>{const p=step.querySelector(':scope > p');if(p&&texts[i])p.textContent=texts[i]});
  const build=$('#wizardBuild');if(build)build.textContent='Konkreten Pflegeplan erstellen';
  const copy=$('#wizardCopy');if(copy)copy.textContent='Kopieren';
  const tr=$('#wizardTranslate');if(tr)tr.textContent='Übersetzen';
  const situationLabel=$('#wizSituation')?.closest('label');if(situationLabel?.firstChild)situationLabel.firstChild.textContent='Situation des Patienten';
  const custom=$('#wizCustomMeasures')?.closest('label');if(custom?.firstChild)custom.firstChild.textContent='Eigene / konkretisierte Maßnahmen';
  document.querySelectorAll('.riskDetails strong').forEach(el=>{
    if(el.textContent.includes('отметить'))el.textContent='Risikofaktoren – nur tatsächlich vorhandene auswählen';
  });
}

function openWizard(contextHits,direction,preferred){
  reopenModal=()=>openWizard(contextHits,direction,preferred);
  if(!knowledgeBase){toast(t('chooseBooks'));return}
  const model=buildWizardModel(knowledgeBase,contextHits,direction,lastQuery);
  if(!model.diagnoses.length){toast(ui('Не удалось собрать варианты из книг','Keine passenden Varianten aus den Büchern gefunden'));return}

  modal('<h2>Pflegeplan-Assistent</h2>'+
    '<div class="hintBox"><b>Логика:</b> сначала выбираешь диагноз и только реальные данные пациента. Затем выбираешь цель и меры. После этого приложение собирает PÄS(R), SMART-Ziel, Maßnahmen, Risiken и Evaluation. Ничего из книги не считается фактом пациента, пока ты это не отметишь.</div>'+
    '<div class="frameworkMini"><b>'+esc(frameworkInfo.diagnosisSchema)+'</b><span>'+esc(frameworkInfo.smartSchema)+'</span></div>'+
    '<section class="wizardStep"><h3>1. Pflegediagnose</h3><p>Выбери наиболее подходящий диагноз. Для обычной Pflegediagnose используется PÄS(R); для Risikodiagnose симптомы не добавляются.</p>'+
      wizardDiagnosisHtml(model,preferred)+'</section>'+
    '<section class="wizardStep"><h3 id="wizFactorsTitle">2. Ätiologie / Ursachen</h3><p>Отметь только причины/факторы, которые действительно относятся к пациенту.</p><div id="wizFactorsChoices"></div></section>'+
    '<section class="wizardStep" id="wizSymptomsStep"><h3>3. Symptome / Kennzeichen</h3><p>Что реально наблюдается или сообщает пациент?</p><div id="wizSymptomsChoices"></div></section>'+
    '<section class="wizardStep"><h3>4. Ressourcen</h3><p>Что пациент ещё может, чем пользуется, какую помощь принимает?</p><div id="wizResourcesChoices"></div></section>'+
    '<section class="wizardStep"><h3>5. Risiken / Prophylaxen</h3><p>Здесь вместе показаны найденные Risikodiagnosen из книг и подходящие области DNQP. Риск включается в итог только после твоего выбора.</p>'+
      wizardRiskHtml(model)+'</section>'+
    '<section class="wizardStep"><h3>6. Pflegeziel</h3><p>Сначала можно выбрать цель из ENP как основу, затем сделать её измеримой через SMART.</p><div id="wizGoalsChoices"></div>'+
      '<div class="subStep"><b>SMART-варианты формулировки</b>'+wizardChoiceHtml('wizSmartTemplate',(model.smartTemplates||[]).map(x=>({text:x,source:'SMART-Vorlage'})),'radio')+'</div>'+
      '<div class="formGrid compactGrid">'+
        '<div class="field"><label>Person<input id="wizPerson" value="'+esc(activePatient?.alias||'Frau/Herr X')+'"></label><small>'+esc(ui('Например: Frau M.','Zum Beispiel: Frau M.'))+'</small></div>'+
        '<div class="field"><label>Zeitraum<input id="wizPeriod" placeholder="z. B. 7 Tage или bis 29.09.2026"></label><small>Обязательный срок для T.</small></div>'+
        '<div class="field"><label>Messkriterium / конкретный результат<textarea id="wizCriterion" placeholder="z. B. geht 10 Meter mit Rollator und Begleitung ohne Gleichgewichtsverlust"></textarea></label><small>Сделай результат наблюдаемым: расстояние, частота, шкала, объём помощи, событие.</small></div>'+
        '<div class="field"><label>'+esc(ui('Ситуация пациента','Situation des Patienten'))+'<textarea id="wizSituation">'+esc(activePatient?.situation||lastQuery)+'</textarea></label><small>'+esc(ui('Исходная жалоба/ситуация.','Ausgangssituation/Beschwerden.'))+'</small></div>'+
      '</div></section>'+
    '<section class="wizardStep"><h3>7. Pflegemaßnahmen</h3><p>Выбери подходящие меры из ENP. Они попадут в финальный план только после отметки.</p><div id="wizMeasuresChoices"></div>'+
      '<div class="field customMeasure"><label>Свои/конкретизированные меры<textarea id="wizCustomMeasures" placeholder="Каждая мера с новой строки"></textarea></label></div></section>'+
    '<section class="wizardStep"><h3>8. Evaluation</h3><div class="formGrid compactGrid"><div class="field"><label>Когда оценивать<input id="wizEvaluation" placeholder="z. B. täglich im Frühdienst / am 29.09.2026"></label></div><div class="field"><label>Как оценивать<input id="wizEvalCriterion" placeholder="по SMART-Messkriterium / конкретному Assessment"></label></div></div></section>'+
    '<div class="wizardFooter"><button id="wizardBuild">Собрать конкретный Pflegeplan</button><button id="wizardCopy" class="secondaryAction">Копировать</button><button id="wizardTranslate" class="secondaryAction">Перевести</button></div>'+
    '<div id="wizardOutput"></div><div id="wizardRu" class="translation hidden"></div>'
  );

  [...document.querySelectorAll('input[name="wizDiagnosis"]')].forEach(x=>x.onchange=()=>syncWizardOptions(model));
  syncWizardOptions(model);
  restoreWizardSelection(model);
  localizeWizardGerman();

  document.querySelectorAll('input[name="wizRisk"]').forEach(x=>x.onchange=()=>{
    const box=document.querySelector('[data-risk-details="'+x.value+'"]');
    if(box)box.classList.toggle('open',x.checked);
  });

  const hookGoalRadios=()=>{
    document.querySelectorAll('input[name="wizBookGoal"], input[name="wizSmartTemplate"]').forEach(x=>x.onchange=()=>{
      if(x.name==='wizBookGoal'&&x.checked){
        $('#wizCriterion').value=decodeURIComponent(x.value);
        document.querySelectorAll('input[name="wizSmartTemplate"]').forEach(y=>y.checked=false);
      }
      if(x.name==='wizSmartTemplate'&&x.checked){
        $('#wizCriterion').value=decodeURIComponent(x.value);
        document.querySelectorAll('input[name="wizBookGoal"]').forEach(y=>y.checked=false);
      }
    });
  };
  hookGoalRadios();

  const originalSync=syncWizardOptions;
  [...document.querySelectorAll('input[name="wizDiagnosis"]')].forEach(x=>x.onchange=()=>{originalSync(model);hookGoalRadios()});

  const buildFinal=()=>{
    const raw=document.querySelector('input[name="wizDiagnosis"]:checked')?.value||'';
    const key=raw?decodeURIComponent(raw):'';
    const exact=optionsForDiagnosis(knowledgeBase,key);
    const selectedRisk=exact?.risk===true;
    const context=makePlanningContext(contextHits,direction);
    if(exact){
      context.problemDiag=selectedRisk?context.problemDiag:{kind:exact.kind,page:exact.pages?.[0]||0,code:exact.code,title:exact.title,risk:false};
      context.riskDiag=selectedRisk?{kind:exact.kind,page:exact.pages?.[0]||0,code:exact.code,title:exact.title,risk:true}:context.riskDiag;
      context.fallback={kind:exact.kind,page:exact.pages?.[0]||0,code:exact.code,title:exact.title,risk:selectedRisk};
    }

    const custom=$('#wizCustomMeasures').value.split(/\n|;/).map(x=>x.trim()).filter(Boolean);
    const measures=[...selectedTexts('wizMeasures'),...custom];
    const criterion=$('#wizCriterion').value.trim();
    const person=$('#wizPerson').value.trim()||'Frau/Herr X';
    const period=$('#wizPeriod').value.trim();
    const plan=buildPlan(context,{
      mode:selectedRisk?'risk':'problem',
      person:person,
      period:period,
      situation:$('#wizSituation').value.trim(),
      factors:selectedTexts('wizFactors').join('; '),
      symptoms:selectedTexts('wizSymptoms').join('; '),
      resources:selectedTexts('wizResources').join('; '),
      criterion:criterion,
      measures:measures.join('\n')
    });

    if($('#wizEvaluation').value.trim())plan.evaluationWhen=$('#wizEvaluation').value.trim();
    if($('#wizEvalCriterion').value.trim())plan.evaluationCriterion=$('#wizEvalCriterion').value.trim();

    const risks=renderRiskPlans(model,person,period);
    currentPlan={plan:plan,riskText:risks.text};
    $('#wizardOutput').innerHTML=wizardPlanHtml(plan,risks.html);

    const diagnosisKey=decodeURIComponent(document.querySelector('input[name="wizDiagnosis"]:checked')?.value||'');
    const riskSelections=[...document.querySelectorAll('input[name="wizRisk"]:checked')].map(x=>{
      const idx=Number(x.value),r=model.risks[idx];
      return r?{
        title:r.title,
        type:r.type,
        factors:selectedTexts('riskFactors_'+idx),
        goal:selectedOne('riskGoals_'+idx),
        measures:selectedTexts('riskMeasures_'+idx)
      }:null;
    }).filter(Boolean);
    const selectedRiskTitles=riskSelections.map(x=>x.title);
    const selection={
      diagnosisKey,
      factors:selectedTexts('wizFactors'),
      symptoms:selectedTexts('wizSymptoms'),
      resources:selectedTexts('wizResources'),
      measures:selectedTexts('wizMeasures'),
      customMeasures:custom,
      bookGoal:selectedOne('wizBookGoal'),
      smartTemplate:selectedOne('wizSmartTemplate'),
      risks:selectedRiskTitles,
      riskSelections,
      period,
      criterion,
      situation:$('#wizSituation').value.trim(),
      evaluationWhen:$('#wizEvaluation').value.trim(),
      evaluationCriterion:$('#wizEvalCriterion').value.trim()
    };
    persistPatientPlan(selection,planToText(plan)+(risks.text?'\n\n'+risks.text:''));
    return currentPlan;
  };

  $('#wizardBuild').onclick=buildFinal;
  $('#wizardCopy').onclick=async()=>{const bundle=currentPlan||buildFinal();await navigator.clipboard.writeText(planToText(bundle.plan)+(bundle.riskText?'\n\n'+bundle.riskText:''));toast('Pflegeplan скопирован')};
  $('#wizardTranslate').onclick=async()=>{const bundle=currentPlan||buildFinal();const box=$('#wizardRu');box.classList.remove('hidden');await translateInto(planToText(bundle.plan)+(bundle.riskText?'\n\n'+bundle.riskText:''),box,{source:'Pflegeplanung',title:bundle.plan.diagnosis?.title||'Pflegeplan'})};
}

$('#installBtn').onclick=()=>{
  reopenModal=()=>$('#installBtn').click();
  modal(getLang()==='de'
    ?'<h2>Auf iPhone installieren</h2><ol><li>Diese Seite in Safari öffnen.</li><li>„Teilen“ tippen.</li><li>„Zum Home-Bildschirm“ wählen.</li><li>PflegeBuch hinzufügen.</li></ol><p class="note">PDFs und Suchindex bleiben lokal auf dem Gerät.</p>'
    :'<h2>Установка на iPhone</h2><ol><li>Открой этот сайт именно в Safari.</li><li>Нажми «Поделиться».</li><li>Выбери «На экран Домой».</li><li>Подтверди добавление PflegeBuch.</li></ol><p class="note">После установки приложение открывается отдельно. PDF и индекс хранятся локально на устройстве.</p>');
};

$('#patientsBtn').onclick=async()=>{setAppMode('patient');await refreshPatients();patientListModal()};
$('#headerPatientsBtn').onclick=async()=>{setAppMode('patient');await refreshPatients();patientListModal()};
$('#backPatientsBtn').onclick=async()=>{setAppMode('patient');await refreshPatients();patientListModal()};
$('#newPatientBtn').onclick=()=>{setAppMode('patient');newPatientModal(null)};
$('#headerNewPatientBtn').onclick=()=>{setAppMode('patient');newPatientModal(null)};
$('#bookSearchTab').onclick=()=>setAppMode('books');
$('#patientPlanTab').onclick=async()=>{setAppMode('patient');await refreshPatients();if(!activePatient){if(patientCache.length)patientListModal();else newPatientModal(null)}};
$('#editPatientBtn').onclick=()=>newPatientModal(activePatient);
$('#langBtn').onclick=toggleInterfaceLanguage;
$('#modalLangBtn').onclick=toggleInterfaceLanguage;

applyStaticI18n();
refreshLanguage();
Promise.all([loadBooks(),refreshPatients()]).then(()=>{setAppMode('books');refreshLanguage()});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
