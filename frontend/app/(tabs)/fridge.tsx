import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import WheelPickerExpo from 'react-native-wheel-picker-expo';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import {
  CatalogProductData,
  DespensaAddData,
  DespensaItemData,
  DespensaUpdateData,
  SupermarketData,
  actualizarIngrediente,
  agregarIngrediente,
  agregarIngredientePorCodigo,
  buscarIngredientes,
  eliminarIngrediente,
  fetchCatalogProductSuggestions,
  fetchDespensa,
  fetchPrecioPorCatalogo,
  fetchSupermarkets,
  solicitarAutenticacionProducto,
  verificarCategoriaProducto,
} from '@/services/despensa';
import { loadDespensaCache, saveDespensaCache } from '@/services/despensaCache';
import {
  getExpiryStatus,
  getExpiryLabel,
  scheduleExpiryNotifications,
} from '@/services/notificaciones';

type ActiveView = 'categories' | 'category' | 'add' | 'search' | 'edit' | 'nutrition';
type FormMode = 'add' | 'edit';

type CategoryDef = {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

type IngredientFormState = {
  producto_catalogo_id: string;
  nombre_producto: string;
  categoria: string;
  newCategoria: string;
  codigo_barra: string;
  marca: string;
  imagen_url: string;
  cantidad: string;
  unidad: string;
  precio_aprox: string;
  cantidad_precio: string;
  unidad_precio: string;
  supermercado_id: string;
  precio_supermercado: string;
  precio_unidad: string;
  fecha_vencimiento: string;
  energia_kcal: string;
  proteinas_g: string;
  carbohidratos_g: string;
  grasas_g: string;
  fibra_g: string;
  sodio_mg: string;
  azucar_g: string;
};

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'carnes', name: 'Carnes', icon: 'food-steak', color: '#BE123C' },
  { id: 'vegetales', name: 'Vegetales', icon: 'carrot', color: '#16A34A' },
  { id: 'frutas', name: 'Frutas', icon: 'fruit-cherries', color: '#DC2626' },
  { id: 'legumbres', name: 'Legumbres', icon: 'seed-outline', color: '#A16207' },
  { id: 'mariscos', name: 'Mariscos', icon: 'waves', color: '#0891B2' },
  { id: 'pescado', name: 'Pescado', icon: 'fish', color: '#2563EB' },
  { id: 'aderezos', name: 'Aderezos', icon: 'bottle-tonic-outline', color: '#F97316' },
  { id: 'cereales', name: 'Cereales', icon: 'barley', color: '#CA8A04' },
  { id: 'lacteos', name: 'Lácteos', icon: 'cup', color: '#7C3AED' },
  { id: 'jugos', name: 'Jugos', icon: 'cup-water', color: '#EA580C' },
  { id: 'bebidas', name: 'Bebidas', icon: 'bottle-soda-classic-outline', color: '#0284C7' },
  { id: 'otros', name: 'Otros', icon: 'dots-horizontal', color: '#6B7280' },
];

const UNIT_OPTIONS = ['unidad', 'g', 'kg', 'ml', 'l', 'taza', 'cda'];
const CATALOG_SUGGESTION_LIMIT = 5;

const EMPTY_FORM: IngredientFormState = {
  producto_catalogo_id: '',
  nombre_producto: '',
  categoria: DEFAULT_CATEGORIES[0].id,
  newCategoria: '',
  codigo_barra: '',
  marca: '',
  imagen_url: '',
  cantidad: '',
  unidad: '',
  precio_aprox: '',
  cantidad_precio: '',
  unidad_precio: '',
  supermercado_id: '',
  precio_supermercado: '',
  precio_unidad: '',
  fecha_vencimiento: '',
  energia_kcal: '',
  proteinas_g: '',
  carbohidratos_g: '',
  grasas_g: '',
  fibra_g: '',
  sodio_mg: '',
  azucar_g: '',
};

const NUTRIENT_FIELDS: Array<{
  key: keyof IngredientFormState;
  label: string;
  unit: string;
  itemKey: keyof DespensaItemData;
}> = [
    { key: 'energia_kcal', label: 'Energía', unit: 'kcal', itemKey: 'energia_kcal' },
    { key: 'proteinas_g', label: 'Proteínas', unit: 'g', itemKey: 'proteinas_g' },
    { key: 'carbohidratos_g', label: 'Carbohidratos', unit: 'g', itemKey: 'carbohidratos_g' },
    { key: 'grasas_g', label: 'Grasas', unit: 'g', itemKey: 'grasas_g' },
    { key: 'fibra_g', label: 'Fibra', unit: 'g', itemKey: 'fibra_g' },
    { key: 'sodio_mg', label: 'Sodio', unit: 'mg', itemKey: 'sodio_mg' },
    { key: 'azucar_g', label: 'Azúcar', unit: 'g', itemKey: 'azucar_g' },
  ];

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'otros';
}

function titleize(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPlaceholderUri(name: string) {
  const label = encodeURIComponent(name.trim().slice(0, 2).toUpperCase() || 'IN');
  return `https://placehold.co/96x96/2a2a2a/ffffff/png?text=${label}`;
}

function numberToInput(value?: number | null) {
  if (value === undefined || value === null) return '';
  return String(value).replace('.', ',');
}

function parseInputNumber(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPrice(value?: number | null) {
  if (value === undefined || value === null) return '-';
  return `CLP ${Math.round(value).toLocaleString('es-CL')}`;
}

function getDisplayPrice(item: DespensaItemData) {
  return item.precio_supermercado ?? item.precio_aprox;
}

async function hydratePricesByCatalogId(items: DespensaItemData[]) {
  return Promise.all(
    items.map(async (item) => {
      if (item.precio_supermercado !== undefined && item.precio_supermercado !== null) return item;
      if (!item.producto_catalogo_id) return item;

      const result = await fetchPrecioPorCatalogo(item.producto_catalogo_id);
      if (result.error || result.precio === undefined || result.precio === null) return item;

      return {
        ...item,
        precio_supermercado: result.precio,
        precio_unidad: result.unidad || item.precio_unidad,
        supermercado_id: result.supermercado_id || item.supermercado_id,
        supermercado_nombre: result.supermercado_nombre || item.supermercado_nombre,
      };
    })
  );
}

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatQuantityValue(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

function getQuantityPickerValues(unit?: string) {
  const normalizedUnit = (unit || 'unidad').trim().toLowerCase();
  if (['g', 'ml'].includes(normalizedUnit)) {
    return Array.from({ length: 40 }, (_, index) => (index + 1) * 50);
  }
  if (['kg', 'l'].includes(normalizedUnit)) {
    return Array.from({ length: 40 }, (_, index) => Number(((index + 1) * 0.25).toFixed(2)));
  }
  if (['taza', 'cda'].includes(normalizedUnit)) {
    return Array.from({ length: 24 }, (_, index) => Number(((index + 1) * 0.5).toFixed(1)));
  }
  return Array.from({ length: 30 }, (_, index) => index + 1);
}

function formFromItem(item: DespensaItemData): IngredientFormState {
  return {
    nombre_producto: item.nombre_producto || '',
    producto_catalogo_id: item.producto_catalogo_id || '',
    categoria: slugifyCategory(item.categoria || 'otros'),
    newCategoria: '',
    codigo_barra: item.codigo_barra || '',
    marca: item.marca || '',
    imagen_url: item.imagen_url || '',
    cantidad: numberToInput(item.cantidad),
    unidad: item.unidad || '',
    precio_aprox: numberToInput(item.precio_aprox),
    cantidad_precio: numberToInput(item.cantidad_precio),
    unidad_precio: item.unidad_precio || '',
    supermercado_id: item.supermercado_id || '',
    precio_supermercado: numberToInput(item.precio_supermercado),
    precio_unidad: item.precio_unidad || '',
    fecha_vencimiento: item.fecha_vencimiento || '',
    energia_kcal: numberToInput(item.energia_kcal),
    proteinas_g: numberToInput(item.proteinas_g),
    carbohidratos_g: numberToInput(item.carbohidratos_g),
    grasas_g: numberToInput(item.grasas_g),
    fibra_g: numberToInput(item.fibra_g),
    sodio_mg: numberToInput(item.sodio_mg),
    azucar_g: numberToInput(item.azucar_g),
  };
}

function categoryDisplay(category: CategoryDef) {
  return category.name || titleize(category.id);
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  required = false,
  hasError = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  required?: boolean;
  hasError?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.requiredMark}>*</Text>}
      </View>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#43A66C"
        style={[styles.fieldInput, hasError && styles.fieldInputError]}
        value={value}
      />
    </View>
  );
}

function CategoryDropdown({
  categories,
  value,
  newValue,
  expanded,
  onToggle,
  onSelect,
  onNewValueChange,
}: {
  categories: CategoryDef[];
  value: string;
  newValue: string;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  onNewValueChange: (value: string) => void;
}) {
  const selected = categories.find((category) => category.id === value);
  const isCreating = value === '__new__';

  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.fieldLabel}>Categoria</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.dropdownButton}>
        <View style={styles.dropdownLeft}>
          <View style={[styles.dropdownDot, { backgroundColor: selected?.color || '#43A66C' }]} />
          <Text style={styles.dropdownText}>{isCreating ? 'Crear categoria' : selected?.name || 'Seleccionar'}</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#064E2F" />
      </Pressable>

      {expanded && (
        <View style={styles.dropdownMenu}>
          {categories.map((category) => (
            <Pressable
              accessibilityRole="button"
              key={category.id}
              onPress={() => onSelect(category.id)}
              style={[styles.dropdownOption, value === category.id && styles.dropdownOptionSelected]}>
              <MaterialCommunityIcons name={category.icon} size={20} color={category.color} />
              <Text style={styles.dropdownOptionText}>{category.name}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect('__new__')}
            style={[styles.dropdownOption, isCreating && styles.dropdownOptionSelected]}>
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#064E2F" />
            <Text style={styles.dropdownOptionText}>Crear categoria nueva</Text>
          </Pressable>
        </View>
      )}

      {isCreating && (
        <TextInput
          autoCapitalize="words"
          onChangeText={onNewValueChange}
          placeholder="Nombre de la categoria"
          placeholderTextColor="#43A66C"
          style={styles.fieldInputStandalone}
          value={newValue}
        />
      )}
    </View>
  );
}

