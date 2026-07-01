import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { useThemePreference } from '@/contexts/ThemeContext';
import {
  INITIAL_SHOPPING_ITEMS,
  ShoppingItem,
  getPreparationShoppingItems,
  getShoppingItems,
  savePreparationShoppingItems,
  saveShoppingItems,
} from '@/services/shoppingList';
import {
  addSyncListener,
  queueSync,
  startConnectionMonitor,
  getIsConnected,
} from '@/services/syncService';

function formatPrice(value: number) {
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}

type PrepSurface = 'preparacion' | 'lista';

export default function ShoppingListScreen() {
  const router = useRouter();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ modo?: string }>();
  const isPreparationList = params.modo === 'preparacion';
  const [items, setItems] = useState<ShoppingItem[]>(isPreparationList ? [] : INITIAL_SHOPPING_ITEMS);
  const [search, setSearch] = useState('');
  const [replacementRequest, setReplacementRequest] = useState('');
  const [replacementMessage, setReplacementMessage] = useState('');
  const [bridgeTarget, setBridgeTarget] = useState<PrepSurface>('lista');
  const [bridgeWidth, setBridgeWidth] = useState(0);
  const bridgePillAnim = useRef(new Animated.Value(1)).current;
  const surfaceTransition = useRef(new Animated.Value(0)).current;

  // HU-12: Estado de conexión y sincronizacion
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error' | 'offline'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  //HU-12: Monitorear conexión e iniciar sincronizacion automatica
  useEffect(() => {
    const stopMonitor = startConnectionMonitor();
    const removeSyncListener = addSyncListener((status, message) => {
      setSyncStatus(status);
      setSyncMessage(message || '');

      //Limpiar mensaje de sincronizado despues de 3 segundos
      if (status === 'synced') {
        setTimeout(() => {
          setSyncStatus('idle');
          setSyncMessage('');
        }, 3000);
      }
    });

    return () => {
      stopMonitor();
      removeSyncListener();
    };
  }, []);

  //Buscar productos por nombre
  const filteredItems = useMemo(
    () => items.filter(i => i.nombre.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  //Calcular pendiente
  const totalPendiente = useMemo(
    () => items.filter(i => !i.comprado).reduce((s, i) => s + i.precio, 0),
    [items],
  );

  const totalComprado = useMemo(() => items.filter(i => i.comprado).length, [items]);

  const progreso = items.length ? Math.round((totalComprado / items.length) * 100) : 0;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loader = isPreparationList ? getPreparationShoppingItems : getShoppingItems;
      loader().then((storedItems) => {
        if (isActive) setItems(storedItems);
      });

      return () => {
        isActive = false;
      };
    }, [isPreparationList])
  );

  useEffect(() => {
    Animated.spring(surfaceTransition, {
      toValue: 1,
      damping: 16,
      mass: 0.75,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  }, [surfaceTransition]);

  function persistItems(nextItems: ShoppingItem[]) {
    setItems(nextItems);
    if (isPreparationList) {
      savePreparationShoppingItems(nextItems);
      return;
    }
    saveShoppingItems(nextItems);
  }








  //ACCIONES
  function toggleItem(id: string) {
    persistItems(items.map(i => i.id === id ? { ...i, comprado: !i.comprado } : i));
    //Encolar para sincronizacion si está offline
    if (!getIsConnected()) {
      queueSync({ type: 'toggle_comprado', itemId: id });
    }
  }

  function deleteItem(id: string) {
    persistItems(items.filter(i => i.id !== id));
    //Encolar para sincronizacion si está offline
    if (!getIsConnected()) {
      queueSync({ type: 'delete_item', itemId: id });
    }
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

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(isPreparationList ? '/(navbarnt)/preparacion' : '/(tabs)');
  }

  function switchPreparationSurface(target: PrepSurface) {
    if (!isPreparationList || target === 'lista') return;

    setBridgeTarget(target);
    Animated.spring(bridgePillAnim, {
      toValue: 0,
      damping: 18,
      mass: 0.7,
      stiffness: 190,
      useNativeDriver: true,
    }).start();

    Animated.timing(surfaceTransition, {
      toValue: 0,
      duration: 150,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(navbarnt)/preparacion');
    });
  }

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Encabezado */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={goBack} style={[styles.backButton, isDark && styles.cardDark]}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={isDark ? '#EAFBF0' : '#064E2F'} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{isPreparationList ? 'Lista de preparación' : 'Lista de compras'}</Text>
            <Text style={styles.subtitle}>
              {isPreparationList
                ? 'Ingredientes faltantes para preparar la receta elegida.'
                : 'Organiza los productos que necesitas comprar.'}
            </Text>
          </View>
        </View>

        {/* HU-12: Banner de estado de conexión */}
        {syncStatus !== 'idle' && (
          <View style={[
            styles.syncBanner,
            syncStatus === 'offline' && styles.syncBannerOffline,
            syncStatus === 'syncing' && styles.syncBannerSyncing,
            syncStatus === 'synced' && styles.syncBannerSynced,
            syncStatus === 'error' && styles.syncBannerError,
          ]}>
            <MaterialCommunityIcons
              name={
                syncStatus === 'offline' ? 'wifi-off' :
                  syncStatus === 'syncing' ? 'cloud-sync-outline' :
                    syncStatus === 'synced' ? 'cloud-check-outline' :
                      'cloud-alert'
              }
              size={18}
              color={
                syncStatus === 'offline' ? '#EA580C' :
                  syncStatus === 'syncing' ? '#0369A1' :
                    syncStatus === 'synced' ? '#16A34A' :
                      '#DC2626'
              }
            />
            <Text style={[
              styles.syncBannerText,
              syncStatus === 'offline' && styles.syncBannerTextOffline,
              syncStatus === 'syncing' && styles.syncBannerTextSyncing,
              syncStatus === 'synced' && styles.syncBannerTextSynced,
              syncStatus === 'error' && styles.syncBannerTextError,
            ]}>
              {syncStatus === 'offline' ? 'Sin conexión — Los cambios se guardan localmente' :
                syncStatus === 'syncing' ? syncMessage || 'Sincronizando...' :
                  syncStatus === 'synced' ? syncMessage || 'Datos sincronizados' :
                    syncMessage || 'Error al sincronizar'}
            </Text>
          </View>
        )}

        {isPreparationList && (
          <View
            onLayout={(event) => setBridgeWidth(event.nativeEvent.layout.width)}
            style={[styles.topBridge, isDark && styles.panelDark]}>
            {bridgeWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.bridgeSlidingPill,
                  {
                    width: (bridgeWidth - 12 - 8) / 2,
                    transform: [
                      {
                        translateX: bridgePillAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 6 + (bridgeWidth - 12 - 8) / 2 + 8],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
            <Pressable accessibilityRole="button" onPress={() => switchPreparationSurface('preparacion')} style={styles.bridgeButton}>
              <MaterialCommunityIcons name="chef-hat" size={18} color={bridgeTarget === 'preparacion' ? '#FBFFF8' : isDark ? '#BDF7D2' : '#064E2F'} />
              <Text style={[styles.bridgeButtonText, bridgeTarget === 'preparacion' && styles.bridgeButtonTextActive]}>Preparación</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.bridgeButton}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={18} color={bridgeTarget === 'lista' ? '#FBFFF8' : isDark ? '#BDF7D2' : '#064E2F'} />
              <Text style={[styles.bridgeButtonText, bridgeTarget === 'lista' && styles.bridgeButtonTextActive]}>Lista de compras</Text>
            </Pressable>
          </View>
        )}

        <Animated.View
          style={[
            styles.surfaceContent,
            {
              opacity: surfaceTransition,
              transform: [
                {
                  translateX: surfaceTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [32, 0],
                  }),
                },
                {
                  scale: surfaceTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}>

        {/* Tarjeta resumen */}
        <View style={[styles.summaryCard, isDark && styles.panelDark]}>
          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryLabel}>{isPreparationList ? 'Faltantes pendientes' : 'Total pendiente'}</Text>
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
            <MaterialCommunityIcons name="cart-outline" size={28} color="#064E2F" />
          </View>
        </View>

        {/* Búsqueda */}
        <View style={[styles.searchContainer, isDark && styles.cardDark]}>
          <MaterialCommunityIcons name="magnify" size={20} color={isDark ? '#BDF7D2' : '#2F7A4F'} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar producto"
            placeholderTextColor="#43A66C"
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
            style={[styles.itemCard, isDark && styles.cardDark, item.comprado && styles.itemCardDone]}
            onPress={() => toggleItem(item.id)}
          >
            <MaterialCommunityIcons
              name={item.comprado ? 'check-circle' : 'checkbox-blank-circle-outline'}
              size={26}
              color={item.comprado ? '#00B86B' : isDark ? '#BDF7D2' : '#2F7A4F'}
            />

            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, item.comprado && styles.itemNameDone]}>
                {item.nombre}
              </Text>
              <Text style={styles.itemDetail}>
                {[item.categoria, item.cantidad, item.supermercado_nombre].filter(Boolean).join(' · ')}
              </Text>
            </View>

            <View style={[styles.priceBox, isDark && styles.priceBoxDark]}>
              <Text style={styles.priceText}>{formatPrice(item.precio)}</Text>
            </View>

            {/* Eliminar */}
            <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={8}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color={isDark ? '#CBD5E1' : '#4B5563'} />
            </TouchableOpacity>
          </Pressable>
        ))}

        {filteredItems.length === 0 && (
          <View style={[styles.emptyBox, isDark && styles.panelDark]}>
            <MaterialCommunityIcons name="basket-off-outline" size={40} color="#43A66C" />
            <Text style={styles.emptyText}>No se encontraron productos.</Text>
          </View>
        )}

        {/* Reemplazos */}
        {!isPreparationList && <View style={[styles.replacementCard, isDark && styles.panelDark]}>
          <View style={styles.replacementHeader}>
            <View style={[styles.replacementIcon, isDark && styles.cardDark]}>
              <MaterialCommunityIcons name="swap-horizontal" size={22} color={isDark ? '#20D684' : '#00B86B'} />
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
            placeholderTextColor="#43A66C"
            style={[styles.replacementInput, isDark && styles.cardDark]}
          />
          {replacementMessage !== '' && <Text style={styles.replacementMessage}>{replacementMessage}</Text>}
          <Pressable accessibilityRole="button" style={styles.replacementButton} onPress={requestReplacements}>
            <MaterialCommunityIcons name="creation" size={18} color="#FBFFF8" />
            <Text style={styles.replacementButtonText}>Solicitar reemplazos</Text>
          </Pressable>
        </View>}

        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  containerDark: {
    backgroundColor: '#07130D',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 140,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 2,
  },
  bridgeButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  bridgeButtonActive: {
    backgroundColor: '#00B86B',
  },
  bridgeSlidingPill: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    borderRadius: 15,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 2,
  },
  bridgeButtonText: {
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '900',
  },
  bridgeButtonTextActive: {
    color: '#FBFFF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    marginBottom: 18,
  },
  headerCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  title: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  topBridge: {
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    marginBottom: 16,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    overflow: 'hidden',
    position: 'relative',
  },
  surfaceContent: {
    backgroundColor: 'transparent',
  },
  panelDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
    shadowColor: '#000000',
  },
  cardDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#173321',
  },

  // Resumen
  summaryCard: {
    backgroundColor: '#E9FBEF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTextBox: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  summaryLabel: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryTotal: {
    color: '#064E2F',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 3,
  },
  summarySmall: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#00B86B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#9FE7B9',
    borderRadius: 99,
    marginTop: 10,
    width: '80%',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#00B86B',
    borderRadius: 99,
  },

  // Búsqueda
  searchContainer: {
    backgroundColor: '#E9FBEF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    color: '#064E2F',
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
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionCount: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },

  // Items
  itemCard: {
    backgroundColor: '#E9FBEF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#9FE7B9',
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
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  itemNameDone: {
    color: '#2F7A4F',
    textDecorationLine: 'line-through',
  },
  itemDetail: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  priceBox: {
    backgroundColor: '#D8FBE3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#74D997',
  },
  priceBoxDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  priceText: {
    color: '#00B86B',
    fontSize: 12,
    fontWeight: '900',
  },

  // Empty
  emptyBox: {
    backgroundColor: '#E9FBEF',
    borderRadius: 18,
    padding: 28,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },

  // Reemplazos
  replacementButton: {
    backgroundColor: '#00B86B',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  replacementButtonText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  replacementCard: {
    backgroundColor: '#E9FBEF',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
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
    backgroundColor: '#D8FBE3',
  },
  replacementInput: {
    minHeight: 52,
    backgroundColor: '#DDF8E7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '700',
  },
  replacementMessage: {
    color: '#00B86B',
    fontSize: 13,
    fontWeight: '800',
  },
  replacementSubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  replacementTitle: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },










  //estilos del banner de sincronizacion
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  syncBannerOffline: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  syncBannerSyncing: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  syncBannerSynced: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  syncBannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  syncBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  syncBannerTextOffline: {
    color: '#EA580C',
  },
  syncBannerTextSyncing: {
    color: '#0369A1',
  },
  syncBannerTextSynced: {
    color: '#16A34A',
  },
  syncBannerTextError: {
    color: '#DC2626',
  },
});
