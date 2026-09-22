import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});

async function exists(sel){return await page.locator(sel).count()>0}

try{
  await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#demoBtn');
  const directTranslation=await page.evaluate(async()=>{const m=await import('./translator.js');return await m.translateDeRu('Guten Morgen')});
  assert.ok(String(directTranslation).length>2,'direct browser translation failed');
  await page.click('#demoBtn');
  await page.waitForTimeout(150);

  // book search mode remains independent from patient planning
  assert.ok(await page.locator('#bookSearchTab').count(),'book search tab missing');
  await page.fill('#query','плохо ходит');
  await page.click('#sendBtn');
  await page.waitForSelector('.result');
  assert.ok(await page.locator('.result [data-open]').count()>0,'book page open button missing');
  assert.equal(await page.locator('.result [data-plan]').count(),0,'planning button must stay hidden in pure book search mode');
  const resultText=await page.locator('#results').innerText();
  assert.match(resultText,/Domäne|ДОМЕНА/i,'NANDA domain missing from book search');
  assert.match(resultText,/Klasse|КЛАСС/i,'NANDA class missing from book search');
  assert.match(resultText,/Diagnosencode/i,'NANDA diagnosis code missing from book search');
  assert.match(resultText,/Pflegediagnose/i,'diagnosis title context missing from book search');
  assert.match(resultText,/Treffer in|Найдено в разделе/i,'matching section missing from book search');
  const groups=page.locator('.sourceResultGroup');
  assert.ok(await groups.count()>=2,'both NANDA and ENP result groups must be visible');
  const headers=await page.locator('.sourceGroupHeader').allTextContents();
  assert.ok(headers.some(x=>/NANDA/.test(x)),'NANDA group missing');
  assert.ok(headers.some(x=>/ENP/.test(x)),'ENP group missing');
  const nandaGroup=page.locator('.sourceResultGroup').filter({hasText:'NANDA'}).first();
  const enpGroup=page.locator('.sourceResultGroup').filter({hasText:'ENP'}).first();
  assert.match(await nandaGroup.locator('.relevanceTag').first().innerText(),/Лучшее|Beste/,'best NANDA result not marked');
  assert.match(await enpGroup.locator('.relevanceTag').first().innerText(),/Лучшее|Beste/,'best ENP result not marked');
  const nandaPct=Number(((await nandaGroup.locator('.relevanceTag').first().innerText()).match(/(\d{1,3})%/)||[])[1]);
  const enpPct=Number(((await enpGroup.locator('.relevanceTag').first().innerText()).match(/(\d{1,3})%/)||[])[1]);
  assert.ok(Number.isFinite(nandaPct)&&Number.isFinite(enpPct),'source relevance percentages missing');
  assert.ok(nandaPct>=80,'best NANDA mobility match should be high relevance');
  assert.ok(enpPct>=80,'best ENP mobility match should be high relevance');

  const nandaCard=page.locator('.result').filter({hasText:'00365'}).first();
  assert.ok(await nandaCard.count(),'expected NANDA 00365 result missing');
  await nandaCard.locator('[data-open]').click();
  await page.waitForSelector('.pageMetaCard');
  const pageMeta=await page.locator('.pageMetaCard').innerText();
  assert.match(pageMeta,/Domäne|ДОМЕНА/i);
  assert.match(pageMeta,/Klasse|КЛАСС/i);
  await page.click('#modalClose');

  // live SMART dialogue for the concrete "Sturzrisiko" case
  await page.fill('#query','риск падения');
  await page.click('#sendBtn');
  await page.waitForSelector('.result');
  const fallRiskCard=page.locator('.result').filter({hasText:'00303'}).first();
  assert.ok(await fallRiskCard.count(),'expected NANDA Sturzrisiko 00303 result missing');
  await fallRiskCard.locator('[data-dialogue]').click();
  await page.waitForSelector('.dialogueMsg');
  for(let i=0;i<40;i++){
    if(await page.locator('.dialoguePlanCard').count())break;
    if(await page.locator('.multiAnswers').count()){
      const checks=page.locator('.multiAnswers input[type="checkbox"]');
      if(await checks.count())await checks.first().check();
      await page.locator('#dialogueMultiOk').click();
      continue;
    }
    if(await page.locator('.quickAnswers button').count()){
      const buttons=page.locator('.quickAnswers button');
      let idx=0;
      const labels=await buttons.allTextContents();
      const noIdx=labels.findIndex(x=>/Нет|Nein/.test(x));
      if(noIdx>=0)idx=noIdx;
      await buttons.nth(idx).click();
      continue;
    }
    const qid=await page.locator('#query').getAttribute('data-dialogue-question');
    let answer='Testangabe';
    if(qid==='period')answer='7 Tage';
    else if(qid==='goal')answer='geht 10 Meter mit Rollator und Begleitung ohne Gleichgewichtsverlust';
    else if(qid==='evaluation')answer='täglich im Frühdienst anhand der Gehstrecke';
    else if(qid==='walkingDetail')answer='Rollator, 10 Meter, Begleitung';
    else if(qid==='painNrs')answer='3';
    await page.fill('#query',answer);
    await page.click('#sendBtn');
  }
  await page.waitForSelector('.dialoguePlanCard',{timeout:15000});
  const chatPlan=await page.locator('.dialoguePlanCard').innerText();
  assert.match(chatPlan,/SMART/i,'SMART missing from conversational plan');
  assert.match(chatPlan,/NANDA/i,'NANDA source missing from conversational plan');
  assert.match(chatPlan,/ENP/i,'ENP source missing from conversational plan');
  assert.match(chatPlan,/RU/i,'Russian translation block missing');
  assert.match(chatPlan,/DNQP/i,'authoritative nursing source missing');
  await page.click('#dialogueNew');

  await page.fill('#query','Риск раздражений кожи');
  await page.click('#sendBtn');
  await page.waitForSelector('.result');
  const skinSearch=await page.locator('#results').innerText();
  assert.match(skinSearch,/Haut|Hautintegrität/i,'semantic skin-risk search failed');
  assert.match(skinSearch,/Risiko/i,'risk diagnosis should be surfaced for skin-risk query');

  await page.click('#newPatientBtn');
  await page.waitForSelector('#patientAlias');
  await page.fill('#patientAlias','Frau A.');
  await page.fill('#patientSituation','боится встать и плохо ходит');
  await page.click('#savePatientBtn');

  await page.waitForSelector('#wizardBuild',{timeout:10000});
  assert.ok(await page.locator('input[name="wizDiagnosis"]').count()>0,'diagnosis options missing');
  assert.ok(await page.locator('input[name="wizFactors"]').count()>0,'factor options missing');
  assert.ok(await page.locator('input[name="wizRisk"]').count()>0,'risk options missing');

  const factor=page.locator('input[name="wizFactors"]').first();
  if(await factor.count())await factor.check();
  const symptom=page.locator('input[name="wizSymptoms"]').first();
  if(await symptom.count())await symptom.check();
  const resource=page.locator('input[name="wizResources"]').first();
  if(await resource.count())await resource.check();
  const measure=page.locator('input[name="wizMeasures"]').first();
  if(await measure.count())await measure.check();

  await page.fill('#wizPeriod','7 Tage');
  await page.fill('#wizCriterion','geht 10 Meter mit Rollator und Begleitung ohne Gleichgewichtsverlust');

  const riskBoxes=page.locator('input[name="wizRisk"]');
  const riskCount=await riskBoxes.count();
  for(let i=0;i<riskCount;i++){
    await riskBoxes.nth(i).check();
    await page.waitForTimeout(50);
    if(await page.locator('input[name^="riskMeasures_"]:visible').count())break;
  }
  const riskFactor=page.locator('input[name^="riskFactors_"]:visible').first();
  if(await riskFactor.count())await riskFactor.check();
  const riskMeasure=page.locator('input[name^="riskMeasures_"]:visible').first();
  if(await riskMeasure.count())await riskMeasure.check();

  await page.click('#wizardBuild');
  await page.waitForSelector('#wizardOutput .finalBundle');
  const output=await page.locator('#wizardOutput').innerText();
  assert.match(output,/Pflegediagnose/);
  assert.match(output,/SMART/i);
  assert.match(output,/10 Meter/);
  assert.match(output,/PFLEGE.*NAHMEN/i);
  assert.match(output,/NANDA/i,'final plan should cite NANDA');
  assert.match(output,/ENP/i,'final plan should cite ENP');

  await page.click('#modalLangBtn');
  await page.waitForSelector('#wizardBuild');
  const hint=await page.locator('#modalContent .hintBox').innerText();
  assert.match(hint,/Logik:/);

  await page.click('#modalClose');
  await page.click('#headerPatientsBtn').catch(async()=>{await page.click('#patientsBtn')});
  await page.waitForSelector('.patientCard');
  const listText=await page.locator('.patientList').innerText();
  assert.match(listText,/Frau A\./);

  const continueBtn=page.locator('[data-plan-patient]').first();
  await continueBtn.click();
  await page.waitForSelector('#wizardBuild');
  assert.equal(await page.inputValue('#wizPeriod'),'7 Tage','saved period not restored');
  assert.match(await page.inputValue('#wizCriterion'),/10 Meter/);

  console.log('ui e2e: OK');
}finally{
  await browser.close();
}
