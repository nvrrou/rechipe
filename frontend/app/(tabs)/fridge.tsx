import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import {
  DespensaAddData,
  DespensaItemData,
  DespensaUpdateData,
  SupermarketData,
  actualizarIngrediente,
  agregarIngrediente,
  buscarIngredientes,
  eliminarIngrediente,
  fetchDespensa,
  fetchSupermarkets,
  solicitarAutenticacionProducto,
  verificarCategoriaProducto,
} from '@/services/despensa';

type ActiveView = 'categories' | 'category' | 'add' | 'search' | 'edit';
type FormMode = 'add' | 'edit';

type CategoryDef = {
  id: string;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

type IngredientFormState = {
  nombre_producto: string;
  categoria: string;
  newCategoria: string;
  codigo_barra: string;
  marca: string;
  imagen_url: string;
  cantidad: string;
  unidad: string;
  precio_aprox: string;
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
  { id: 'otros', name: 'Otros', icon: 'dots-horizontal', color: '#6B7280' },
];

const UNIT_OPTIONS = ['unidad', 'g', 'kg', 'ml', 'l', 'taza', 'cda'];

const EMPTY_FORM: IngredientFormState = {
  nombre_producto: '',
  categoria: DEFAULT_CATEGORIES[0].id,
  newCategoria: '',
  codigo_barra: '',
  marca: '',
  imagen_url: '',
  cantidad: '',
  unidad: '',
  precio_aprox: '',
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

function cleanText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formFromItem(item: DespensaItemData): IngredientFormState {
  return {
    nombre_producto: item.nombre_producto || '',
    categoria: slugifyCategory(item.categoria || 'otros'),
    newCategoria: '',
    codigo_barra: item.codigo_barra || '',
    marca: item.marca || '',
    imagen_url: item.imagen_url || '',
    cantidad: numberToInput(item.cantidad),
    unidad: item.unidad || '',
    precio_aprox: numberToInput(item.precio_aprox),
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

export default function FridgeScreen() {
  const { user } = useAuth();

  const [items, setItems] = useState<DespensaItemData[]>([]);
  const [supermarkets, setSupermarkets] = useState<SupermarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [selectedItem, setSelectedItem] = useState<DespensaItemData | null>(null);
  const [form, setForm] = useState<IngredientFormState>(EMPTY_FORM);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DespensaItemData[]>([]);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState('');
  const [authenticatingProductId, setAuthenticatingProductId] = useState<string | null>(null);
  const [authPromptItem, setAuthPromptItem] = useState<DespensaItemData | null>(null);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  const loadDespensa = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const result = await fetchDespensa(user.id);
    if (result.items) {
      setItems(result.items);
    } else if (result.error) {
      Alert.alert('Error', result.error);
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

  function updateForm<K extends keyof IngredientFormState>(key: K, value: IngredientFormState[K]) {
    setFormError('');
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAddView(categoryId = selectedCategoryId) {
    setForm({ ...EMPTY_FORM, categoria: categoryId });
    setFormError('');
    setSelectedItem(null);
    setDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setActiveView('add');
  }

  function openEditView(item: DespensaItemData) {
    setSelectedItem(item);
    setForm(formFromItem(item));
    setFormError('');
    setDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setActiveView('edit');
  }

  function closeToCategories() {
    setActiveView('categories');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedItem(null);
    setFormError('');
    setDropdownOpen(false);
    setPendingSaveMode(null);
    setIncludeImageInGeneration(false);
    setCategorySuggestion(null);
    setPendingCategoryOverride(undefined);
    setAuthPromptItem(null);
    setAuthMessage(null);
  }

  function getFormCategoryName() {
    if (form.categoria === '__new__') return form.newCategoria.trim() || 'Otros';
    return categories.find((category) => category.id === form.categoria)?.name || form.categoria;
  }

  function buildPayload(categoryOverride?: string): DespensaUpdateData {
    return {
      nombre_producto: form.nombre_producto.trim(),
      categoria: categoryOverride || getFormCategoryName(),
      codigo_barra: cleanText(form.codigo_barra),
      marca: cleanText(form.marca),
      imagen_url: cleanText(form.imagen_url),
      cantidad: parseInputNumber(form.cantidad),
      unidad: cleanText(form.unidad),
      precio_aprox: parseInputNumber(form.precio_aprox),
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
      return;
    }

    await performSaveIngredient(mode, userId, false, categoryOverride);
  }

  async function saveIngredient(mode: FormMode, skipCategoryCheck = false, categoryOverride?: string) {
    if (!user?.id) return;
    if (!form.nombre_producto.trim()) {
      setFormError('Agrega el nombre del ingrediente.');
      return;
    }
    if (mode === 'add' && parseInputNumber(form.cantidad) === undefined) {
      setFormError('Agrega la cantidad del ingrediente.');
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
        return;
      }
    }

    await continueSaveIngredient(mode, user.id, categoryOverride);
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
    return (
      <Pressable accessibilityRole="button" key={item.id} onPress={() => openEditView(item)} style={styles.ingredientRow}>
        <Image source={{ uri: imageUri }} style={styles.ingredientImage} />
        <View style={styles.ingredientInfo}>
          <View style={styles.ingredientTitleRow}>
            <Text style={styles.ingredientTitle} numberOfLines={1}>
              {item.nombre_producto}
            </Text>
            <Text style={styles.pricePill}>{formatPrice(item.precio_aprox)}</Text>
          </View>
          {item.supermercado_nombre && (
            <Text style={styles.supermarketMeta} numberOfLines={1}>
              {item.supermercado_nombre}
            </Text>
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

  function renderIngredientForm(mode: FormMode) {
    const nameHasError = !!formError && !form.nombre_producto.trim();
    const quantityHasError = mode === 'add' && !!formError && parseInputNumber(form.cantidad) === undefined;

    return (
      <View style={styles.formPanel}>
        {formError !== '' && (
          <View style={styles.formErrorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF8A8A" />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Identificacion</Text>
          <Field
            hasError={nameHasError}
            label="Nombre"
            onChangeText={(value) => updateForm('nombre_producto', value)}
            placeholder="Ej: pollo, arroz, tomate"
            required
            value={form.nombre_producto}
          />
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
            <Field
              hasError={quantityHasError}
              keyboardType="decimal-pad"
              label="Cantidad"
              onChangeText={(value) => updateForm('cantidad', value)}
              placeholder="1,5"
              required={mode === 'add'}
              value={form.cantidad}
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Unidad</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitRow}>
                {UNIT_OPTIONS.map((unit) => (
                  <Pressable
                    accessibilityRole="button"
                    key={unit}
                    onPress={() => updateForm('unidad', unit)}
                    style={[styles.unitChip, form.unidad === unit && styles.unitChipSelected]}>
                    <Text style={[styles.unitChipText, form.unidad === unit && styles.unitChipTextSelected]}>{unit}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
          <View style={styles.twoColumn}>
            <Field
              keyboardType="decimal-pad"
              label="Precio aprox"
              onChangeText={(value) => updateForm('precio_aprox', value)}
              placeholder="CLP"
              value={form.precio_aprox}
            />
            <Field
              label="Vencimiento"
              onChangeText={(value) => updateForm('fecha_vencimiento', value)}
              placeholder="YYYY-MM-DD"
              value={form.fecha_vencimiento}
            />
          </View>
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
          <View style={styles.categorySuggestionPanel}>
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
          <View style={styles.aiPromptPanel}>
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.titleRow}>
            {activeView !== 'categories' && (
              <Pressable accessibilityRole="button" onPress={closeToCategories} style={styles.inlineBackButton}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#064E2F" />
              </Pressable>
            )}
            <Text style={styles.title}>
              {activeView === 'category'
                ? categoryDisplay(selectedCategory)
                : activeView === 'add'
                  ? 'Agregar'
                  : activeView === 'edit'
                    ? 'Editar'
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
                : activeView === 'search'
                  ? 'Busca ingredientes y abre su pantalla de edición.'
                  : 'Organiza ingredientes por categoria y características.'}
          </Text>
        </View>

        {activeView === 'categories' && (
          <View style={styles.addBar}>
            <Pressable accessibilityRole="button" onPress={() => openAddView()} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color="#064E2F" />
            </Pressable>
            <Text style={styles.addBarText}>Agregar ingrediente</Text>
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
  nutritionGrid: {
    gap: 10,
    backgroundColor: 'transparent',
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
  pricePill: {
    color: '#008A50',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#00B86B',
    overflow: 'hidden',
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
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  supermarketMeta: {
    color: '#0369A1',
    fontSize: 12,
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
});
