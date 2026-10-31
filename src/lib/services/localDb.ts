/**
 * Native IndexedDB Key-Value Storage with localStorage fallback.
 * Persists user state (layer visibility, map extent, basemap, preferences) locally.
 */

const DB_NAME = 'smap_local_db'
const DB_VERSION = 1
const STORE_NAME = 'user_state'

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'))
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function localDbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb()
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(`smap_idb_${key}`)
        return item ? JSON.parse(item) : undefined
      } catch {
        return undefined
      }
    }
    return undefined
  }
}

export async function localDbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`smap_idb_${key}`, JSON.stringify(value))
      } catch {
        // ignore
      }
    }
  }
}

export async function localDbDelete(key: string): Promise<void> {
  try {
    const db = await getDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`smap_idb_${key}`)
      } catch {
        // ignore
      }
    }
  }
}
