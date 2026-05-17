import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { Text, View } from '@/components/Themed';

type ShoppingItem = {
  id: string;
  nombre: string;
  categoria: string;
  cantidad: string;
  precio: number;
  comprado: boolean;
};
//Prodcutos iniciales
const INITIAL_ITEMS: ShoppingItem[] = [
  { id: '1', nombre: 'Arroz',  categoria: 'Cereales',  cantidad: '1 kg',     precio: 1890, comprado: false },
  { id: '2', nombre: 'Tomate', categoria: 'Verduras',  cantidad: '500 g',    precio: 1200, comprado: false },
  { id: '3', nombre: 'Pollo',  categoria: 'Carnes',    cantidad: '1 unidad', precio: 4990, comprado: false },
  { id: '4', nombre: 'Leche',  categoria: 'Lácteos',   cantidad: '1 litro',  precio: 1150, comprado: false },
  { id: '5', nombre: 'Pan',    categoria: 'Panadería', cantidad: '1 bolsa',  precio: 1800, comprado: false },
];

//Id para los nuevos producto

let _nextId = 6;
function nextId() {
  return String(_nextId++);
}


function formatPrice(value: number) {
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}

export default function ShoppingListScreen() {
  const [items, setItems]   = useState<ShoppingItem[]>(INITIAL_ITEMS);
  const [search, setSearch] = useState('');

  // agregar producto
  const [nombre,    setNombre]    = useState('');
  const [categoria, setCategoria] = useState('');
  const [cantidad,  setCantidad]  = useState('');
  const [precioStr, setPrecioStr] = useState('');

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

  // --- acciones ---
  function toggleItem(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, comprado: !i.comprado } : i));
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }
  
  //Agregar producto
  function addItem() {
    const trimNombre = nombre.trim();
    if (!trimNombre) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del producto.');
      return;
    }
    const precio = parseFloat(precioStr.replace(',', '.')) || 0;
    const newItem: ShoppingItem = {
      id:        nextId(),
      nombre:    trimNombre,
      categoria: categoria.trim() || 'General',
      cantidad:  cantidad.trim()  || '1 unidad',
      precio,
      comprado:  false,
    };
    setItems(prev => [...prev, newItem]);
    setNombre('');
    setCategoria('');
    setCantidad('');
    setPrecioStr('');
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

        {/* Formulario agregar */}
        <View style={styles.addCard}>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder="Nombre"
            placeholderTextColor="#6B7280"
            style={styles.addInput}
          />
          <View style={styles.addRow}>
            <TextInput
              value={categoria}
              onChangeText={setCategoria}
              placeholder="Categoría"
              placeholderTextColor="#6B7280"
              style={[styles.addInput, styles.addInputFlex]}
            />
            <TextInput
              value={cantidad}
              onChangeText={setCantidad}
              placeholder="Cantidad"
              placeholderTextColor="#6B7280"
              style={[styles.addInput, styles.addInputFlex]}
            />
          </View>
          <TextInput
            value={precioStr}
            onChangeText={setPrecioStr}
            placeholder="Precio ($)"
            placeholderTextColor="#6B7280"
            keyboardType="numeric"
            style={styles.addInput}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addItem}>
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Agregar producto</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 5,
  },

  // Resumen
  summaryCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTextBox: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  summaryTotal: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 3,
  },
  summarySmall: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 3,
  },
  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#1F2937',
    borderRadius: 99,
    marginTop: 10,
    width: '80%',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#22C55E',
    borderRadius: 99,
  },

  // Búsqueda
  searchContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
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
    fontWeight: '700',
  },
  sectionCount: {
    color: '#9CA3AF',
    fontSize: 13,
  },

  // Items
  itemCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
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
    fontWeight: '700',
  },
  itemNameDone: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  itemDetail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 3,
  },
  priceBox: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priceText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty
  emptyBox: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 10,
  },

  // Agregar
  addCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 10,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  addInput: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 13,
  },
  addInputFlex: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});