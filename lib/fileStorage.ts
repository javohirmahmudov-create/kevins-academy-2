// IndexedDB for large file storage

const DB_NAME = 'kevins_academy_files';
const DB_VERSION = 1;
const STORE_NAME = 'materials';

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initFileDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save file to IndexedDB
export async function saveFile(id: string, file: File): Promise<string> {
  const database = await initFileDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const fileData = {
      id,
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      savedAt: new Date().toISOString()
    };

    const request = store.put(fileData);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
  });
}

// Get file from IndexedDB
export async function getFile(id: string): Promise<File | null> {
  const database = await initFileDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.file : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Delete file from IndexedDB
export async function deleteFile(id: string): Promise<void> {
  const database = await initFileDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all files
export async function getAllFiles(): Promise<any[]> {
  const database = await initFileDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
