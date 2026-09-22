const KEY='pflegebook-lang';
const dict={
  ru:{
    books:'Локальные книги',privacy:'PDF остаются на устройстве. Для перевода отправляется только текст выбранной страницы.',
    addNanda:'＋ Добавить NANDA PDF',addEnp:'＋ Добавить ENP PDF',demo:'Запустить демо',install:'Установка на iPhone',
    subtitle:'Быстрый локальный поиск по NANDA/ENP',noBooks:'Нет книг',welcomeTitle:'Диагноз → страница → Pflegeplan',
    welcomeText:'Добавь свои PDF или включи демо. Поиск выполняется локально на устройстве.',
    queryPlaceholder:'Например: боится встать и плохо ходит, риск падения, одышка…',search:'Найти',bookSearch:'Поиск по книгам',patientPlan:'Пациент / Pflegeplan',
    patients:'Пациенты',newPatient:'Новый пациент',backPatients:'К пациентам',editPatient:'Изменить',noPatient:'Без пациента',
    activePatient:'Активный пациент',alias:'Псевдоним',situation:'Ситуация / жалобы',createContinue:'Создать и подобрать варианты',
    save:'Сохранить',cancel:'Отмена',delete:'Удалить',open:'Открыть',continuePlan:'Продолжить Pflegeplan',
    patientHint:'Используй только условное имя/псевдоним, не настоящее имя пациента.',emptyPatients:'Сохранённых пациентов пока нет.',
    langButton:'DE',found:'Найдено',pages:'страниц',diagnoses:'диагнозов',searching:'Ищу…',
    copied:'Pflegeplan скопирован',chooseBooks:'Сначала добавь книги или включи демо',
    planAssistant:'Pflegeplan-Assistent',buildPlan:'Собрать конкретный Pflegeplan',copy:'Копировать',translate:'Перевести'
  },
  de:{
    books:'Lokale Bücher',privacy:'PDFs bleiben auf dem Gerät. Für die Übersetzung wird nur der Text der ausgewählten Seite gesendet.',
    addNanda:'＋ NANDA PDF hinzufügen',addEnp:'＋ ENP PDF hinzufügen',demo:'Demo starten',install:'Auf iPhone installieren',
    subtitle:'Schnelle lokale Suche in NANDA/ENP',noBooks:'Keine Bücher',welcomeTitle:'Diagnose → Seite → Pflegeplan',
    welcomeText:'Eigene PDFs hinzufügen oder Demo starten. Die Suche läuft lokal auf dem Gerät.',
    queryPlaceholder:'Zum Beispiel: hat Angst aufzustehen und geht schlecht, Sturzrisiko, Dyspnoe…',search:'Suchen',bookSearch:'Buchsuche',patientPlan:'Patient / Pflegeplan',
    patients:'Patienten',newPatient:'Neuer Patient',backPatients:'Zu Patienten',editPatient:'Bearbeiten',noPatient:'Kein Patient',
    activePatient:'Aktiver Patient',alias:'Pseudonym',situation:'Situation / Beschwerden',createContinue:'Anlegen und Varianten auswählen',
    save:'Speichern',cancel:'Abbrechen',delete:'Löschen',open:'Öffnen',continuePlan:'Pflegeplan fortsetzen',
    patientHint:'Nur Kürzel/Pseudonym verwenden, keinen echten Patientennamen.',emptyPatients:'Noch keine Patienten gespeichert.',
    langButton:'RU',found:'Gefunden',pages:'Seiten',diagnoses:'Diagnosen',searching:'Suche…',
    copied:'Pflegeplan kopiert',chooseBooks:'Zuerst Bücher hinzufügen oder Demo starten',
    planAssistant:'Pflegeplan-Assistent',buildPlan:'Konkreten Pflegeplan erstellen',copy:'Kopieren',translate:'Übersetzen'
  }
};

let lang=localStorage.getItem(KEY)==='de'?'de':'ru';

export function getLang(){return lang}
export function setLang(next){lang=next==='de'?'de':'ru';localStorage.setItem(KEY,lang);document.documentElement.lang=lang;return lang}
export function toggleLang(){return setLang(lang==='ru'?'de':'ru')}
export function t(key){return dict[lang]?.[key]??dict.ru[key]??key}
export function bi(ru,de){return lang==='de'?de:ru}

export function applyStaticI18n(root=document){
  root.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.getAttribute('data-i18n');el.textContent=t(k)});
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const k=el.getAttribute('data-i18n-placeholder');el.setAttribute('placeholder',t(k))});
  document.documentElement.lang=lang;
}
