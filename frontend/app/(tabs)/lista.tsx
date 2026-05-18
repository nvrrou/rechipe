import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import {
  INITIAL_SHOPPING_ITEMS,
  ShoppingItem,
  getShoppingItems,
  saveShoppingItems,
} from '@/services/shoppingList';

function formatPrice(value: number) {
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}

export default function ShoppingListScreen() {
  const [items, setItems]   = useState<ShoppingItem[]>(INITIAL_SHOPPING_ITEMS);
  const [search, setSearch] = useState('');
  const [replacementRequest, setReplacementRequest] = useState('');
  const [replacementMessage, setReplacementMessage] = useState('');

  // Buscar productos por nombre
  const filteredItems = useMemo(
    () => items.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  // Calcular pendiente
  const totalPendiente = useMemo(
    () => items.filter(i => !i.comprado).reduce((s, i) => s + i.precio, 0),
    [items],
  );

  const totalComprado = useMemo(() => items.filter(i => i.comprado).length, [items]);

  const progreso = items.length ? Math.round((totalComprado / items.length) * 100) : 0;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      getShoppingItems().then((storedItems) => {
        if (isActive) setItems(storedItems);
      });

      return () => {
        isActive = false;
      };
    }, [])
  );

  function persistItems(nextItems: ShoppingItem[]) {
    setItems(nextItems);
    saveShoppingItems(nextItems);
  }

  // --- acciones ---
  function toggleItem(id: string) {
    persistItems(items.map(i => i.id === id ? { ...i, comprado: !i.comprado } : i));
  }

  function deleteItem(id: string) {
    persistItems(items.filter(i => i.id !== id));
  }
  
  function requestReplacements() {
    const query = replacementRequest.trim();
    if (!query) {
      setReplacementMessage('Escribe qué producto quieres reemplazar.');
      return;
    }

    setReplacementMessage(`Solicitud guardada para buscar reemplazos de "${query}".`);
    setReplacementRequest('');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Encabezado */}
        <View style={styles.header}>
          <Text style={styles.title}>Lista de compras</Text>
          <Text style={styles.subtitle}>Organiza los productos que necesitas comprar.</Text>
        </View>

        {/* Tarjeta resumen */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryLabel}>Total pendiente</Text>
            <Text style={styles.summaryTotal}>{formatPrice(totalPendiente)}</Text>
            <Text style={styles.summarySmall}>
              {totalComprado} de {items.length} productos comprados
            </Text>
            {/* Barra de progreso */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progreso}%` as any }]} />
            </View>
          </View>
          <View style={styles.summaryIcon}>
            <MaterialCommunityIcons name="cart-outline" size={28} color="#FFFFFF" />
          </View>
        </View>

        {/* Búsqueda */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar producto"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
          />
        </View>

        {/* Encabezado sección */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Productos</Text>
          <Text style={styles.sectionCount}>{filteredItems.length} ítems</Text>
        </View>

        {/* Lista */}
        {filteredItems.map(item => (
          <Pressable
            key={item.id}
            style={[styles.itemCard, item.comprado && styles.itemCardDone]}
            onPress={() => toggleItem(item.id)}
          >
            <MaterialCommunityIcons
              name={item.comprado ? 'check-circle' : 'checkbox-blank-circle-outline'}
              size={26}
              color={item.comprado ? '#22C55E' : '#9CA3AF'}
            />

            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, item.comprado && styles.itemNameDone]}>
                {item.nombre}
              </Text>
              <Text style={styles.itemDetail}>{item.categoria} · {item.cantidad}</Text>
            </View>

            <View style={styles.priceBox}>
              <Text style={styles.priceText}>{formatPrice(item.precio)}</Text>
            </View>

            {/* Eliminar */}
            <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={8}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#4B5563" />
            </TouchableOpacity>
          </Pressable>
        ))}

        {filteredItems.length === 0 && (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="basket-off-outline" size={40} color="#6B7280" />
            <Text style={styles.emptyText}>No se encontraron productos.</Text>
          </View>
        )}

        {/* Reemplazos */}
        <View style={styles.replacementCard}>
          <View style={styles.replacementHeader}>
            <View style={styles.replacementIcon}>
              <MaterialCommunityIcons name="swap-horizontal" size={22} color="#4ADE80" />
            </View>
            <View style={styles.replacementCopy}>
              <Text style={styles.replacementTitle}>Solicitar reemplazos</Text>
              <Text style={styles.replacementSubtitle}>Pide alternativas si algo está caro o no lo encuentras.</Text>
            </View>
          </View>
          <TextInput
            value={replacementRequest}
            onChangeText={(value) => {
              setReplacementRequest(value);
              setReplacementMessage('');
            }}
            placeholder="Ej: reemplazar pollo por algo más barato"
            placeholderTextColor="#6B7280"
            style={styles.replacementInput}
          />
          {replacementMessage !== '' && <Text style={styles.replacementMessage}>{replacementMessage}</Text>}
          <Pressable accessibilityRole="button" style={styles.replacementButton} onPress={requestReplacements}>
            <MaterialCommunityIcons name="creation" size={18} color="#0B0B0B" />
            <Text style={styles.replacementButtonText}>Solicitar reemplazos</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  header: {
    backgroundColor: 'transparent',
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#B8B8B8',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },

  // Resumen
  summaryCard: {
    backgroundColor: '#171717',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTextBox: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  summaryLabel: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryTotal: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 3,
  },
  summarySmall: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 99,
    marginTop: 10,
    width: '80%',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#22C55E',
    borderRadius: 99,
  },

  // Búsqueda
  searchContainer: {
    backgroundColor: '#171717',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },

  // Sección
  sectionHeader: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
  },

  // Items
  itemCard: {
    backgroundColor: '#171717',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemCardDone: {
    opacity: 0.5,
  },
  itemInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  itemNameDone: {
    color: '#B8B8B8',
    textDecorationLine: 'line-through',
  },
  itemDetail: {
    color: '#B8B8B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  priceBox: {
    backgroundColor: '#163321',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#235D38',
  },
  priceText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '900',
  },

  // Empty
  emptyBox: {
    backgroundColor: '#171717',
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },

  // Reemplazos
  replacementButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  replacementButtonText: {
    color: '#0B0B0B',
    fontSize: 14,
    fontWeight: '900',
  },
  replacementCard: {
    backgroundColor: '#171717',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 10,
  },
  replacementCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  replacementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  replacementIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#102017',
  },
  replacementInput: {
    minHeight: 52,
    backgroundColor: '#101010',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  replacementMessage: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
  },
  replacementSubtitle: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '700',
  },
  replacementTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
