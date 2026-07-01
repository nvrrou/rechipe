// Cache local para la despensa: permite ver los datos sin conexion.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DespensaItemData } from './despensa';

const DESPENSA_CACHE_KEY = 'rechipe:despensa-cache';
const DESPENSA_CACHE_TS_KEY = 'rechipe:despensa-cache-ts';

/** Guarda los items de la despensa en el cache local. */
export async function saveDespensaCache(userId: string, items: DespensaItemData[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DESPENSA_CACHE_KEY}:${userId}`, JSON.stringify(items));
    await AsyncStorage.setItem(`${DESPENSA_CACHE_TS_KEY}:${userId}`, new Date().toISOString());
  } catch {
    // Silenciar errores de cache: no son criticos.
  }
}

/** Lee los items de la despensa desde el cache local. */
export async function loadDespensaCache(userId: string): Promise<DespensaItemData[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DESPENSA_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DespensaItemData[]) : null;
  } catch {
    return null;
  }
}

/** Retorna la fecha de la ultima vez que se guardo el cache. */
export async function getDespensaCacheTimestamp(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`${DESPENSA_CACHE_TS_KEY}:${userId}`);
  } catch {
    return null;
  }
}
