export const SOURCE_REGISTRY={
  DNQP_STURZ:{
    id:'DNQP_STURZ',
    title:'DNQP Expertenstandard Sturzprophylaxe in der Pflege, 2. Aktualisierung 2022',
    url:'https://www.dnqp.de/expertenstandards-und-auditinstrumente/',
    role:'Pflegefachliche Risikoeinschätzung und individueller Maßnahmenplan'
  },
  DNQP_HAUT:{
    id:'DNQP_HAUT',
    title:'DNQP Erhaltung und Förderung der Hautintegrität in der Pflege, 2024',
    url:'https://www.dnqp.de/expertenstandards-und-auditinstrumente/',
    role:'Pflegefachliche Einschätzung hautbezogener Risiken und Probleme'
  },
  DNQP_SCHMERZ:{
    id:'DNQP_SCHMERZ',
    title:'DNQP Schmerzmanagement in der Pflege, Aktualisierung 2020',
    url:'https://www.dnqp.de/expertenstandards-und-auditinstrumente/',
    role:'Pflegefachliches Schmerzassessment und Maßnahmenplanung'
  },
  DNQP_KONTINENZ:{
    id:'DNQP_KONTINENZ',
    title:'DNQP Kontinenzförderung in der Pflege, Aktualisierung 2024',
    url:'https://www.dnqp.de/expertenstandards-und-auditinstrumente/',
    role:'Pflegefachliche Kontinenzeinschätzung'
  },
  BIBB:{
    id:'BIBB',
    title:'BIBB Rahmenpläne der Fachkommission nach § 53 PflBG',
    url:'https://www.bibb.de/de/216384.php',
    role:'Bundesweite Grundlage für Pflegeausbildung und Pflegeprozess-Kompetenzen'
  },
  GESUND_STURZ:{
    id:'GESUND_STURZ',
    title:'gesund.bund.de – Stürze bei älteren Menschen',
    url:'https://gesund.bund.de/stuerze-aeltere-menschen',
    role:'Öffentliche Gesundheitsinformation zu häufigen Sturzfaktoren'
  },
  GESUND_ORTHO:{
    id:'GESUND_ORTHO',
    title:'gesund.bund.de – Orthostatische Hypotonie',
    url:'https://gesund.bund.de/orthostatische-hypotonie',
    role:'Öffentliche Gesundheitsinformation zu Schwindel beim Aufstehen'
  },
  AWMF_SCHMERZ:{
    id:'AWMF_SCHMERZ',
    title:'AWMF GeriPAIN – Schmerzmanagement bei geriatrischen Patient:innen',
    url:'https://www.awmf.org/aktuelles/awmf-aktuell/schmerzmanagement-bei-geriatrischen-patientinnen-in-allen-versorgungssettings-geripain-1',
    role:'Interprofessionelles geriatrisches Schmerzassessment'
  },
  AWMF_ERNAEHRUNG:{
    id:'AWMF_ERNAEHRUNG',
    title:'AWMF – Klinische Ernährung und Hydrierung im Alter',
    url:'https://www.awmf.org/aktuelles/awmf-aktuell/klinische-ernaehrung-und-hydrierung-im-alter',
    role:'Evidenzbasierte Empfehlungen zu Ernährung und Hydrierung im Alter'
  },
  AWMF_DELIR:{
    id:'AWMF_DELIR',
    title:'AWMF S3 – Delir im höheren Lebensalter',
    url:'https://www.awmf.org/aktuelles/awmf-aktuell/delir-im-hoeheren-lebensalter-eine-transsektoral-umsetzbare-interdisziplinaer-interprofessionelle-leitlinie-zu-delir-praevention-diagnostik-und-therapie-beim-alten-menschen-2',
    role:'Interprofessionelle Delirerkennung und -prävention'
  }
};

const yesNo=[
  {value:'yes',ru:'Да',de:'Ja'},
  {value:'no',ru:'Нет',de:'Nein'},
  {value:'unknown',ru:'Не знаю',de:'Unbekannt'}
];

