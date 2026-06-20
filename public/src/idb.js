/* Shared IndexedDB handle — one version for all modules (recordings + community audio). */

const DB_NAME = "talkboard";
const DB_VERSION = 4;

let db = null;
let openPromise = null;

export function openTalkBoardDB() {
  if (db) return Promise.resolve(db);
  if (openPromise) return openPromise;
  openPromise = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("recordings")) d.createObjectStore("recordings");
      if (!d.objectStoreNames.contains("community_audio")) d.createObjectStore("community_audio");
    };
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = e => { openPromise = null; rej(e); };
    r.onblocked = () => {
      console.warn("[Talk Board] IndexedDB upgrade blocked — close other tabs using this app.");
    };
  });
  return openPromise;
}