function SlidingMetaText({ text }: { text: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [viewportWidth, setViewportWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);

    if (!viewportWidth || textWidth <= viewportWidth + 2) {
      return;
    }

    const distance = textWidth - viewportWidth + 18;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(translateX, {
          toValue: -distance,
          duration: Math.max(2200, distance * 36),
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [text, textWidth, translateX, viewportWidth]);

  return (
    <View
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={styles.slidingMetaViewport}>
      <Animated.Text
        style={[
          styles.catalogSuggestionMeta,
          styles.slidingMetaText,
          {
            width: textWidth || undefined,
            transform: [{ translateX }],
          },
        ]}>
        {text}
      </Animated.Text>
      <Text
        onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)}
        style={[styles.catalogSuggestionMeta, styles.slidingMetaMeasure]}>
        {text}
      </Text>
    </View>
  );
}

export default function FridgeScreen() {
  const { user } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [items, setItems] = useState<DespensaItemData[]>([]);
  const [supermarkets, setSupermarkets] = useState<SupermarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [selectedItem, setSelectedItem] = useState<DespensaItemData | null>(null);
  const [form, setForm] = useState<IngredientFormState>(EMPTY_FORM);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DespensaItemData[]>([]);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState('');
  const [authenticatingProductId, setAuthenticatingProductId] = useState<string | null>(null);
  const [authPromptItem, setAuthPromptItem] = useState<DespensaItemData | null>(null);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [quantityPromptItem, setQuantityPromptItem] = useState<DespensaItemData | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);
  const [catalogHelpVisible, setCatalogHelpVisible] = useState(false);
  const [pendingSaveMode, setPendingSaveMode] = useState<FormMode | null>(null);
  const [includeImageInGeneration, setIncludeImageInGeneration] = useState(false);
  const [pendingCategoryOverride, setPendingCategoryOverride] = useState<string | undefined>();
  const [categorySuggestion, setCategorySuggestion] = useState<{
    mode: FormMode;
    current: string;
    suggested: string;
    reason?: string;
  } | null>(null);
  const [checkingCategory, setCheckingCategory] = useState(false);
  const [supermarketDropdownOpen, setSupermarketDropdownOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogProductData[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogLoadingMore, setCatalogLoadingMore] = useState(false);
  const catalogItemAnimations = useRef(new Map<string, Animated.Value>()).current;
  const catalogAnimatedIds = useRef(new Set<string>()).current;
  const catalogAnimationQueryKey = useRef('');
  const scrollRef = useRef<ScrollView | null>(null);
  const formLayoutPositions = useRef<Record<string, number>>({});

  const categories = useMemo(() => {
    const base = new Map(DEFAULT_CATEGORIES.map((category) => [category.id, category]));
    for (const item of items) {
      const id = slugifyCategory(item.categoria || 'otros');
      if (!base.has(id)) {
        base.set(id, {
          id,
          name: titleize(item.categoria || id),
          icon: 'tag-outline',
          color: '#94A3B8',
        });
      }
    }
    return Array.from(base.values());
  }, [items]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );

  const nutritionHeaderCategory = useMemo(() => {
    if (!selectedItem) return selectedCategory;
    const categoryId = slugifyCategory(selectedItem.categoria || 'otros');
    return categories.find((category) => category.id === categoryId) ?? selectedCategory;
  }, [categories, selectedCategory, selectedItem]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, DespensaItemData[]> = {};
    for (const category of categories) grouped[category.id] = [];
    for (const item of items) {
      const categoryId = slugifyCategory(item.categoria || 'otros');
      if (!grouped[categoryId]) grouped[categoryId] = [];
      grouped[categoryId].push(item);
    }
    return grouped;
  }, [categories, items]);

  const quantityPickerValues = useMemo(
    () => getQuantityPickerValues(quantityPromptItem?.unidad),
    [quantityPromptItem?.unidad]
  );

  const quantityPickerItems = useMemo(
    () => quantityPickerValues.map((value) => ({ label: formatQuantityValue(value), value })),
    [quantityPickerValues]
  );

  const quantityPickerIndex = useMemo(() => {
    const parsed = parseInputNumber(quantityInput);
    const index = quantityPickerValues.findIndex((value) => value === parsed);
    return index >= 0 ? index : 0;
  }, [quantityInput, quantityPickerValues]);

  const loadDespensa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const result = await fetchDespensa(user.id);

    if (result.items) {
      // Hay conexión: cargar desde backend y guardar en caché
      setIsOffline(false);
      const itemsWithCatalogPrices = await hydratePricesByCatalogId(result.items);
      setItems(itemsWithCatalogPrices);
      await saveDespensaCache(user.id, itemsWithCatalogPrices);
      // HU-10: Programar notificaciones de vencimiento
      scheduleExpiryNotifications(itemsWithCatalogPrices).catch(() => {
        // Silenciar errores de notificaciones - no son críticos
      });
    } else {
      // Sin conexión o error: intentar cargar desde caché local
      const cached = await loadDespensaCache(user.id);
      if (cached) {
        setIsOffline(true);
        setItems(cached);
      } else {
        // No hay caché todavía
        setIsOffline(true);
        setItems([]);
      }
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadDespensa();
  }, [loadDespensa]);

  useEffect(() => {
    async function loadSupermarkets() {
      const result = await fetchSupermarkets();
      if (result.items) setSupermarkets(result.items);
      if (result.error) setFormError(result.error);
    }
    loadSupermarkets();
  }, []);

  useEffect(() => {
    const isEditingProduct = activeView === 'add' || activeView === 'edit';
    const nombre = form.nombre_producto.trim();
    const codigoBarra = form.codigo_barra.trim();

    if (!isEditingProduct || (!codigoBarra && nombre.length < 2)) {
      setCatalogSuggestions([]);
      setCatalogLoading(false);
      setCatalogHasMore(false);
      setCatalogLoadingMore(false);
      return;
    }

    let isActive = true;
    setCatalogLoading(true);

    const timeout = setTimeout(async () => {
      const result = await fetchCatalogProductSuggestions({
        nombre_producto: nombre,
        codigo_barra: codigoBarra,
        categoria_actual: getFormCategoryName(),
        limit: CATALOG_SUGGESTION_LIMIT,
        offset: 0,
      });

      if (!isActive) return;

      if (result.items) {
        setCatalogSuggestions(result.items);
        setCatalogHasMore(!!result.has_more);
      } else {
        setCatalogSuggestions([]);
        setCatalogHasMore(false);
      }
      setCatalogLoading(false);
    }, 450);

    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [activeView, form.categoria, form.codigo_barra, form.nombre_producto, form.newCategoria]);

  useEffect(() => {
    const queryKey = `${activeView}:${form.nombre_producto.trim()}:${form.codigo_barra.trim()}`;
    const isNewQuery = queryKey !== catalogAnimationQueryKey.current;
    const animations: Animated.CompositeAnimation[] = [];
    let staggerIndex = 0;

    if (isNewQuery) {
      catalogAnimationQueryKey.current = queryKey;
      catalogAnimatedIds.clear();
    }

    for (const product of catalogSuggestions) {
      let animation = catalogItemAnimations.get(product.id);
      if (!animation) {
        animation = new Animated.Value(0);
        catalogItemAnimations.set(product.id, animation);
      }

      if (isNewQuery || !catalogAnimatedIds.has(product.id)) {
        animation.setValue(0);
        catalogAnimatedIds.add(product.id);
        animations.push(
          Animated.timing(animation, {
            toValue: 1,
            duration: 280,
            delay: staggerIndex * 70,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        );
        staggerIndex += 1;
      }
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [activeView, catalogAnimatedIds, catalogAnimationQueryKey, catalogItemAnimations, catalogSuggestions, form.codigo_barra, form.nombre_producto]);

  function updateForm<K extends keyof IngredientFormState>(key: K, value: IngredientFormState[K]) {
    setFormError('');
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setForm((prev) => ({
      ...prev,
      [key]: value,
      producto_catalogo_id:
        key === 'nombre_producto' || key === 'codigo_barra'
          ? ''
          : prev.producto_catalogo_id,
    }));
  }

  function registerFormPosition(key: string, y: number, relativeToForm = false) {
    formLayoutPositions.current[key] = y + (relativeToForm ? formLayoutPositions.current.form || 0 : 0);
  }

  function scrollToFirstFormPosition(keys: string[]) {
    setTimeout(() => {
      const positions = keys
        .map((key) => formLayoutPositions.current[key])
        .filter((position): position is number => typeof position === 'number');
      if (positions.length === 0) return;
      scrollRef.current?.scrollTo({ y: Math.max(Math.min(...positions) - 24, 0), animated: true });
    }, 80);
  }

  async function openBarcodeScanner() {
    setFormError('');
    setScannedCode('');
    setScannerLocked(false);

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setFormError('Necesito permiso de camara para escanear codigos de barra.');
        return;
      }
    }

    setScannerOpen(true);
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scannerLocked) return;
    const digits = result.data.replace(/\D/g, '');
    if (!digits) return;

    setScannerLocked(true);
    setScannedCode(digits);
    setForm((prev) => ({ ...prev, codigo_barra: digits, producto_catalogo_id: '' }));
  }

  async function addScannedCodeOnly(useAi = false) {
    if (!user?.id || !scannedCode || saving) return;

    setFormError('');
    setSaving(true);
    const result = await agregarIngredientePorCodigo({
      user_id: user.id,
      codigo_barra: scannedCode,
      categorias_disponibles: categories.map((category) => category.name),
      usar_ia: useAi,
    });
    setSaving(false);

    if (result.requiere_ia) {
      Alert.alert(
        'No esta en la base de datos',
        result.mensaje || 'No encontramos este codigo en la base. Puedes intentar completarlo con IA.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Usar IA', onPress: () => addScannedCodeOnly(true) },
        ]
      );
      return;
    }

    if (result.error) {
      setScannerOpen(false);
      setScannedCode('');
      setScannerLocked(false);
      setActiveView('add');
      setFormError(result.error);
      Alert.alert(result.tipo === 'no_alimento' ? 'No parece comida' : 'No se pudo agregar', result.error);
      scrollToFirstFormPosition(['form']);
      return;
    }

    setScannerOpen(false);
    setScannedCode('');
    setScannerLocked(false);
    setItems((prev) => [result, ...prev]);
    setSelectedCategoryId(slugifyCategory(result.categoria));
    setForm({ ...EMPTY_FORM, categoria: slugifyCategory(result.categoria), codigo_barra: result.codigo_barra || '' });
    setActiveView('category');
    Alert.alert(
      result.origen_agregado === 'bdd' ? 'Agregado desde la base de datos' : 'Agregado con IA',
      result.mensaje_agregado || `${result.nombre_producto} se agregó a tu despensa.`
    );
  }

  function scanFromCurrentCategory() {
    openAddView(selectedCategoryId);
    openBarcodeScanner();
  }

  function openAddView(categoryId = selectedCategoryId) {
    setForm({ ...EMPTY_FORM, categoria: categoryId });
    setFormError('');
    setSelectedItem(null);
    setDropdownOpen(false);
    setUnitDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setCatalogHelpVisible(false);
    setActiveView('add');
  }

  function openEditView(item: DespensaItemData) {
    setSelectedItem(item);
    setForm(formFromItem(item));
    setFormError('');
    setDropdownOpen(false);
    setUnitDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setCatalogHelpVisible(false);
    setActiveView('edit');
  }

  function openNutritionView(item: DespensaItemData) {
    setSelectedItem(item);
    setForm(formFromItem(item));
    setFormError('');
    setDropdownOpen(false);
    setUnitDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setCatalogHelpVisible(false);
    setActiveView('nutrition');
  }

  function closeToCategories() {
    setActiveView('categories');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedItem(null);
    setFormError('');
    setDropdownOpen(false);
    setUnitDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setAuthPromptItem(null);
    setAuthMessage(null);
    setCatalogHelpVisible(false);
  }

  function getFormCategoryName() {
    if (form.categoria === '__new__') return form.newCategoria.trim() || 'Otros';
    return categories.find((category) => category.id === form.categoria)?.name || form.categoria;
  }

  function getCategorySelection(categoryName?: string) {
    if (!categoryName) {
      return { categoria: form.categoria, newCategoria: form.newCategoria };
    }

    const categoryId = slugifyCategory(categoryName);
    const matchingCategory = categories.find((category) => category.id === categoryId || category.name === categoryName);

    return matchingCategory
      ? { categoria: matchingCategory.id, newCategoria: '' }
      : { categoria: '__new__', newCategoria: categoryName };
  }

  function applyCatalogSuggestion(product: CatalogProductData) {
    setFormError('');
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setForm((prev) => ({
      ...prev,
      producto_catalogo_id: product.id,
      nombre_producto: product.nombre_producto || prev.nombre_producto,
      codigo_barra: product.codigo_barra || prev.codigo_barra,
      marca: product.marca || prev.marca,
      imagen_url: product.imagen_url || prev.imagen_url,
      energia_kcal: numberToInput(product.energia_kcal) || prev.energia_kcal,
      proteinas_g: numberToInput(product.proteinas_g) || prev.proteinas_g,
      carbohidratos_g: numberToInput(product.carbohidratos_g) || prev.carbohidratos_g,
      grasas_g: numberToInput(product.grasas_g) || prev.grasas_g,
      fibra_g: numberToInput(product.fibra_g) || prev.fibra_g,
      sodio_mg: numberToInput(product.sodio_mg) || prev.sodio_mg,
      azucar_g: numberToInput(product.azucar_g) || prev.azucar_g,
    }));
  }

  async function loadMoreCatalogSuggestions() {
    if (catalogLoading || catalogLoadingMore || !catalogHasMore) return;

    const nombre = form.nombre_producto.trim();
    const codigoBarra = form.codigo_barra.trim();
    if (!codigoBarra && nombre.length < 2) return;

    setCatalogLoadingMore(true);
    const result = await fetchCatalogProductSuggestions({
      nombre_producto: nombre,
      codigo_barra: codigoBarra,
      categoria_actual: getFormCategoryName(),
      limit: CATALOG_SUGGESTION_LIMIT,
      offset: catalogSuggestions.length,
    });
    setCatalogLoadingMore(false);

    if (result.items) {
      setCatalogSuggestions((prev) => {
        const existingIds = new Set(prev.map((product) => product.id));
        const nextItems = result.items!.filter((product) => !existingIds.has(product.id));
        return [...prev, ...nextItems];
      });
      setCatalogHasMore(!!result.has_more);
    } else {
      setCatalogHasMore(false);
    }
  }

  function buildPayload(categoryOverride?: string): DespensaUpdateData {
    return {
      producto_catalogo_id: cleanText(form.producto_catalogo_id),
      nombre_producto: form.nombre_producto.trim(),
      categoria: categoryOverride || getFormCategoryName(),
      codigo_barra: cleanText(form.codigo_barra),
      marca: cleanText(form.marca),
      imagen_url: cleanText(form.imagen_url),
      cantidad: parseInputNumber(form.cantidad),
      unidad: cleanText(form.unidad),
      precio_aprox: parseInputNumber(form.precio_aprox),
      cantidad_precio: parseInputNumber(form.cantidad_precio),
      unidad_precio: cleanText(form.unidad_precio),
      supermercado_id: cleanText(form.supermercado_id),
      precio_supermercado: parseInputNumber(form.precio_supermercado),
      precio_unidad: cleanText(form.precio_unidad),
      fecha_vencimiento: cleanText(form.fecha_vencimiento),
      energia_kcal: parseInputNumber(form.energia_kcal),
      proteinas_g: parseInputNumber(form.proteinas_g),
      carbohidratos_g: parseInputNumber(form.carbohidratos_g),
      grasas_g: parseInputNumber(form.grasas_g),
      fibra_g: parseInputNumber(form.fibra_g),
      sodio_mg: parseInputNumber(form.sodio_mg),
      azucar_g: parseInputNumber(form.azucar_g),
    };
  }

  function hasEmptyNutritionFields() {
    return NUTRIENT_FIELDS.some((field) => form[field.key].trim() === '');
  }

  async function performSaveIngredient(mode: FormMode, userId: string, generateMissing = false, categoryOverride?: string) {
    setSaving(true);
    setPendingSaveMode(null);
    setPendingCategoryOverride(undefined);
    const payload = {
      ...buildPayload(categoryOverride),
      generar_info_ia: generateMissing && hasEmptyNutritionFields(),
      generar_imagen_ia: generateMissing && includeImageInGeneration && form.imagen_url.trim() === '',
    };
    const result =
      mode === 'add'
        ? await agregarIngrediente({ ...(payload as DespensaAddData), user_id: userId })
        : selectedItem
          ? await actualizarIngrediente(selectedItem.id, payload)
          : ({ error: 'No hay ingrediente seleccionado' } as DespensaItemData & { error?: string });

    try {
      if (result.error) {
        setFormError(result.error);
        scrollToFirstFormPosition(['form']);
      } else if (mode === 'add') {
        setItems((prev) => [result, ...prev]);
        setSelectedCategoryId(slugifyCategory(result.categoria));
        setActiveView('category');
      } else {
        setItems((prev) => prev.map((item) => (item.id === result.id ? result : item)));
        setSelectedCategoryId(slugifyCategory(result.categoria));
        setActiveView('category');
      }
    } finally {
      setSaving(false);
    }
  }

  async function continueSaveIngredient(mode: FormMode, userId: string, categoryOverride?: string) {
    if (hasEmptyNutritionFields()) {
      setPendingSaveMode(mode);
      setPendingCategoryOverride(categoryOverride);
      setIncludeImageInGeneration(false);
      scrollToFirstFormPosition(['nutritionPrompt']);
      return;
    }

    await performSaveIngredient(mode, userId, false, categoryOverride);
  }

  async function saveIngredient(mode: FormMode, skipCategoryCheck = false, categoryOverride?: string) {
    if (!user?.id) return;
    const validationErrorKeys = [];
    if (!form.nombre_producto.trim()) validationErrorKeys.push('name');
    if (mode === 'add' && parseInputNumber(form.cantidad) === undefined) validationErrorKeys.push('quantity');

    if (validationErrorKeys.length > 0) {
      setFormError('Agrega el nombre del ingrediente.');
      if (form.nombre_producto.trim()) {
        setFormError('Agrega la cantidad del ingrediente.');
      }
      scrollToFirstFormPosition(validationErrorKeys);
      return;
    }

    const currentCategory = categoryOverride || getFormCategoryName();

    if (!skipCategoryCheck) {
      setCheckingCategory(true);
      const result = await verificarCategoriaProducto({
        nombre_producto: form.nombre_producto.trim(),
        categoria_actual: currentCategory,
        categorias_disponibles: categories.map((category) => category.name),
      });
      setCheckingCategory(false);

      if (result.requiere_cambio && result.categoria_sugerida && result.categoria_sugerida !== currentCategory) {
        setCategorySuggestion({
          mode,
          current: currentCategory,
          suggested: result.categoria_sugerida,
          reason: result.razon,
        });
        scrollToFirstFormPosition(['categorySuggestion']);
        return;
      }
    }

    await continueSaveIngredient(mode, user.id, categoryOverride);
  }

  async function saveNutritionDetails() {
    if (!selectedItem || saving) return;

    const parsedQuantity = parseInputNumber(form.cantidad);
    if (parsedQuantity === undefined) {
      setFormError('Agrega una cantidad valida.');
      scrollToFirstFormPosition(['nutritionDetails']);
      return;
    }

    setSaving(true);
    setFormError('');
    const payload: DespensaUpdateData = {
      cantidad: parsedQuantity,
      unidad: cleanText(form.unidad),
      energia_kcal: parseInputNumber(form.energia_kcal),
      proteinas_g: parseInputNumber(form.proteinas_g),
      carbohidratos_g: parseInputNumber(form.carbohidratos_g),
      grasas_g: parseInputNumber(form.grasas_g),
      fibra_g: parseInputNumber(form.fibra_g),
      sodio_mg: parseInputNumber(form.sodio_mg),
      azucar_g: parseInputNumber(form.azucar_g),
    };

    const result = await actualizarIngrediente(selectedItem.id, payload);
    setSaving(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setSelectedItem(result);
    setItems((prev) => prev.map((item) => (item.id === result.id ? result : item)));
    setSearchResults((prev) => prev.map((item) => (item.id === result.id ? result : item)));
    setSelectedCategoryId(slugifyCategory(result.categoria));
    setActiveView('category');
  }

  async function resolveCategorySuggestion(useSuggested: boolean) {
    if (!user?.id || !categorySuggestion) return;
    const suggestion = categorySuggestion;
    const categoryOverride = useSuggested ? suggestion.suggested : suggestion.current;

    setCategorySuggestion(null);

    if (useSuggested) {
      const matchingCategory = categories.find((category) => category.name === suggestion.suggested);
      setForm((prev) => ({
        ...prev,
        categoria: matchingCategory?.id || '__new__',
        newCategoria: matchingCategory ? '' : suggestion.suggested,
      }));
    }

    await continueSaveIngredient(suggestion.mode, user.id, categoryOverride);
  }

  async function saveWithPendingGeneration(mode: FormMode, generateMissing: boolean) {
    if (!user?.id) return;
    await performSaveIngredient(mode, user.id, generateMissing, pendingCategoryOverride);
  }

  async function handleGenerateImageForEdit() {
    if (!user?.id || !selectedItem || form.imagen_url.trim() || generatingImage) return;
    if (!form.nombre_producto.trim()) {
      setFormError('Agrega el nombre del ingrediente antes de generar imagen.');
      return;
    }

    setFormError('');
    setGeneratingImage(true);
    const result = await actualizarIngrediente(selectedItem.id, {
      ...buildPayload(),
      generar_imagen_ia: true,
    });
    setGeneratingImage(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setSelectedItem(result);
    setItems((prev) => prev.map((item) => (item.id === result.id ? result : item)));
    setForm((prev) => ({ ...prev, imagen_url: result.imagen_url || '' }));
    setSelectedCategoryId(slugifyCategory(result.categoria));
    setActiveView('category');
  }

  function openAuthPrompt(item: DespensaItemData) {
    setAuthPromptItem(item);
    setAuthMessage(null);
  }

  function closeAuthPrompt() {
    setAuthPromptItem(null);
    setAuthMessage(null);
  }

  function openQuantityPrompt(item: DespensaItemData) {
    const defaultValue = getQuantityPickerValues(item.unidad)[0] || 1;
    setQuantityPromptItem(item);
    setQuantityInput(formatQuantityValue(defaultValue));
    setQuantityError('');
    setFormError('');
  }

  function closeQuantityPrompt() {
    setQuantityPromptItem(null);
    setQuantityInput('');
    setQuantityError('');
  }

  async function confirmAddQuantity() {
    if (!quantityPromptItem || updatingQuantityId) return;
    const amountToAdd = parseInputNumber(quantityInput);
    if (amountToAdd === undefined || amountToAdd <= 0) {
      setQuantityError('Ingresa una cantidad mayor a 0.');
      return;
    }

    const currentAmount = Number(quantityPromptItem.cantidad || 0);
    const nextAmount = Number((currentAmount + amountToAdd).toFixed(3));
    setUpdatingQuantityId(quantityPromptItem.id);
    const result = await actualizarIngrediente(quantityPromptItem.id, { cantidad: nextAmount });
    setUpdatingQuantityId(null);

    if (result.error) {
      setQuantityError(result.error);
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === result.id ? result : item)));
    setSearchResults((prev) => prev.map((item) => (item.id === result.id ? result : item)));
    if (selectedItem?.id === result.id) setSelectedItem(result);
    closeQuantityPrompt();
  }

  async function handleAuthenticateProduct(item = authPromptItem || selectedItem) {
    if (!user?.id || !item?.producto_id || authenticatingProductId) return;
    setAuthMessage(null);
    setAuthenticatingProductId(item.producto_id);
    const result = await solicitarAutenticacionProducto(item.producto_id, user.id);
    setAuthenticatingProductId(null);

    if (result.error) {
      setAuthMessage({ type: 'error', text: result.error });
    } else {
      setAuthMessage({ type: 'success', text: result.msg || 'Tu producto quedó pendiente de revisión.' });
    }
  }

  async function handleDeleteIngredient(itemId: string) {
    Alert.alert('Eliminar ingrediente', '¿Quieres eliminar este ingrediente de tu despensa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const result = await eliminarIngrediente(itemId);
          if (result.error) {
            Alert.alert('Error', result.error);
          } else {
            setItems((prev) => prev.filter((item) => item.id !== itemId));
            setActiveView('category');
          }
        },
      },
    ]);
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim() || !user?.id) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const result = await buscarIngredientes(user.id, query.trim());
    if (result.items) {
      setSearchResults(result.items);
    }
    setSearching(false);
  }

  function renderIngredientCard(item: DespensaItemData, compact = false) {
    const imageUri = item.imagen_url || getPlaceholderUri(item.nombre_producto);
    //Estado de vencimiento
    const expiryStatus = getExpiryStatus(item.fecha_vencimiento);
    const expiryLabel = getExpiryLabel(item.fecha_vencimiento);
    const isExpiring = expiryStatus === 'expiring' || expiryStatus === 'expired';
    const displayPrice = getDisplayPrice(item);
    const hasDisplayPrice = displayPrice !== undefined && displayPrice !== null;
    return (
      <Pressable
        accessibilityRole="button"
        key={item.id}
        onPress={() => openNutritionView(item)}
        style={[
          styles.ingredientRow,
          expiryStatus === 'expiring' && styles.ingredientRowExpiring,
          expiryStatus === 'expired' && styles.ingredientRowExpired,
        ]}>
        <Image source={{ uri: imageUri }} style={styles.ingredientImage} />
        <View style={styles.ingredientInfo}>
          <View style={styles.ingredientTitleRow}>
            <Text style={styles.ingredientTitle} numberOfLines={1}>
              {item.nombre_producto}
            </Text>
            {hasDisplayPrice && (
              <View style={styles.priceCluster}>
                <Text style={styles.pricePill} numberOfLines={1}>
                  {formatPrice(displayPrice)}
                </Text>
                {item.supermercado_nombre && (
                  <View style={styles.supermarketChip}>
                    <MaterialCommunityIcons name="storefront-outline" size={12} color="#064E2F" />
                    <Text style={styles.supermarketChipText} numberOfLines={1}>
                      {item.supermercado_nombre}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
          {/*Badge de vencimiento*/}
          {isExpiring && expiryLabel && (
            <View style={[
              styles.expiryBadge,
              expiryStatus === 'expired' ? styles.expiryBadgeExpired : styles.expiryBadgeExpiring,
            ]}>
              <MaterialCommunityIcons
                name={expiryStatus === 'expired' ? 'alert-circle' : 'clock-alert-outline'}
                size={14}
                color={expiryStatus === 'expired' ? '#DC2626' : '#EA580C'}
              />
              <Text style={[
                styles.expiryBadgeText,
                expiryStatus === 'expired' ? styles.expiryBadgeTextExpired : styles.expiryBadgeTextExpiring,
              ]}>
                {expiryLabel}
              </Text>
            </View>
          )}
          <Text style={styles.ingredientMeta} numberOfLines={1}>
            {[item.marca, item.cantidad ? `${item.cantidad} ${item.unidad || ''}`.trim() : undefined]
              .filter(Boolean)
              .join(' · ') || item.categoria}
          </Text>
          {!compact && (
            <View style={styles.nutritionPreview}>
              <Text style={styles.nutritionPill}>{item.energia_kcal ?? 0} kcal</Text>
              <Text style={styles.nutritionPill}>P {item.proteinas_g ?? 0}g</Text>
              <Text style={styles.nutritionPill}>C {item.carbohidratos_g ?? 0}g</Text>
              <Text style={styles.nutritionPill}>G {item.grasas_g ?? 0}g</Text>
            </View>
          )}
        </View>
        <View style={styles.ingredientActions}>
          <Pressable
            accessibilityLabel="Agregar cantidad"
            accessibilityRole="button"
            disabled={updatingQuantityId === item.id}
            onPress={(event) => {
              event.stopPropagation();
              openQuantityPrompt(item);
            }}
            style={styles.ingredientQuantityButton}>
            {updatingQuantityId === item.id ? (
              <ActivityIndicator size="small" color="#064E2F" />
            ) : (
              <MaterialCommunityIcons name="plus" size={21} color="#064E2F" />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel="Editar ingrediente"
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              openEditView(item);
            }}
            style={styles.ingredientEditButton}>
            <MaterialCommunityIcons name="pencil-outline" size={21} color="#2F7A4F" />
          </Pressable>
          <Pressable
            accessibilityLabel="Solicitar autenticacion"
            accessibilityRole="button"
            disabled={authenticatingProductId === item.producto_id}
            onPress={(event) => {
              event.stopPropagation();
              openAuthPrompt(item);
            }}
            style={styles.ingredientAuthButton}>
            {authenticatingProductId === item.producto_id ? (
              <ActivityIndicator size="small" color="#0369A1" />
            ) : (
              <MaterialCommunityIcons name="shield-check-outline" size={21} color="#0369A1" />
            )}
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function getCatalogItemAnimation(productId: string) {
    let animation = catalogItemAnimations.get(productId);
    if (!animation) {
      animation = new Animated.Value(0);
      catalogItemAnimations.set(productId, animation);
    }
    return animation;
  }

  function renderCatalogSuggestions() {
    if (!catalogLoading && catalogSuggestions.length === 0) return null;

    return (
      <LinearGradient
        colors={['#064E2F', '#00B86B', '#B9FFD1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.catalogSuggestionPanel}>
        <View style={styles.catalogSuggestionHeader}>
          <MaterialCommunityIcons name="database-search-outline" size={20} color="#d8fbec" />
          <View style={styles.catalogSuggestionCopy}>
            <Text style={styles.catalogSuggestionTitle}>Productos sugeridos</Text>
            <Text style={styles.catalogSuggestionText}>Usa datos del catalogo sin cambiar tu categoria.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCatalogHelpVisible((prev) => !prev)}
            style={styles.catalogHelpButton}>
            <Text style={styles.catalogHelpButtonText}>?</Text>
          </Pressable>
          {catalogLoading && <ActivityIndicator size="small" color="#064E2F" />}
        </View>

        {catalogHelpVisible && (
          <View style={styles.catalogHelpPanel}>
            <Text style={styles.catalogHelpText}>
              Estas sugerencias se usan principalmente para tomar datos del catalogo, sobre todo codigo de barra, marca e informacion nutricional.
              La categoria de tu despensa no se cambia porque las categorias de supermercados pueden ser distintas.
            </Text>
          </View>
        )}

        {catalogSuggestions.map((product) => {
          const isSelected = form.producto_catalogo_id === product.id;
          const imageUri = product.imagen_url || getPlaceholderUri(product.nombre_producto);
          const metaText = [
            product.marca ? `Marca: ${product.marca}` : undefined,
            product.categoria ? `Categoria: ${product.categoria}` : undefined,
          ].filter(Boolean).join(' · ') || 'Producto de catalogo';
          const entryAnimation = getCatalogItemAnimation(product.id);
          const translateX = entryAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [34, 0],
          });

          return (
            <Animated.View
              key={product.id}
              style={{
                opacity: entryAnimation,
                transform: [{ translateX }],
              }}>
              <View style={[styles.catalogSuggestionItem, isSelected && styles.catalogSuggestionItemSelected]}>
                <Image source={{ uri: imageUri }} style={styles.catalogSuggestionImage} />
                <View style={styles.catalogSuggestionInfo}>
                  <Text style={styles.catalogSuggestionName} numberOfLines={1}>
                    {product.nombre_producto}
                  </Text>
                  <SlidingMetaText text={metaText} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => applyCatalogSuggestion(product)}
                  style={[styles.catalogSuggestionAction, isSelected && styles.catalogSuggestionActionSelected]}>
                  <Text style={[styles.catalogSuggestionActionText, isSelected && styles.catalogSuggestionActionTextSelected]}>
                    {isSelected ? 'Usado' : 'Usar'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          );
        })}

        {catalogHasMore && (
          <Pressable
            accessibilityRole="button"
            disabled={catalogLoadingMore}
            onPress={loadMoreCatalogSuggestions}
            style={styles.catalogLoadMoreAction}>
            {catalogLoadingMore ? (
              <ActivityIndicator size="small" color="#064E2F" />
            ) : (
              <Text style={styles.catalogLoadMoreText}>Cargar mas</Text>
            )}
          </Pressable>
        )}
      </LinearGradient>
    );
  }

  function renderNutritionDetails() {
    if (!selectedItem) return null;

    const imageUri = selectedItem.imagen_url || getPlaceholderUri(selectedItem.nombre_producto);
    const macroSummary = [
      { key: 'energia_kcal' as const, label: 'kcal', accent: '#00B86B', unit: '' },
      { key: 'proteinas_g' as const, label: 'Proteina', accent: '#2563EB', unit: 'g' },
      { key: 'carbohidratos_g' as const, label: 'Carbs', accent: '#F59E0B', unit: 'g' },
      { key: 'grasas_g' as const, label: 'Grasa', accent: '#EC4899', unit: 'g' },
    ];
    const secondaryNutrients = [
      { key: 'fibra_g' as const, label: 'Fibra', unit: 'g' },
      { key: 'sodio_mg' as const, label: 'Sodio', unit: 'mg' },
      { key: 'azucar_g' as const, label: 'Azucar', unit: 'g' },
    ];

    return (
      <View
        onLayout={(event) => registerFormPosition('nutritionDetails', event.nativeEvent.layout.y)}
        style={styles.nutritionDetailScreen}>
        {formError !== '' && (
          <View style={styles.formErrorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF8A8A" />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.nutritionDetailHero}>
          <Image source={{ uri: imageUri }} style={styles.nutritionDetailImage} />
        </View>

        <View style={styles.macroSummaryGrid}>
          {macroSummary.map((macro) => (
            <View key={macro.key} style={[styles.macroSummaryItem, { borderColor: macro.accent + '55' }]}>
              <View style={styles.macroSummaryValueRow}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateForm(macro.key, value)}
                  placeholder="0"
                  placeholderTextColor="#6B8F78"
                  style={[styles.macroSummaryInput, { color: macro.accent }]}
                  value={form[macro.key]}
                />
                {macro.unit ? <Text style={styles.macroSummaryUnit}>{macro.unit}</Text> : null}
              </View>
              <Text style={styles.macroSummaryLabel}>{macro.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.nutritionSoftSection}>
          <Text style={styles.formSectionTitle}>Cantidad</Text>
          <View style={styles.twoColumn}>
            <Field
              keyboardType="decimal-pad"
              label="Cantidad"
              onChangeText={(value) => updateForm('cantidad', value)}
              placeholder="1,5"
              required
              value={form.cantidad}
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Unidad</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnitDropdownOpen((prev) => !prev)}
                style={styles.dropdownButton}>
                <View style={styles.dropdownLeft}>
                  <View style={[styles.dropdownDot, { backgroundColor: '#00B86B' }]} />
                  <Text style={styles.dropdownText}>{form.unidad || 'Seleccionar unidad'}</Text>
                </View>
                <MaterialCommunityIcons name={unitDropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#064E2F" />
              </Pressable>

              {unitDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {UNIT_OPTIONS.map((unit) => (
                    <Pressable
                      accessibilityRole="button"
                      key={unit}
                      onPress={() => {
                        updateForm('unidad', unit);
                        setUnitDropdownOpen(false);
                      }}
                      style={[styles.dropdownOption, form.unidad === unit && styles.dropdownOptionSelected]}>
                      <MaterialCommunityIcons name="scale-balance" size={20} color="#064E2F" />
                      <Text style={styles.dropdownOptionText}>{unit}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.nutritionSoftSection}>
          <Text style={styles.formSectionTitle}>Detalles nutricionales</Text>
          <Text style={styles.nutritionDetailHint}>Valores aproximados por 100 g o 100 ml.</Text>
          <View style={styles.nutritionGrid}>
            {secondaryNutrients.map((field) => (
              <Field
                keyboardType="decimal-pad"
                key={field.key}
                label={`${field.label} (${field.unit})`}
                onChangeText={(value) => updateForm(field.key, value)}
                placeholder="0"
                value={form[field.key]}
              />
            ))}
          </View>
        </View>

        <View style={styles.formActions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={saveNutritionDetails} style={styles.primaryAction}>
            {saving ? (
              <ActivityIndicator size="small" color="#FBFFF8" />
            ) : (
              <Text style={styles.primaryActionText}>Guardar</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  function renderIngredientForm(mode: FormMode) {
    const nameHasError = !!formError && !form.nombre_producto.trim();
    const quantityHasError = mode === 'add' && !!formError && parseInputNumber(form.cantidad) === undefined;

    return (
      <View style={styles.formPanel} onLayout={(event) => registerFormPosition('form', event.nativeEvent.layout.y)}>
        {formError !== '' && (
          <View style={styles.formErrorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF8A8A" />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Identificacion</Text>
          <View onLayout={(event) => registerFormPosition('name', event.nativeEvent.layout.y, true)} style={styles.fieldAnchor}>
            <Field
              hasError={nameHasError}
              label="Nombre"
              onChangeText={(value) => updateForm('nombre_producto', value)}
              placeholder="Ej: pollo, arroz, tomate"
              required
              value={form.nombre_producto}
            />
          </View>
          {renderCatalogSuggestions()}
          <CategoryDropdown
            categories={categories}
            expanded={dropdownOpen}
            newValue={form.newCategoria}
            onNewValueChange={(value) => updateForm('newCategoria', value)}
            onSelect={(value) => {
              updateForm('categoria', value);
              setDropdownOpen(false);
            }}
            onToggle={() => setDropdownOpen((prev) => !prev)}
            value={form.categoria}
          />
          <View style={styles.twoColumn}>
            <Field label="Marca" onChangeText={(value) => updateForm('marca', value)} placeholder="Opcional" value={form.marca} />
            <Field
              label="Codigo barra"
              onChangeText={(value) => updateForm('codigo_barra', value)}
              placeholder="Opcional"
              value={form.codigo_barra}
            />
          </View>
          <Pressable accessibilityRole="button" onPress={openBarcodeScanner} style={styles.scanCodeAction}>
            <MaterialCommunityIcons name="barcode-scan" size={20} color="#064E2F" />
            <View style={styles.scanCodeCopy}>
              <Text style={styles.scanCodeActionText}>Escanear codigo</Text>
              {form.codigo_barra ? <Text style={styles.scanCodeValue}>{form.codigo_barra}</Text> : null}
            </View>
          </Pressable>
          <Field
            label="Imagen URL"
            onChangeText={(value) => updateForm('imagen_url', value)}
            placeholder="https://..."
            value={form.imagen_url}
          />
          {mode === 'edit' && selectedItem && form.imagen_url.trim() === '' && (
            <Pressable
              accessibilityRole="button"
              disabled={generatingImage}
              onPress={handleGenerateImageForEdit}
              style={styles.generateImageAction}>
              {generatingImage ? (
                <ActivityIndicator size="small" color="#0369A1" />
              ) : (
                <>
                  <MaterialCommunityIcons name="image-auto-adjust" size={19} color="#0369A1" />
                  <Text style={styles.generateImageActionText}>Generar imagen</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Despensa</Text>
          <View style={styles.twoColumn}>
            <View onLayout={(event) => registerFormPosition('quantity', event.nativeEvent.layout.y, true)} style={styles.fieldAnchor}>
              <Field
                hasError={quantityHasError}
                keyboardType="decimal-pad"
                label="Cantidad"
                onChangeText={(value) => updateForm('cantidad', value)}
                placeholder="1,5"
                required={mode === 'add'}
                value={form.cantidad}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Unidad</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnitDropdownOpen((prev) => !prev)}
                style={styles.dropdownButton}>
                <View style={styles.dropdownLeft}>
                  <View style={[styles.dropdownDot, { backgroundColor: '#00B86B' }]} />
                  <Text style={styles.dropdownText}>{form.unidad || 'Seleccionar unidad'}</Text>
                </View>
                <MaterialCommunityIcons name={unitDropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#064E2F" />
              </Pressable>

              {unitDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {UNIT_OPTIONS.map((unit) => (
                    <Pressable
                      accessibilityRole="button"
                      key={unit}
                      onPress={() => {
                        updateForm('unidad', unit);
                        setUnitDropdownOpen(false);
                      }}
                      style={[styles.dropdownOption, form.unidad === unit && styles.dropdownOptionSelected]}>
                      <MaterialCommunityIcons name="scale-balance" size={20} color="#064E2F" />
                      <Text style={styles.dropdownOptionText}>{unit}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
          <View style={styles.priceReferencePanel}>
            <View style={styles.supermarketPriceHeader}>
              <MaterialCommunityIcons name="cash" size={19} color="#064E2F" />
              <View style={styles.supermarketPriceCopy}>
                <Text style={styles.priceReferenceTitle}>Precio aproximado</Text>
                <Text style={styles.priceReferenceText}>Indica a que cantidad corresponde ese precio.</Text>
              </View>
            </View>
            <Field
              keyboardType="decimal-pad"
              label="Precio aprox"
              onChangeText={(value) => updateForm('precio_aprox', value)}
              placeholder="CLP"
              value={form.precio_aprox}
            />
            <View style={styles.twoColumn}>
              <Field
                keyboardType="decimal-pad"
                label="Cantidad precio"
                onChangeText={(value) => updateForm('cantidad_precio', value)}
                placeholder="Ej: 1"
                value={form.cantidad_precio}
              />
              <Field
                label="Unidad precio"
                onChangeText={(value) => updateForm('unidad_precio', value)}
                placeholder="Ej: kg, unidad"
                value={form.unidad_precio}
              />
            </View>
          </View>
          <Field
            label="Vencimiento"
            onChangeText={(value) => updateForm('fecha_vencimiento', value)}
            placeholder="YYYY-MM-DD"
            value={form.fecha_vencimiento}
          />
          <View style={styles.supermarketPricePanel}>
            <View style={styles.supermarketPriceHeader}>
              <MaterialCommunityIcons name="store-outline" size={19} color="#0369A1" />
              <View style={styles.supermarketPriceCopy}>
                <Text style={styles.supermarketPriceTitle}>Precio de supermercado</Text>
                <Text style={styles.supermarketPriceText}>Opcional: guarda este precio en la base de precios.</Text>
              </View>
            </View>

            <View style={styles.dropdownWrap}>
              <Text style={styles.fieldLabel}>Supermercado</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSupermarketDropdownOpen((prev) => !prev)}
                style={styles.dropdownButton}>
                <View style={styles.dropdownLeft}>
                  <View style={[styles.dropdownDot, { backgroundColor: '#7DD3FC' }]} />
                  <Text style={styles.dropdownText}>
                    {supermarkets.find((market) => market.id === form.supermercado_id)?.nombre || 'Seleccionar supermercado'}
                  </Text>
                </View>
                <MaterialCommunityIcons name={supermarketDropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#064E2F" />
              </Pressable>

              {supermarketDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {supermarkets.map((market) => (
                    <Pressable
                      accessibilityRole="button"
                      key={market.id}
                      onPress={() => {
                        updateForm('supermercado_id', market.id);
                        setSupermarketDropdownOpen(false);
                      }}
                      style={[styles.dropdownOption, form.supermercado_id === market.id && styles.dropdownOptionSelected]}>
                      <MaterialCommunityIcons name="store-outline" size={20} color="#0369A1" />
                      <Text style={styles.dropdownOptionText}>{market.nombre}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.twoColumn}>
              <Field
                keyboardType="decimal-pad"
                label="Precio super"
                onChangeText={(value) => updateForm('precio_supermercado', value)}
                placeholder="CLP"
                value={form.precio_supermercado}
              />
              <Field
                label="Cantidad precio"
                onChangeText={(value) => updateForm('precio_unidad', value)}
                placeholder="Ej: 1 kg, 500 g"
                value={form.precio_unidad}
              />
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Nutricion</Text>
          <View style={styles.nutritionGrid}>
            {NUTRIENT_FIELDS.map((field) => (
              <Field
                keyboardType="decimal-pad"
                key={field.key}
                label={`${field.label} (${field.unit})`}
                onChangeText={(value) => updateForm(field.key, value)}
                placeholder="0"
                value={form[field.key]}
              />
            ))}
          </View>
        </View>

        {categorySuggestion?.mode === mode && (
          <View
            onLayout={(event) => registerFormPosition('categorySuggestion', event.nativeEvent.layout.y, true)}
            style={styles.categorySuggestionPanel}>
            <View style={styles.categorySuggestionHeader}>
              <MaterialCommunityIcons name="tag-search-outline" size={20} color="#0369A1" />
              <Text style={styles.categorySuggestionTitle}>Revisar categoria</Text>
            </View>
            <Text style={styles.categorySuggestionText}>
              La IA cree que "{form.nombre_producto.trim()}" calza mejor en "{categorySuggestion.suggested}" que en "{categorySuggestion.current}".
            </Text>
            {categorySuggestion.reason ? <Text style={styles.categorySuggestionReason}>{categorySuggestion.reason}</Text> : null}
            <View style={styles.categorySuggestionActions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => resolveCategorySuggestion(false)} style={styles.categorySuggestionSecondary}>
                <Text style={styles.categorySuggestionSecondaryText}>Mantener {categorySuggestion.current}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => resolveCategorySuggestion(true)} style={styles.categorySuggestionPrimary}>
                <Text style={styles.categorySuggestionPrimaryText}>Usar {categorySuggestion.suggested}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {pendingSaveMode === mode && (
          <View
            onLayout={(event) => registerFormPosition('nutritionPrompt', event.nativeEvent.layout.y, true)}
            style={styles.aiPromptPanel}>
            <View style={styles.aiPromptHeader}>
              <MaterialCommunityIcons name="auto-fix" size={20} color="#064E2F" />
              <Text style={styles.aiPromptTitle}>Completar datos faltantes</Text>
            </View>
            <Text style={styles.aiPromptText}>
              Faltan datos de nutricion. Puedes guardar igual o pedirle a la IA que complete los nutrientes.
            </Text>
            {form.imagen_url.trim() === '' && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: includeImageInGeneration }}
                onPress={() => setIncludeImageInGeneration((prev) => !prev)}
                style={[styles.imageOptionRow, includeImageInGeneration && styles.imageOptionRowSelected]}>
                <MaterialCommunityIcons
                  name={includeImageInGeneration ? 'checkbox-marked-circle-outline' : 'checkbox-blank-circle-outline'}
                  size={21}
                  color="#0369A1"
                />
                <View style={styles.imageOptionCopy}>
                  <Text style={styles.imageOptionTitle}>Incluir imagen</Text>
                  <Text style={styles.imageOptionText}>Opcional: tambien genera una imagen para este producto.</Text>
                </View>
              </Pressable>
            )}
            <View style={styles.aiPromptActions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => saveWithPendingGeneration(mode, false)}
                style={styles.aiPromptSecondary}>
                <Text style={styles.aiPromptSecondaryText}>Guardar igual</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => saveWithPendingGeneration(mode, true)}
                style={styles.aiPromptPrimary}>
                {saving ? <ActivityIndicator size="small" color="#FBFFF8" /> : <Text style={styles.aiPromptPrimaryText}>Generar y guardar</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.formActions}>
          {mode === 'edit' && selectedItem && (
            <Pressable
              accessibilityRole="button"
              onPress={() => handleDeleteIngredient(selectedItem.id)}
              style={styles.deleteAction}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FF8A8A" />
              <Text style={styles.deleteActionText}>Eliminar</Text>
            </Pressable>
          )}
          {mode === 'edit' && selectedItem && (
            <Pressable
              accessibilityRole="button"
              disabled={!!authenticatingProductId}
              onPress={() => selectedItem && openAuthPrompt(selectedItem)}
              style={styles.secondaryAction}>
              {selectedItem && authenticatingProductId === selectedItem.producto_id ? (
                <ActivityIndicator size="small" color="#0369A1" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color="#0369A1" />
                  <Text style={styles.secondaryActionText}>Autenticar</Text>
                </>
              )}
            </Pressable>
          )}
          <Pressable accessibilityRole="button" disabled={saving || checkingCategory} onPress={() => saveIngredient(mode)} style={styles.primaryAction}>
            {saving || checkingCategory ? (
              <ActivityIndicator size="small" color="#FBFFF8" />
            ) : (
              <Text style={styles.primaryActionText}>Guardar</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#064E2F" />
          <Text style={styles.loadingText}>Cargando tu despensa...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activeView === 'nutrition' && (
        <LinearGradient
          colors={['#E7FFF0', '#FFF8E7', '#F3FAFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.nutritionBackground}
        />
      )}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            {activeView !== 'categories' && (
              <Pressable accessibilityRole="button" onPress={closeToCategories} style={styles.inlineBackButton}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#064E2F" />
              </Pressable>
            )}
            {activeView === 'nutrition' && selectedItem && (
              <View style={[styles.titleCategoryIcon, { backgroundColor: nutritionHeaderCategory.color + '33' }]}>
                <MaterialCommunityIcons name={nutritionHeaderCategory.icon} size={22} color={nutritionHeaderCategory.color} />
              </View>
            )}
            <Text style={styles.title}>
              {activeView === 'category'
                ? categoryDisplay(selectedCategory)
                : activeView === 'add'
                ? 'Agregar'
                : activeView === 'edit'
                  ? 'Editar'
                  : activeView === 'nutrition'
                    ? selectedItem?.nombre_producto || 'Nutrición'
                    : activeView === 'search'
                      ? 'Buscar'
                      : 'Tu refri'}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {activeView === 'add'
              ? 'Registra un ingrediente con datos de despensa y nutricion.'
              : activeView === 'edit'
                ? 'Actualiza cantidad, categoria y características del ingrediente.'
                : activeView === 'nutrition'
                  ? ``
                : activeView === 'search'
                  ? 'Busca ingredientes y abre su ficha nutricional.'
                  : 'Organiza ingredientes por categoria y características.'}
          </Text>
        </View>

        {/* Banner de sin conexión — datos desde caché local */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="wifi-off" size={18} color="#EA580C" />
            <Text style={styles.offlineBannerText}>
              Sin conexión — viendo datos guardados localmente
            </Text>
          </View>
        )}

        {activeView === 'categories' && (
          <View style={styles.addBar}>
            <Pressable accessibilityRole="button" onPress={() => openAddView()} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color="#064E2F" />
            </Pressable>
            <Text style={styles.addBarText}>Agregar ingrediente</Text>
            <Pressable accessibilityRole="button" onPress={scanFromCurrentCategory} style={styles.scanButton}>
              <MaterialCommunityIcons name="barcode-scan" size={22} color="#064E2F" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setActiveView('search')} style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#064E2F" />
            </Pressable>
          </View>
        )}

        {activeView === 'search' && (
          <View style={styles.addBar}>
            <View style={styles.searchIconStatic}>
              <MaterialCommunityIcons name="magnify" size={22} color="#2F7A4F" />
            </View>
            <TextInput
              autoFocus
              onChangeText={handleSearch}
              placeholder="Buscar en tu despensa..."
              placeholderTextColor="#2F7A4F"
              returnKeyType="search"
              style={styles.input}
              value={searchQuery}
            />
            {searching && <ActivityIndicator size="small" color="#064E2F" />}
          </View>
        )}

        {activeView === 'categories' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categorias</Text>
              <Text style={styles.sectionMeta}>{items.length} ingredientes total</Text>
            </View>

            <View style={styles.categoryGrid}>
              {categories.map((category) => {
                const count = itemsByCategory[category.id]?.length || 0;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={category.id}
                    onPress={() => {
                      setSelectedCategoryId(category.id);
                      setActiveView('category');
                    }}
                    style={styles.categoryCard}>
                    <View style={[styles.categoryIcon, { backgroundColor: category.color + '33' }]}>
                      <MaterialCommunityIcons name={category.icon} size={24} color={category.color} />
                    </View>
                    <View style={styles.categoryInfoRow}>
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryCount}>{count} ingredientes</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={22} color="#2F7A4F" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {activeView === 'category' && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <View style={[styles.detailIcon, { backgroundColor: selectedCategory.color + '33' }]}>
                <MaterialCommunityIcons name={selectedCategory.icon} size={26} color={selectedCategory.color} />
              </View>
              <View style={styles.detailCopy}>
                <Text style={styles.detailTitle}>{categoryDisplay(selectedCategory)}</Text>
                <Text style={styles.detailSubtitle}>
                  {itemsByCategory[selectedCategory.id]?.length || 0} ingredientes en esta categoria.
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => openAddView(selectedCategory.id)} style={styles.smallIconButton}>
                <MaterialCommunityIcons name="plus" size={22} color="#064E2F" />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={scanFromCurrentCategory} style={styles.smallScanButton}>
                <MaterialCommunityIcons name="barcode-scan" size={21} color="#064E2F" />
              </Pressable>
            </View>

            {(itemsByCategory[selectedCategory.id] || []).length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="food-off" size={40} color="#4F9F70" />
                <Text style={styles.emptyText}>No hay ingredientes en esta categoría</Text>
                <Pressable style={styles.emptyButton} onPress={() => openAddView(selectedCategory.id)}>
                  <Text style={styles.emptyButtonText}>Agregar uno</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.ingredientsList}>{(itemsByCategory[selectedCategory.id] || []).map((item) => renderIngredientCard(item))}</View>
            )}
          </View>
        )}

        {activeView === 'add' && renderIngredientForm('add')}
        {activeView === 'edit' && renderIngredientForm('edit')}
        {activeView === 'nutrition' && renderNutritionDetails()}

        {activeView === 'search' && (
          <View style={styles.detailPanel}>
            {searchQuery.trim() === '' ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="magnify" size={40} color="#4F9F70" />
                <Text style={styles.emptyText}>Escribe para buscar ingredientes en tu despensa</Text>
              </View>
            ) : searching ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#064E2F" />
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="emoticon-sad-outline" size={40} color="#4F9F70" />
                <Text style={styles.emptyText}>No se encontraron ingredientes con "{searchQuery}"</Text>
              </View>
            ) : (
              <View style={styles.ingredientsList}>{searchResults.map((item) => renderIngredientCard(item, true))}</View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal animationType="fade" transparent visible={!!authPromptItem} onRequestClose={closeAuthPrompt}>
        <View style={styles.authModalBackdrop}>
          <View style={styles.authModalCard}>
            <View style={styles.authModalHeader}>
              <View style={styles.authModalIcon}>
                <MaterialCommunityIcons name="shield-check-outline" size={24} color="#0369A1" />
              </View>
              <View style={styles.authModalTitleWrap}>
                <Text style={styles.authModalTitle}>Autenticar producto</Text>
                <Text style={styles.authModalSubtitle} numberOfLines={1}>
                  {authPromptItem?.nombre_producto}
                </Text>
              </View>
            </View>

            <Text style={styles.authModalText}>
              La autenticacion envia este producto a revision para que, si se aprueba, pueda actualizar el catalogo base. Asi nuevos usuarios
              pueden encontrarlo con datos mas completos y Rechipe puede usarlo mejor en recomendaciones y recetas.
            </Text>

            {authMessage && (
              <View style={[styles.authMessagePanel, authMessage.type === 'error' ? styles.authMessageError : styles.authMessageSuccess]}>
                <MaterialCommunityIcons
                  name={authMessage.type === 'error' ? 'alert-circle-outline' : 'check-circle-outline'}
                  size={19}
                  color={authMessage.type === 'error' ? '#FF8A8A' : '#0369A1'}
                />
                <Text style={[styles.authMessageText, authMessage.type === 'error' ? styles.authMessageTextError : styles.authMessageTextSuccess]}>
                  {authMessage.text}
                </Text>
              </View>
            )}

            <View style={styles.authModalActions}>
              <Pressable accessibilityRole="button" onPress={closeAuthPrompt} style={styles.authModalSecondary}>
                <Text style={styles.authModalSecondaryText}>{authMessage?.type === 'success' ? 'Cerrar' : 'Cancelar'}</Text>
              </Pressable>
              {authMessage?.type !== 'success' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={!authPromptItem || authenticatingProductId === authPromptItem.producto_id}
                  onPress={() => handleAuthenticateProduct()}
                  style={styles.authModalPrimary}>
                  {authPromptItem && authenticatingProductId === authPromptItem.producto_id ? (
                    <ActivityIndicator size="small" color="#FBFFF8" />
                  ) : (
                    <Text style={styles.authModalPrimaryText}>Enviar solicitud</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={!!quantityPromptItem} onRequestClose={closeQuantityPrompt}>
        <View style={styles.quantityModalBackdrop}>
          <View style={styles.quantityModalSheet}>
            {quantityPromptItem && (
              <>
                <View style={styles.quantityModalHeader}>
                  <Text style={styles.quantityModalTitle}>Añadir producto</Text>
                  <Pressable accessibilityRole="button" onPress={closeQuantityPrompt} style={styles.quantityModalClose}>
                    <MaterialCommunityIcons name="close" size={22} color="#064E2F" />
                  </Pressable>
                </View>

                <Image
                  source={{ uri: quantityPromptItem.imagen_url || getPlaceholderUri(quantityPromptItem.nombre_producto) }}
                  style={styles.quantityProductImage}
                />
                <Text style={styles.quantityProductName} numberOfLines={1}>
                  {quantityPromptItem.nombre_producto}
                </Text>
                <Text style={styles.quantityPromptText}>
                  ¿Cuántos {quantityPromptItem.unidad || 'unidades'} quieres añadir?
                </Text>

                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => {
                    setQuantityInput(value);
                    setQuantityError('');
                  }}
                  placeholder="0"
                  placeholderTextColor="#43A66C"
                  style={styles.quantityInput}
                  value={quantityInput}
                />

                <View style={styles.quantityPickerWrap}>
                  <WheelPickerExpo
                    key={`${quantityPromptItem.id}-${quantityPromptItem.unidad || 'unidad'}-${quantityPickerItems.length}`}
                    backgroundColor="#FBFFF8"
                    height={190}
                    haptics
                    initialSelectedIndex={quantityPickerIndex}
                    items={quantityPickerItems}
                    onChange={({ item }) => {
                      if (typeof item.value === 'number') {
                        setQuantityInput(formatQuantityValue(item.value));
                        setQuantityError('');
                      }
                    }}
                    selectedStyle={{ borderColor: '#00B86B', borderWidth: 1 }}
                    width="100%"
                  />
                </View>

                <Text style={styles.quantityCurrentText}>
                  Actual: {formatQuantityValue(Number(quantityPromptItem.cantidad || 0))} {quantityPromptItem.unidad || 'unidades'}
                </Text>
                {quantityError ? <Text style={styles.quantityErrorText}>{quantityError}</Text> : null}

                <View style={styles.quantityModalActions}>
                  <Pressable accessibilityRole="button" onPress={closeQuantityPrompt} style={styles.quantitySecondaryButton}>
                    <Text style={styles.quantitySecondaryButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={updatingQuantityId === quantityPromptItem.id}
                    onPress={confirmAddQuantity}
                    style={styles.quantityPrimaryButton}>
                    {updatingQuantityId === quantityPromptItem.id ? (
                      <ActivityIndicator size="small" color="#FBFFF8" />
                    ) : (
                      <Text style={styles.quantityPrimaryButtonText}>Añadir</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={scannerOpen} onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.scannerBackdrop}>
          <View style={styles.scannerCard}>
            <View style={styles.scannerHeader}>
              <View style={styles.scannerIcon}>
                <MaterialCommunityIcons name="barcode-scan" size={24} color="#064E2F" />
              </View>
              <View style={styles.scannerTitleWrap}>
                <Text style={styles.scannerTitle}>Escanear codigo</Text>
                <Text style={styles.scannerSubtitle}>Apunta la camara al codigo de barras.</Text>
              </View>
            </View>

            {cameraPermission?.granted ? (
              <View style={styles.cameraFrame}>
                <CameraView
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'],
                  }}
                  facing="back"
                  onBarcodeScanned={scannerLocked ? undefined : handleBarcodeScanned}
                  style={styles.cameraView}
                />
                <View style={styles.scanGuide} />
              </View>
            ) : (
              <View style={styles.scannerPermissionPanel}>
                <MaterialCommunityIcons name="camera-lock-outline" size={28} color="#2F7A4F" />
                <Text style={styles.scannerPermissionText}>Activa el permiso de camara para leer codigos.</Text>
              </View>
            )}

            {scannedCode ? (
              <View style={styles.scannedCodePanel}>
                <Text style={styles.scannedCodeLabel}>Codigo leido</Text>
                <Text style={styles.scannedCodeText}>{scannedCode}</Text>
              </View>
            ) : (
              <Text style={styles.scannerHint}>Escanea un codigo para buscarlo en la base y agregarlo automaticamente con categoria.</Text>
            )}

            <View style={styles.scannerActions}>
              <Pressable accessibilityRole="button" onPress={() => setScannerOpen(false)} style={styles.scannerSecondary}>
                <Text style={styles.scannerSecondaryText}>{scannedCode ? 'Editar manual' : 'Cerrar'}</Text>
              </Pressable>
              {scannedCode ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => addScannedCodeOnly()}
                  style={styles.scannerPrimary}>
                  {saving ? <ActivityIndicator size="small" color="#FBFFF8" /> : <Text style={styles.scannerPrimaryText}>Agregar por codigo</Text>}
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 2,
  },
  addBarText: {
    flex: 1,
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '800',
  },
  addButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  aiPromptActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  aiPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  aiPromptPanel: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  aiPromptPrimary: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#00B86B',
  },
  aiPromptPrimaryText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  aiPromptSecondary: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  aiPromptSecondaryText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  aiPromptText: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  aiPromptTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  authMessageError: {
    borderColor: '#8D2B3D',
    backgroundColor: '#351928',
  },
  authMessagePanel: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  authMessageSuccess: {
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  authMessageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  authMessageTextError: {
    color: '#FF8A8A',
  },
  authMessageTextSuccess: {
    color: '#0369A1',
  },
  authModalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  authModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(6, 78, 47, 0.28)',
  },
  authModalCard: {
    width: '100%',
    maxWidth: 430,
    gap: 14,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#F0F9FF',
  },
  authModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  authModalIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
  },
  authModalPrimary: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0284C7',
  },
  authModalPrimaryText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  authModalSecondary: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  authModalSecondaryText: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '900',
  },
  authModalSubtitle: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '800',
  },
  authModalText: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  authModalTitle: {
    color: '#075985',
    fontSize: 18,
    fontWeight: '900',
  },
  authModalTitleWrap: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  categoryCard: {
    width: '48%',
    minHeight: 118,
    padding: 14,
    gap: 12,
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 1,
  },
  categoryCopy: {
    gap: 3,
    backgroundColor: 'transparent',
  },
  categoryCount: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    backgroundColor: 'transparent',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  categoryInfoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: 'transparent',
  },
  categoryName: {
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
  },
  catalogSuggestionAction: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00E676',
    backgroundColor: '#D8FFE5',
  },
  catalogSuggestionActionSelected: {
    borderColor: '#00D976',
    backgroundColor: '#00D976',
  },
  catalogSuggestionActionText: {
    color: '#035D35',
    fontSize: 13,
    fontWeight: '900',
  },
  catalogSuggestionActionTextSelected: {
    color: '#FBFFF8',
  },
  catalogSuggestionCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  catalogSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  catalogHelpButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8FFE5',
    backgroundColor: 'rgba(216, 255, 229, 0.24)',
  },
  catalogHelpButtonText: {
    color: '#FBFFF8',
    fontSize: 15,
    fontWeight: '900',
  },
  catalogHelpPanel: {
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(216, 255, 229, 0.5)',
    backgroundColor: 'rgba(6, 78, 47, 0.28)',
  },
  catalogHelpText: {
    color: '#FBFFF8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  catalogSuggestionImage: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#00E676',
  },
  catalogSuggestionInfo: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  catalogSuggestionItem: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00E676',
    backgroundColor: '#F4FFF7',
  },
  catalogSuggestionItemSelected: {
    borderColor: '#00D976',
    backgroundColor: '#B9FFD1',
  },
  catalogLoadMoreAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00E676',
    backgroundColor: '#D8FFE5',
  },
  catalogLoadMoreText: {
    color: '#035D35',
    fontSize: 14,
    fontWeight: '900',
  },
  catalogSuggestionMeta: {
    color: '#087A46',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  catalogSuggestionName: {
    color: '#035D35',
    fontSize: 14,
    fontWeight: '900',
  },
  catalogSuggestionPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#00E676',
    backgroundColor: '#B9FFD1',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 4,
  },
  catalogSuggestionText: {
    color: '#E9FBEF',
    fontSize: 12,
    fontWeight: '700',
  },
  catalogSuggestionTitle: {
    color: '#FBFFF8',
    fontSize: 15,
    fontWeight: '900',
  },
  categorySuggestionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  categorySuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  categorySuggestionPanel: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#F0F9FF',
  },
  categorySuggestionPrimary: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#0284C7',
  },
  categorySuggestionPrimaryText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  categorySuggestionReason: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  categorySuggestionSecondary: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  categorySuggestionSecondaryText: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '900',
  },
  categorySuggestionText: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  categorySuggestionTitle: {
    color: '#075985',
    fontSize: 15,
    fontWeight: '900',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 130,
  },
  deleteAction: {
    minHeight: 52,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8D2B3D',
    backgroundColor: '#351928',
  },
  deleteActionText: {
    color: '#FF8A8A',
    fontSize: 15,
    fontWeight: '900',
  },
  detailCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  detailIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#9FE7B9',
  },
  detailPanel: {
    gap: 16,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 2,
  },
  detailSubtitle: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '600',
  },
  detailTitle: {
    color: '#064E2F',
    fontSize: 20,
    fontWeight: '900',
  },
  dropdownButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  dropdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    gap: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  dropdownOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  dropdownOptionSelected: {
    backgroundColor: '#9FE7B9',
  },
  dropdownOptionText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownText: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  dropdownWrap: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#9FE7B9',
    marginTop: 4,
  },
  emptyButtonText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 15,
    textAlign: 'center',
  },
  field: {
    flex: 1,
    gap: 8,
    backgroundColor: 'transparent',
  },
  fieldAnchor: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fieldInput: {
    minHeight: 54,
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  fieldInputError: {
    borderColor: '#FF8A8A',
    backgroundColor: '#351928',
  },
  fieldInputStandalone: {
    minHeight: 54,
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  fieldLabel: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '900',
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  formErrorPanel: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8D2B3D',
    backgroundColor: '#351928',
  },
  formErrorText: {
    flex: 1,
    color: '#FF8A8A',
    fontSize: 13,
    fontWeight: '800',
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  formPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  formSection: {
    gap: 12,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  formSectionTitle: {
    color: '#064E2F',
    fontSize: 17,
    fontWeight: '900',
  },
  generateImageAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  generateImageActionText: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '900',
  },
  requiredMark: {
    color: '#FF8A8A',
    fontSize: 15,
    fontWeight: '900',
  },
  quantityCurrentText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  quantityErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  quantityInput: {
    width: 150,
    minHeight: 58,
    alignSelf: 'center',
    color: '#064E2F',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  quantityModalActions: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  quantityModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 78, 47, 0.28)',
  },
  quantityModalClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#DDF8E7',
  },
  quantityModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  quantityModalSheet: {
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FBFFF8',
  },
  quantityModalTitle: {
    color: '#064E2F',
    fontSize: 22,
    fontWeight: '900',
  },
  quantityPickerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    overflow: 'hidden',
    backgroundColor: '#FBFFF8',
  },
  quantityPrimaryButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#00B86B',
  },
  quantityPrimaryButtonText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  quantityProductImage: {
    width: 112,
    height: 112,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: '#9FE7B9',
  },
  quantityProductName: {
    color: '#064E2F',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  quantityPromptText: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  quantitySecondaryButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  quantitySecondaryButtonText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  hero: {
    gap: 14,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  ingredientImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  ingredientActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  ingredientAuthButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  ingredientEditButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  ingredientQuantityButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#BDEFCF',
  },
  ingredientInfo: {
    flex: 1,
    gap: 5,
    backgroundColor: 'transparent',
  },
  ingredientMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  ingredientRow: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  ingredientTitle: {
    flexShrink: 1,
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
  },
  ingredientTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    backgroundColor: 'transparent',
  },
  ingredientsList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  imageOptionCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  imageOptionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  imageOptionRowSelected: {
    backgroundColor: '#BAE6FD',
  },
  imageOptionText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  imageOptionTitle: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '900',
  },
  inlineBackButton: {
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
  input: {
    flex: 1,
    minWidth: 0,
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'transparent',
  },
  loadingText: {
    color: '#2F7A4F',
    fontSize: 16,
    fontWeight: '700',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#EA580C',
  },
  nutritionGrid: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  nutritionBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  nutritionCategoryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  nutritionDetailHero: {
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'transparent',
  },
  nutritionDetailHint: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -4,
  },
  nutritionDetailImage: {
    width: 136,
    height: 136,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#FBFFF8',
    backgroundColor: '#9FE7B9',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 3,
  },
  nutritionDetailScreen: {
    gap: 18,
    marginHorizontal: -20,
    marginTop: -4,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  nutritionDetailSubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  nutritionDetailTitle: {
    color: '#064E2F',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  nutritionDetailTitleWrap: {
    gap: 4,
    backgroundColor: 'transparent',
  },
  macroSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  macroSummaryItem: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 24,
    backgroundColor: 'rgba(251, 255, 248, 0.82)',
    borderWidth: 1,
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 1,
  },
  macroSummaryInput: {
    width: 98,
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  macroSummaryLabel: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '900',
  },
  macroSummaryValue: {
    color: '#064E2F',
    fontSize: 20,
    fontWeight: '900',
  },
  macroSummaryUnit: {
    color: '#6B8F78',
    fontSize: 14,
    fontWeight: '900',
    position: 'absolute',
    left: '50%',
    marginLeft: 42,
    top: 13,
  },
  macroSummaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 52,
    gap: 4,
    backgroundColor: 'transparent',
  },
  nutritionSoftSection: {
    gap: 12,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(251, 255, 248, 0.68)',
  },
  nutritionPill: {
    color: '#064E2F',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
    overflow: 'hidden',
  },
  nutritionPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    backgroundColor: 'transparent',
  },
  priceCluster: {
    maxWidth: 190,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    backgroundColor: 'transparent',
  },
  pricePill: {
    minWidth: 76,
    color: '#FBFFF8',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#00B86B',
    overflow: 'hidden',
  },
  priceReferencePanel: {
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  priceReferenceText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
  },
  priceReferenceTitle: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  cameraFrame: {
    height: 280,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#064E2F',
  },
  cameraView: {
    flex: 1,
  },
  primaryAction: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 3,
  },
  primaryActionText: {
    color: '#FBFFF8',
    fontSize: 15,
    fontWeight: '900',
  },
  searchButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 2,
  },
  scanButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 2,
  },
  scanCodeAction: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  scanCodeActionText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  scanCodeCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  scanCodeValue: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  scanGuide: {
    position: 'absolute',
    left: 30,
    right: 30,
    top: '40%',
    height: 78,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#9FE7B9',
    backgroundColor: 'rgba(159, 231, 185, 0.08)',
  },
  scannedCodeLabel: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scannedCodePanel: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  scannedCodeText: {
    color: '#064E2F',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  scannerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent',
  },
  scannerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(6, 78, 47, 0.28)',
  },
  scannerCard: {
    width: '100%',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  scannerIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  scannerPermissionPanel: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  scannerPermissionText: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  scannerPrimary: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#00B86B',
  },
  scannerPrimaryText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  scannerSecondary: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  scannerSecondaryText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  scannerSubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  scannerTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  scannerTitleWrap: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  slidingMetaViewport: {
    width: '100%',
    height: 17,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  slidingMetaMeasure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  slidingMetaText: {
    position: 'absolute',
    left: 0,
    top: 0,
    minWidth: '100%',
  },
  searchIconStatic: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryAction: {
    minHeight: 52,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#E0F2FE',
  },
  secondaryActionText: {
    color: '#0369A1',
    fontSize: 15,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sectionMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  smallIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  smallScanButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 2,
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  supermarketChip: {
    maxWidth: 86,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#FBFFF8',
  },
  supermarketChipText: {
    flexShrink: 1,
    color: '#064E2F',
    fontSize: 10,
    fontWeight: '900',
  },
  supermarketPriceCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  supermarketPriceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'transparent',
  },
  supermarketPricePanel: {
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7DD3FC',
    backgroundColor: '#F0F9FF',
  },
  supermarketPriceText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
  },
  supermarketPriceTitle: {
    color: '#075985',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    flexShrink: 1,
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  titleCategoryIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#E9FBEF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  unitChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  unitChipSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#9FE7B9',
  },
  unitChipText: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  unitChipTextSelected: {
    color: '#064E2F',
  },
  unitRow: {
    gap: 8,
    paddingRight: 4,
  },




  //Estilos de cuando venza la wea
  ingredientRowExpiring: {
    borderColor: '#F97316',
    borderWidth: 2,
    backgroundColor: '#FFF7ED',
  },
  ingredientRowExpired: {
    borderColor: '#DC2626',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  expiryBadgeExpiring: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  expiryBadgeExpired: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  expiryBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  expiryBadgeTextExpiring: {
    color: '#EA580C',
  },
  expiryBadgeTextExpired: {
    color: '#DC2626',
  },
});