const ability=[
  {value:'independent',ru:'Самостоятельно',de:'selbstständig'},
  {value:'supervision',ru:'Нужен присмотр',de:'unter Aufsicht'},
  {value:'one_help',ru:'Нужна помощь 1 человека',de:'mit Hilfe einer Person'},
  {value:'two_help',ru:'Нужна помощь 2 человек',de:'mit Hilfe von zwei Personen'},
  {value:'unable',ru:'Не может',de:'nicht möglich'}
];

const gait=[
  {value:'independent',ru:'Ходит самостоятельно',de:'geht selbstständig'},
  {value:'aid',ru:'Ходит с Hilfsmittel',de:'geht mit Hilfsmittel'},
  {value:'supervision',ru:'Ходит только под присмотром',de:'geht nur unter Aufsicht'},
  {value:'assist',ru:'Нужна физическая помощь',de:'benötigt körperliche Hilfe'},
  {value:'unable',ru:'Не ходит',de:'geht nicht'}
];

export const INTERVIEW_BANKS={
  fall:{
    concepts:['fall','mobility'],
    sources:['DNQP_STURZ','GESUND_STURZ','GESUND_ORTHO'],
    questions:[
      {id:'recentFall',ru:'Были падения в последнее время?',de:'Gab es in letzter Zeit Stürze?',type:'choice',options:yesNo,fact:{yes:'Stürze in der Vorgeschichte'}},
      {id:'dizziness',ru:'Есть головокружение или потемнение в глазах, особенно при вставании?',de:'Bestehen Schwindel oder Schwarzwerden vor Augen, besonders beim Aufstehen?',type:'choice',options:yesNo,factor:{yes:'Schwindel beim Aufstehen'}},
      {id:'standAbility',ru:'Как пациент встаёт с кровати или стула?',de:'Wie gelingt das Aufstehen vom Bett oder Stuhl?',type:'choice',options:ability,resourceMap:{independent:'steht selbstständig auf',supervision:'steht unter Aufsicht auf',one_help:'steht mit Hilfe einer Person auf',two_help:'steht mit Hilfe von zwei Personen auf',unable:'kann nicht selbstständig aufstehen'}},
      {id:'walkAbility',ru:'Как пациент ходит?',de:'Wie geht der Patient / die Patientin?',type:'choice',options:gait,resourceMap:{independent:'geht selbstständig',aid:'geht mit Hilfsmittel',supervision:'geht unter Aufsicht',assist:'geht mit körperlicher Hilfe',unable:'ist nicht gehfähig'}},
      {id:'walkingDetail',ru:'Если ходит: с чем и примерно сколько? Например: Rollator, 10 Meter, Begleitung.',de:'Falls mobil: womit und ungefähr wie weit? Zum Beispiel Rollator, 10 Meter, Begleitung.',type:'text',askIf:a=>a.walkAbility&&a.walkAbility!=='unable'},
      {id:'balance',ru:'Походка или равновесие неустойчивые?',de:'Sind Gang oder Gleichgewicht unsicher?',type:'choice',options:yesNo,symptom:{yes:'unsicheres Gangbild / beeinträchtigtes Gleichgewicht'}},
      {id:'vision',ru:'Есть заметное ухудшение зрения?',de:'Besteht eine relevante Sehbeeinträchtigung?',type:'choice',options:yesNo,factor:{yes:'Sehbeeinträchtigung'}},
      {id:'medRisk',ru:'По документации есть лекарства, которые могут давать сонливость, головокружение или снижать давление?',de:'Gibt es laut Dokumentation Medikamente mit möglicher Sedierung, Schwindel oder Blutdrucksenkung?',type:'choice',options:yesNo,factor:{yes:'möglicher medikamentenbezogener Sturzfaktor'},note:'Медикаменты не отменять автоматически; при подозрении нужна проверка врачом/аптекой.'},
      {id:'environment',ru:'Есть препятствия: кабели, пороги, скользкий пол, плохая обувь, плохое освещение?',de:'Gibt es Stolperfallen, glatten Boden, ungeeignetes Schuhwerk oder schlechte Beleuchtung?',type:'choice',options:yesNo,factor:{yes:'umgebungsbezogene Sturzfaktoren'}},
      {id:'toiletUrgency',ru:'Пациент часто спешит в туалет или встаёт ночью?',de:'Muss die Person häufig dringend oder nachts zur Toilette?',type:'choice',options:yesNo,factor:{yes:'häufiger / nächtlicher Toilettengang'}},
      {id:'fear',ru:'Пациент боится вставать или ходить из-за страха падения?',de:'Besteht Angst vor dem Aufstehen oder Gehen wegen Sturzangst?',type:'choice',options:yesNo,factor:{yes:'Sturzangst'}},
      {id:'goal',ru:'Какой результат нужен? Например: безопасно пройти 10 м с Rollator и сопровождением.',de:'Welches konkrete Ergebnis soll erreicht werden? Zum Beispiel 10 m sicher mit Rollator und Begleitung gehen.',type:'text'},
      {id:'period',ru:'За какой срок оценить цель? Например: 7 дней или до 29.09.2026.',de:'Bis wann soll das Ziel beurteilt werden? Zum Beispiel in 7 Tagen oder bis 29.09.2026.',type:'text'}
    ]
  },
  skin:{
    concepts:['skin-integrity'],
    sources:['DNQP_HAUT'],
    questions:[
      {id:'skinProblem',ru:'Уже есть изменение кожи или речь только о риске?',de:'Besteht bereits eine Hautveränderung oder nur ein Risiko?',type:'choice',options:[{value:'problem',ru:'Уже есть проблема',de:'Problem vorhanden'},{value:'risk',ru:'Только риск',de:'Nur Risiko'}]},
      {id:'location',ru:'Где именно проблема/риск?',de:'Wo befindet sich das Hautproblem bzw. Risiko?',type:'text'},
      {id:'redness',ru:'Есть покраснение?',de:'Besteht eine Rötung?',type:'choice',options:yesNo,symptom:{yes:'Rötung'}},
      {id:'moisture',ru:'Есть влажность кожи из-за пота, недержания или выделений?',de:'Besteht Feuchtigkeit durch Schweiß, Inkontinenz oder Sekret?',type:'choice',options:yesNo,factor:{yes:'Feuchtigkeit'}},
      {id:'pressure',ru:'Есть длительное давление или ограниченная подвижность?',de:'Bestehen länger anhaltender Druck oder eingeschränkte Mobilität?',type:'choice',options:yesNo,factor:{yes:'Druckbelastung / eingeschränkte Mobilität'}},
      {id:'friction',ru:'Есть трение или сдвиг кожи?',de:'Bestehen Reibung oder Scherkräfte?',type:'choice',options:yesNo,factor:{yes:'Reibung / Scherkräfte'}},
      {id:'itchPain',ru:'Есть зуд, жжение или боль?',de:'Bestehen Juckreiz, Brennen oder Schmerzen?',type:'choice',options:yesNo,symptom:{yes:'Juckreiz/Brennen/Schmerz'}},
      {id:'goal',ru:'Какой конкретный результат нужен? Например: кожа остаётся целой без новых покраснений.',de:'Welches konkrete Ergebnis soll erreicht werden? Zum Beispiel intakte Haut ohne neue Rötungen.',type:'text'},
      {id:'period',ru:'За какой срок оценить цель?',de:'Bis wann soll das Ziel beurteilt werden?',type:'text'}
    ]
  },
  pain:{
    concepts:['pain'],
    sources:['DNQP_SCHMERZ','AWMF_SCHMERZ'],
    questions:[
      {id:'painSite',ru:'Где болит?',de:'Wo bestehen Schmerzen?',type:'text'},
      {id:'painNrs',ru:'Интенсивность боли по шкале 0–10?',de:'Schmerzintensität auf einer Skala von 0–10?',type:'text'},
      {id:'painWhen',ru:'Боль в покое, при движении или постоянно?',de:'Schmerzen in Ruhe, bei Bewegung oder dauerhaft?',type:'choice',options:[{value:'rest',ru:'В покое',de:'in Ruhe'},{value:'movement',ru:'При движении',de:'bei Bewegung'},{value:'both',ru:'И так и так',de:'beides'}]},
      {id:'painEffect',ru:'Что из-за боли пациент не может или делает хуже?',de:'Welche Aktivität ist durch den Schmerz eingeschränkt?',type:'text'},
      {id:'painPlan',ru:'Есть назначенный план обезболивания/Bedarfsmedikation?',de:'Gibt es einen ärztlich angeordneten Schmerz- bzw. Bedarfsmedikationsplan?',type:'choice',options:yesNo},
      {id:'goal',ru:'Какой приемлемый уровень боли нужен? Например: NRS ≤ 3 при ходьбе.',de:'Welcher akzeptable Schmerzgrad soll erreicht werden? Zum Beispiel NRS ≤ 3 beim Gehen.',type:'text'},
      {id:'period',ru:'Когда оценить результат?',de:'Wann soll das Ergebnis beurteilt werden?',type:'text'}
    ]
  },
  nutrition:{
    concepts:['nutrition','swallowing'],
    sources:['AWMF_ERNAEHRUNG'],
    questions:[
      {id:'intake',ru:'Пациент ест и пьёт достаточно?',de:'Isst und trinkt die Person ausreichend?',type:'choice',options:yesNo},
      {id:'weightLoss',ru:'Была заметная потеря веса?',de:'Gab es einen auffälligen Gewichtsverlust?',type:'choice',options:yesNo,factor:{yes:'ungewollter Gewichtsverlust'}},
      {id:'swallow',ru:'Есть кашель, поперхивание или трудности при глотании?',de:'Bestehen Husten, Verschlucken oder Schluckbeschwerden?',type:'choice',options:yesNo,factor:{yes:'Schluckbeschwerden'},redFlag:{yes:'Bei neu aufgetretenen oder deutlichen Schluckproblemen ist eine fachliche Abklärung erforderlich.'}},
      {id:'helpEating',ru:'Нужна помощь при еде/питье?',de:'Wird Unterstützung beim Essen oder Trinken benötigt?',type:'choice',options:yesNo},
      {id:'preference',ru:'Какие блюда/напитки пациент принимает лучше?',de:'Welche Speisen oder Getränke werden gut angenommen?',type:'text'},
      {id:'goal',ru:'Какой измеримый результат нужен? Например: выпивает 1500 мл/сутки, если это разрешено.',de:'Welches messbare Ergebnis soll erreicht werden? Zum Beispiel Trinkmenge entsprechend der individuellen Vorgabe.',type:'text'},
      {id:'period',ru:'Когда оценить результат?',de:'Wann soll das Ergebnis beurteilt werden?',type:'text'}
    ]
  },
  breathing:{
    concepts:['breathing'],
    sources:['BIBB'],
    questions:[
      {id:'dyspneaRest',ru:'Есть одышка в покое?',de:'Besteht Atemnot in Ruhe?',type:'choice',options:yesNo,redFlag:{yes:'Neue oder starke Atemnot in Ruhe muss zeitnah fachlich/ärztlich beurteilt werden.'}},
      {id:'dyspneaActivity',ru:'Одышка появляется при нагрузке?',de:'Tritt Atemnot bei Belastung auf?',type:'choice',options:yesNo},
      {id:'cough',ru:'Есть кашель или мокрота?',de:'Bestehen Husten oder Auswurf?',type:'choice',options:yesNo},
      {id:'spo2',ru:'SpO₂ известна? Если да — напиши значение.',de:'Ist die SpO₂ bekannt? Falls ja, Wert eingeben.',type:'text'},
      {id:'helpBreathing',ru:'Какая поза или дыхательная техника помогает?',de:'Welche Position oder Atemtechnik hilft?',type:'text'},
      {id:'goal',ru:'Какой измеримый результат нужен?',de:'Welches messbare Ergebnis soll erreicht werden?',type:'text'},
      {id:'period',ru:'Когда оценить результат?',de:'Wann soll das Ergebnis beurteilt werden?',type:'text'}
    ]
  },
  cognition:{
    concepts:['cognition'],
    sources:['AWMF_DELIR'],
    questions:[
      {id:'acuteChange',ru:'Спутанность появилась внезапно или резко усилилась?',de:'Ist die Verwirrtheit neu oder akut deutlich stärker geworden?',type:'choice',options:yesNo,redFlag:{yes:'Eine akute kognitive Veränderung sollte zeitnah fachlich/ärztlich abgeklärt werden.'}},
      {id:'orientation',ru:'Ориентируется во времени, месте и ситуации?',de:'Ist die Person zu Zeit, Ort und Situation orientiert?',type:'choice',options:yesNo},
      {id:'communication',ru:'Может сообщить потребности и понять инструкции?',de:'Kann die Person Bedürfnisse äußern und Anleitungen verstehen?',type:'choice',options:yesNo},
      {id:'goal',ru:'Какой конкретный результат нужен?',de:'Welches konkrete Ergebnis soll erreicht werden?',type:'text'},
      {id:'period',ru:'Когда оценить результат?',de:'Wann soll das Ergebnis beurteilt werden?',type:'text'}
    ]
  },
  generic:{
    concepts:[],
    sources:['BIBB'],
    questions:[
      {id:'problemOrRisk',ru:'Это уже существующая проблема или только риск?',de:'Besteht bereits ein Problem oder handelt es sich nur um ein Risiko?',type:'choice',options:[{value:'problem',ru:'Проблема есть',de:'Problem besteht'},{value:'risk',ru:'Только риск',de:'Nur Risiko'}]},
      {id:'observed',ru:'Что конкретно наблюдается или что сообщает пациент?',de:'Was ist konkret beobachtbar bzw. was berichtet die Person?',type:'text'},
      {id:'cause',ru:'Какие известные причины или факторы относятся именно к этому пациенту?',de:'Welche bekannten Ursachen oder Faktoren treffen auf diese Person zu?',type:'text'},
      {id:'resource',ru:'Что пациент может делать самостоятельно?',de:'Was kann die Person selbstständig?',type:'text'},
      {id:'goal',ru:'Какой измеримый результат нужен?',de:'Welches messbare Ergebnis soll erreicht werden?',type:'text'},
      {id:'period',ru:'Когда оценить результат?',de:'Wann soll das Ergebnis beurteilt werden?',type:'text'}
    ]
  }
};

export function chooseInterviewBank({query='',title='',concepts=[]}={}){
  const ids=new Set((concepts||[]).map(x=>x.id||x));
  const hay=(query+' '+title).toLowerCase();
  if(ids.has('fall')||/sturz|пад|упаст/.test(hay))return 'fall';
  if(ids.has('skin-integrity')||/haut|кож|раздраж|wund|röt/.test(hay))return 'skin';
  if(ids.has('pain')||/schmerz|боль/.test(hay))return 'pain';
  if(ids.has('nutrition')||ids.has('swallowing')||/ernähr|глот|питан|еда/.test(hay))return 'nutrition';
  if(ids.has('breathing')||/atm|dyspn|одыш|дыш/.test(hay))return 'breathing';
  if(ids.has('cognition')||/demenz|delir|дезори|пута/.test(hay))return 'cognition';
  return 'generic';
}

export function getInterviewDefinition(input={}){
  const id=chooseInterviewBank(input);
  return {id,...INTERVIEW_BANKS[id]};
}
