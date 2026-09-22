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
