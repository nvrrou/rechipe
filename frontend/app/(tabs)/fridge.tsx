import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import {
  DespensaAddData,
  DespensaItemData,
  DespensaUpdateData,
  actualizarIngrediente,
  agregarIngrediente,
  buscarIngredientes,
  eliminarIngrediente,
  fetchDespensa,
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
        placeholderTextColor="#6B7280"
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
          <View style={[styles.dropdownDot, { backgroundColor: selected?.color || '#6B7280' }]} />
          <Text style={styles.dropdownText}>{isCreating ? 'Crear categoria' : selected?.name || 'Seleccionar'}</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color="#FFFFFF" />
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
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.dropdownOptionText}>Crear categoria nueva</Text>
          </Pressable>
        </View>
      )}

      {isCreating && (
        <TextInput
          autoCapitalize="words"
          onChangeText={onNewValueChange}
          placeholder="Nombre de la categoria"
          placeholderTextColor="#6B7280"
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [selectedItem, setSelectedItem] = useState<DespensaItemData | null>(null);
  const [form, setForm] = useState<IngredientFormState>(EMPTY_FORM);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DespensaItemData[]>([]);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState('');

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

  function updateForm<K extends keyof IngredientFormState>(key: K, value: IngredientFormState[K]) {
    setFormError('');
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openAddView(categoryId = selectedCategoryId) {
    setForm({ ...EMPTY_FORM, categoria: categoryId });
    setFormError('');
    setSelectedItem(null);
    setDropdownOpen(false);
    setActiveView('add');
  }

  function openEditView(item: DespensaItemData) {
    setSelectedItem(item);
    setForm(formFromItem(item));
    setFormError('');
    setDropdownOpen(false);
    setActiveView('edit');
  }

  function closeToCategories() {
    setActiveView('categories');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedItem(null);
    setFormError('');
    setDropdownOpen(false);
  }

  function getFormCategoryName() {
    if (form.categoria === '__new__') return form.newCategoria.trim() || 'Otros';
    return categories.find((category) => category.id === form.categoria)?.name || form.categoria;
  }

  function buildPayload(): DespensaUpdateData {
    return {
      nombre_producto: form.nombre_producto.trim(),
      categoria: getFormCategoryName(),
      codigo_barra: cleanText(form.codigo_barra),
      marca: cleanText(form.marca),
      imagen_url: cleanText(form.imagen_url),
      cantidad: parseInputNumber(form.cantidad),
      unidad: cleanText(form.unidad),
      precio_aprox: parseInputNumber(form.precio_aprox),
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

  async function saveIngredient(mode: FormMode) {
    if (!user?.id) return;
    if (!form.nombre_producto.trim()) {
      setFormError('Agrega el nombre del ingrediente.');
      return;
    }
    if (mode === 'add' && parseInputNumber(form.cantidad) === undefined) {
      setFormError('Agrega la cantidad del ingrediente.');
      return;
    }

    setSaving(true);
    const payload = buildPayload();
    const result =
      mode === 'add'
        ? await agregarIngrediente({ ...(payload as DespensaAddData), user_id: user.id })
        : selectedItem
          ? await actualizarIngrediente(selectedItem.id, payload)
          : ({ error: 'No hay ingrediente seleccionado' } as DespensaItemData & { error?: string });

    if (result.error) {
      Alert.alert('Error', result.error);
    } else if (mode === 'add') {
      setItems((prev) => [result, ...prev]);
      setSelectedCategoryId(slugifyCategory(result.categoria));
      setActiveView('category');
    } else {
      setItems((prev) => prev.map((item) => (item.id === result.id ? result : item)));
      setSelectedCategoryId(slugifyCategory(result.categoria));
      setActiveView('category');
    }
    setSaving(false);
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
        <MaterialCommunityIcons name="pencil-outline" size={22} color="#9CA3AF" />
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
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#f87171" />
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

        <View style={styles.formActions}>
          {mode === 'edit' && selectedItem && (
            <Pressable
              accessibilityRole="button"
              onPress={() => handleDeleteIngredient(selectedItem.id)}
              style={styles.deleteAction}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#f87171" />
              <Text style={styles.deleteActionText}>Eliminar</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => saveIngredient(mode)} style={styles.primaryAction}>
            {saving ? <ActivityIndicator size="small" color="#0B0B0B" /> : <Text style={styles.primaryActionText}>Guardar</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
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
                <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
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
              <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.addBarText}>Agregar ingrediente</Text>
            <Pressable accessibilityRole="button" onPress={() => setActiveView('search')} style={styles.searchButton}>
              <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {activeView === 'search' && (
          <View style={styles.addBar}>
            <View style={styles.searchIconStatic}>
              <MaterialCommunityIcons name="magnify" size={22} color="#9CA3AF" />
            </View>
            <TextInput
              autoFocus
              onChangeText={handleSearch}
              placeholder="Buscar en tu despensa..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              style={styles.input}
              value={searchQuery}
            />
            {searching && <ActivityIndicator size="small" color="#FFFFFF" />}
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
                      <MaterialCommunityIcons name="chevron-right" size={22} color="#9CA3AF" />
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
                <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            {(itemsByCategory[selectedCategory.id] || []).length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="food-off" size={40} color="#555" />
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
                <MaterialCommunityIcons name="magnify" size={40} color="#555" />
                <Text style={styles.emptyText}>Escribe para buscar ingredientes en tu despensa</Text>
              </View>
            ) : searching ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="emoticon-sad-outline" size={40} color="#555" />
                <Text style={styles.emptyText}>No se encontraron ingredientes con "{searchQuery}"</Text>
              </View>
            ) : (
              <View style={styles.ingredientsList}>{searchResults.map((item) => renderIngredientCard(item, true))}</View>
            )}
          </View>
        )}
      </ScrollView>
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
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 2,
  },
  addBarText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  addButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  categoryCard: {
    width: '48%',
    minHeight: 118,
    padding: 14,
    gap: 12,
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    shadowColor: '#000000',
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
    color: '#B8B8B8',
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
    backgroundColor: '#2A2A2A',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
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
    borderColor: '#7F1D1D',
    backgroundColor: '#241313',
  },
  deleteActionText: {
    color: '#f87171',
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
    backgroundColor: '#2A2A2A',
  },
  detailPanel: {
    gap: 16,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 2,
  },
  detailSubtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '600',
  },
  detailTitle: {
    color: '#FFFFFF',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
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
    backgroundColor: '#2A2A2A',
  },
  dropdownOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownText: {
    color: '#FFFFFF',
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
    backgroundColor: '#2A2A2A',
    marginTop: 4,
  },
  emptyButtonText: {
    color: '#FFFFFF',
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
    color: '#888',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  fieldInputError: {
    borderColor: '#f87171',
    backgroundColor: '#241313',
  },
  fieldInputStandalone: {
    minHeight: 54,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  fieldLabel: {
    color: '#B8B8B8',
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
    borderColor: '#7F1D1D',
    backgroundColor: '#241313',
  },
  formErrorText: {
    flex: 1,
    color: '#f87171',
    fontSize: 13,
    fontWeight: '800',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  formPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#171717',
  },
  formSection: {
    gap: 12,
    paddingBottom: 2,
    backgroundColor: 'transparent',
  },
  formSectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  requiredMark: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '900',
  },
  hero: {
    gap: 14,
    padding: 22,
    borderRadius: 26,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 2,
  },
  ingredientImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  ingredientInfo: {
    flex: 1,
    gap: 5,
    backgroundColor: 'transparent',
  },
  ingredientMeta: {
    color: '#B8B8B8',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  ingredientTitle: {
    flexShrink: 1,
    color: '#FFFFFF',
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
  inlineBackButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
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
    color: '#B8B8B8',
    fontSize: 16,
    fontWeight: '700',
  },
  nutritionGrid: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  nutritionPill: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
    overflow: 'hidden',
  },
  nutritionPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    backgroundColor: 'transparent',
  },
  pricePill: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#166534',
    overflow: 'hidden',
  },
  primaryAction: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  primaryActionText: {
    color: '#0B0B0B',
    fontSize: 15,
    fontWeight: '900',
  },
  searchButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  searchIconStatic: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sectionMeta: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  smallIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  subtitle: {
    color: '#B8B8B8',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  title: {
    flexShrink: 1,
    color: '#FFFFFF',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  unitChipSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2A2A2A',
  },
  unitChipText: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '800',
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
  },
  unitRow: {
    gap: 8,
    paddingRight: 4,
  },
});
