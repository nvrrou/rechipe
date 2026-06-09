import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingItem = {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: string;
  precio: number;
  comprado: boolean;
};

const SHOPPING_LIST_KEY = 'rechipe:shopping-list';
const PREPARATION_SHOPPING_LIST_KEY = 'rechipe:preparation-shopping-list';

export const INITIAL_SHOPPING_ITEMS: ShoppingItem[] = [
  { id: '1', nombre: 'Arroz', categoria: 'Cereales', cantidad: '1 kg', precio: 1890, comprado: false },
  { id: '2', nombre: 'Tomate', categoria: 'Verduras', cantidad: '500 g', precio: 1200, comprado: false },
  { id: '3', nombre: 'Pollo', categoria: 'Carnes', cantidad: '1 unidad', precio: 4990, comprado: false },
  { id: '4', nombre: 'Leche', categoria: 'Lácteos', cantidad: '1 litro', precio: 1150, comprado: false },
  { id: '5', nombre: 'Pan', categoria: 'Panadería', cantidad: '1 bolsa', precio: 1800, comprado: false },
];

export function createShoppingItem(data: Omit<ShoppingItem, 'id' | 'comprado'>): ShoppingItem {
  return {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    comprado: false,
  };
}

export async function getShoppingItems() {
  const rawItems = await AsyncStorage.getItem(SHOPPING_LIST_KEY);
  if (!rawItems) {
    await saveShoppingItems(INITIAL_SHOPPING_ITEMS);
    return INITIAL_SHOPPING_ITEMS;
  }

  try {
    const parsed = JSON.parse(rawItems);
    return Array.isArray(parsed) ? (parsed as ShoppingItem[]) : INITIAL_SHOPPING_ITEMS;
  } catch {
    return INITIAL_SHOPPING_ITEMS;
  }
}

export async function saveShoppingItems(items: ShoppingItem[]) {
  await AsyncStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items));
}

export async function appendShoppingItems(items: ShoppingItem[]) {
  const currentItems = await getShoppingItems();
  const nextItems = [...currentItems, ...items];
  await saveShoppingItems(nextItems);
  return nextItems;
}

export async function getPreparationShoppingItems() {
  const rawItems = await AsyncStorage.getItem(PREPARATION_SHOPPING_LIST_KEY);
  if (!rawItems) return [];

  try {
    const parsed = JSON.parse(rawItems);
    return Array.isArray(parsed) ? (parsed as ShoppingItem[]) : [];
  } catch {
    return [];
  }
}

export async function savePreparationShoppingItems(items: ShoppingItem[]) {
  await AsyncStorage.setItem(PREPARATION_SHOPPING_LIST_KEY, JSON.stringify(items));
}
