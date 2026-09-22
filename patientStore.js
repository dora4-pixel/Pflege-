const DB='pflegebuch-static';
const VERSION=2;
const STORE='patients';

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('books'))db.createObjectStore('books',{keyPath:'kind'});
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}

export async function listPatients(){
  const db=await openDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).getAll();
      req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)));
      req.onerror=()=>reject(req.error);
    });
  }finally{db.close()}
}

export async function getPatient(id){
  if(!id)return null;
  const db=await openDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }finally{db.close()}
}

export async function savePatient(patient){
  const now=Date.now();
  const value={...patient,id:patient.id||crypto.randomUUID(),createdAt:patient.createdAt||now,updatedAt:now};
  const db=await openDb();
  try{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(value);
    await txDone(tx);
    return value;
  }finally{db.close()}
}

export async function deletePatient(id){
  const db=await openDb();
  try{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    await txDone(tx);
  }finally{db.close()}
}

export function getActivePatientId(){return localStorage.getItem('pflegebook-active-patient')||''}
export function setActivePatientId(id){
  if(id)localStorage.setItem('pflegebook-active-patient',id);
  else localStorage.removeItem('pflegebook-active-patient');
}
