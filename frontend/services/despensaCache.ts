// Caché local para la despensa — permite ver los datos sin conexión
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DespensaItemData } from './despensa';

const DESPENSA_CACHE_KEY = 'rechipe:despensa-cache';
const DESPENSA_CACHE_TS_KEY = 'rechipe:despensa-cache-ts';

/** Guarda los items de la despensa en el caché local */
export async function saveDespensaCache(userId: string, items: DespensaItemData[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${DESPENSA_CACHE_KEY}:${userId}`, JSON.stringify(items));
    await AsyncStorage.setItem(`${DESPENSA_CACHE_TS_KEY}:${userId}`, new Date().toISOString());
  } catch {
    // Silenciar errores de caché — no son críticos
  }
}

/** Lee los items de la despensa desde el caché local */
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

/** Retorna la fecha de la última vez que se guardó el caché */
export async function getDespensaCacheTimestamp(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`${DESPENSA_CACHE_TS_KEY}:${userId}`);
  } catch {
    return null;
  }
}
