import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { API_URL } from './api';

//TIPOS
export type SyncOperation = {
  id: string;
  type: 'toggle_comprado' | 'delete_item' | 'add_item';
  itemId: string;
  payload?: any;
  timestamp: number;
};

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

type SyncListener = (status: SyncStatus, message?: string) => void;

//CONSTANTES
const SYNC_QUEUE_KEY = 'rechipe:sync-queue';
const LAST_SYNC_KEY = 'rechipe:last-sync';

//Estado interno
let isConnected = true;
let currentStatus: SyncStatus = 'idle';
const listeners = new Set<SyncListener>();
let unsubscribeNetInfo: (() => void) | null = null;

//LISTENERS
export function addSyncListener(listener: SyncListener): () => void {
  listeners.add(listener);
  listener(currentStatus); //enviar estado actual inmediatamentes
  return () => listeners.delete(listener);
}

function notifyListeners(status: SyncStatus, message?: string) {
  currentStatus = status;
  for (const listener of listeners) {
    listener(status, message);
  }
}

//COLA DE SINCRONIZACION

//Encuela una operacion para sincronizar cuando haya conexión
export async function queueSync(operation: Omit<SyncOperation, 'id' | 'timestamp'>): Promise<void> {
  const queue = await getPendingSyncs();

  const newOp: SyncOperation = {
    ...operation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };

  // si ya hay una operación toggle para el mismo item, las cancelamos mutuamente
  if (operation.type === 'toggle_comprado') {
    const existingIndex = queue.findIndex(
      (op) => op.type === 'toggle_comprado' && op.itemId === operation.itemId
    );
    if (existingIndex !== -1) {
      queue.splice(existingIndex, 1);
      await saveSyncQueue(queue);
      return;
    }
  }

  //Si hay un delete para un item, eliminar operaciones previas del mismo item
  if (operation.type === 'delete_item') {
    const filtered = queue.filter((op) => op.itemId !== operation.itemId);
    filtered.push(newOp);
    await saveSyncQueue(filtered);
    return;
  }

  queue.push(newOp);
  await saveSyncQueue(queue);
}

//Obtiene las operaciones pendientes de sincronización
export async function getPendingSyncs(): Promise<SyncOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

//Limpia la cola de sincronización
export async function clearPendingSyncs(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

async function saveSyncQueue(queue: SyncOperation[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

//SINCRONIZACION

//Intenta sincronizar las operaciones pendientes con el backend
export async function syncPendingOperations(): Promise<{ success: boolean; synced: number; errors: number }> {
  const queue = await getPendingSyncs();

  if (queue.length === 0) {
    return { success: true, synced: 0, errors: 0 };
  }

  notifyListeners('syncing', `Sincronizando ${queue.length} cambios...`);

  let synced = 0;
  let errors = 0;
  const remainingOps: SyncOperation[] = [];

  for (const operation of queue) {
    try {
      const success = await executeSyncOperation(operation);
      if (success) {
        synced++;
      } else {
        errors++;
        remainingOps.push(operation);
      }
    } catch {
      errors++;
      remainingOps.push(operation);
    }
  }

  await saveSyncQueue(remainingOps);

  if (synced > 0) {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  if (errors === 0) {
    notifyListeners('synced', `${synced} cambios sincronizados`);
  } else {
    notifyListeners('error', `${synced} sincronizados, ${errors} con error`);
  }

  return { success: errors === 0, synced, errors };
}

async function executeSyncOperation(operation: SyncOperation): Promise<boolean> {
  try {
    // Por ahora, la lista de compras es local. Cuando se conecte al backend,
    // se harán las llamadas API aquí.
    // Para el MVP, simplemente marcamos como exitoso ya que los datos ya están en AsyncStorage.
    return true;
  } catch {
    return false;
  }
}

//MONITOR DE CONEXIÓN

//Inicia el monitoreo de conexión a internet
export function startConnectionMonitor(): () => void {
  if (unsubscribeNetInfo) return unsubscribeNetInfo;

  unsubscribeNetInfo = NetInfo.addEventListener(handleConnectionChange);

  //verificar estado inicial
  NetInfo.fetch().then(handleConnectionChange);

  return () => {
    if (unsubscribeNetInfo) {
      unsubscribeNetInfo();
      unsubscribeNetInfo = null;
    }
  };
}

async function handleConnectionChange(state: NetInfoState): Promise<void> {
  const wasConnected = isConnected;
  isConnected = !!state.isConnected && !!state.isInternetReachable;

  if (!isConnected) {
    notifyListeners('offline');
    return;
  }

  //Si acabamos de recuperar conexión, intentar sincronizar
  if (!wasConnected && isConnected) {
    const queue = await getPendingSyncs();
    if (queue.length > 0) {
      await syncPendingOperations();
    } else {
      notifyListeners('idle');
    }
  } else if (currentStatus === 'offline') {
    notifyListeners('idle');
  }
}

//Retorna si hay conexión a internet
export function getIsConnected(): boolean {
  return isConnected;
}

//Retorna la cantidad de operaciones pendientes
export async function getPendingCount(): Promise<number> {
  const queue = await getPendingSyncs();
  return queue.length;
}

//Retorna la fecha de última sincronización
export async function getLastSyncDate(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}
