import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import WheelPickerExpo from 'react-native-wheel-picker-expo';

import { useAuth } from '@/contexts/AuthContext';

type StepId = 'edad' | 'peso' | 'altura' | 'genero' | 'objetivos' | 'restricciones' | 'favoritos';

type StepDef = {
  id: StepId;
  title: string;
  subtitle: string;
  category: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const STEPS: StepDef[] = [
  {
    id: 'edad',
    title: 'Edad',
    subtitle: 'Selecciona tu edad para ajustar recomendaciones iniciales.',
    category: 'Datos personales',
    icon: 'calendar-heart',
  },
  {
    id: 'peso',
    title: 'Peso',
    subtitle: 'Usaremos este dato para estimar porciones y objetivos.',
    category: 'Datos personales',
    icon: 'scale-bathroom',
  },
  {
    id: 'altura',
    title: 'Altura',
    subtitle: 'Ayuda a contextualizar tus recomendaciones nutricionales.',
    category: 'Datos personales',
    icon: 'human-male-height',
  },
  {
    id: 'genero',
    title: 'Genero',
    subtitle: 'Elige la opcion que mejor te represente.',
    category: 'Datos personales',
    icon: 'account-outline',
  },
  {
    id: 'objetivos',
    title: 'Objetivos',
    subtitle: 'Selecciona al menos un objetivo para orientar las recetas.',
    category: 'Nutricion',
    icon: 'target',
  },
  {
    id: 'restricciones',
    title: 'Restricciones',
    subtitle: 'Opcional: marca alimentos o estilos que quieres evitar.',
    category: 'Preferencias',
    icon: 'shield-check-outline',
  },
  {
    id: 'favoritos',
    title: 'Favoritos',
    subtitle: 'Agrega ingredientes que quieres ver más seguido.',
    category: 'Preferencias',
    icon: 'silverware-fork-knife',
  },
];

const OBJETIVOS_OPTIONS = [
  'Perder peso',
  'Ganar músculo',
  'Mantener peso',
  'Comer saludable',
  'Reducir azúcar',
  'Más proteínas',
  'Dieta equilibrada',
  'Control porciones',
];

const RESTRICCIONES_OPTIONS = [
  'Vegetariano',
  'Vegano',
  'Sin gluten',
  'Sin lactosa',
  'Sin mariscos',
  'Sin frutos secos',
  'Bajo sodio',
  'Diabético',
];

const FAVORITOS_SUGERIDOS = ['Pollo', 'Arroz', 'Palta', 'Huevos', 'Avena', 'Tomate'];

const GENEROS = [
  { label: 'Masculino', icon: 'male' },
  { label: 'Femenino', icon: 'female' },
  { label: 'Otro', icon: 'accessibility' },
] as const;

const RULER_TICK_WIDTH = 18;

function parseMetricValue(value: string) {
  return Number(value.replace(',', '.')) || 0;
}

function formatMetricValue(value: number, decimals = 0) {
  const formatted = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return formatted.replace('.', ',');
}

function snapMetricValue(value: string, min: number, max: number, step: number) {
  const numericValue = parseMetricValue(value);
  const clampedValue = Math.min(max, Math.max(min, numericValue || min));
  return Math.round((clampedValue - min) / step) * step + min;
}

function buildWheelItems(min: number, max: number, step: number, decimals = 0) {
  const total = Math.floor((max - min) / step) + 1;
  return Array.from({ length: total }, (_, index) => {
    const value = min + index * step;
    return {
      label: formatMetricValue(value, decimals),
      value,
    };
  });
}

function getInitialIndex(value: string, min: number, max: number, step: number) {
  const numericValue = parseMetricValue(value);
  const clampedValue = Math.min(max, Math.max(min, numericValue || min));
  return Math.round((clampedValue - min) / step);
}

function ChipSelector({
  options,
  selected,
  onToggle,
  accentColor,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  accentColor: string;
}) {
  return (
    <View style={styles.chipGrid}>
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => onToggle(option)}
            style={[
              styles.chip,
              isSelected && { backgroundColor: accentColor + '22', borderColor: accentColor },
            ]}>
            <Text style={[styles.chipText, isSelected && { color: accentColor }]}>{option}</Text>
            {isSelected && <Ionicons name="checkmark-circle" size={16} color={accentColor} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function MetricWheel({
  value,
  unit,
  min,
  max,
  step,
  decimals = 0,
  onChange,
}: {
  value: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (value: string) => void;
}) {
  const items = useMemo(() => buildWheelItems(min, max, step, decimals), [decimals, max, min, step]);
  const initialSelectedIndex = useMemo(() => getInitialIndex(value, min, max, step), [max, min, step, value]);

  function handleTextChange(text: string) {
    const normalizedText = decimals > 0 ? text.replace(/[^\d,.]/g, '').replace('.', ',') : text.replace(/\D/g, '');
    const parts = normalizedText.split(',');
    const nextText =
      decimals > 0 && parts.length > 1 ? `${parts[0]},${parts.slice(1).join('').slice(0, decimals)}` : normalizedText;
    onChange(nextText);
  }

  function snapTypedValue() {
    onChange(formatMetricValue(snapMetricValue(value, min, max, step), decimals));
  }

  return (
    <View style={styles.metricWrap}>
      <View style={styles.metricValueWrap}>
        <TextInput
          keyboardType={decimals > 0 ? 'decimal-pad' : 'numeric'}
          onChangeText={handleTextChange}
          onEndEditing={snapTypedValue}
          placeholder="0"
          placeholderTextColor="#43A66C"
          selectTextOnFocus
          style={styles.metricInput}
          value={value}
        />
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>

      <View style={styles.wheelWrap}>
        <WheelPickerExpo
          backgroundColor="#E9FBEF"
          height={210}
          haptics
          initialSelectedIndex={initialSelectedIndex}
          items={items}
          onChange={({ item }) => onChange(formatMetricValue(Number(item.value), decimals))}
          selectedStyle={styles.wheelSelected}
          width="100%"
          renderItem={({ label, fontSize }) => (
            <Text style={[styles.wheelItemText, { fontSize: Math.min(fontSize, 23) }]}>{label}</Text>
          )}
        />
      </View>
    </View>
  );
}

function HeightRuler({
  value,
  min,
  max,
  onChange,
}: {
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  const listRef = useRef<FlatList<number>>(null);
  const [rulerWidth, setRulerWidth] = useState(0);
  const items = useMemo(() => Array.from({ length: max - min + 1 }, (_, index) => min + index), [max, min]);
  const selectedIndex = Math.min(max - min, Math.max(0, Math.round((parseMetricValue(value) || min) - min)));
  const sidePadding = Math.max((rulerWidth - RULER_TICK_WIDTH) / 2, 0);

  function scrollToIndex(index: number, animated = true) {
    listRef.current?.scrollToOffset({
      animated,
      offset: index * RULER_TICK_WIDTH,
    });
  }

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    setRulerWidth(nextWidth);
    requestAnimationFrame(() => scrollToIndex(selectedIndex, false));
  }

  function handleTextChange(text: string) {
    onChange(text.replace(/\D/g, ''));
  }

  function snapHeightFromText() {
    const nextValue = Math.round(snapMetricValue(value, min, max, 1));
    onChange(String(nextValue));
    scrollToIndex(nextValue - min);
  }

  function snapHeightFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.min(max - min, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / RULER_TICK_WIDTH)));
    onChange(String(min + index));
  }

  return (
    <View style={styles.metricWrap}>
      <View style={styles.metricValueWrap}>
        <TextInput
          keyboardType="numeric"
          onChangeText={handleTextChange}
          onEndEditing={snapHeightFromText}
          placeholder="0"
          placeholderTextColor="#43A66C"
          selectTextOnFocus
          style={styles.metricInput}
          value={value}
        />
        <Text style={styles.metricUnit}>cm</Text>
      </View>

      <View onLayout={handleLayout} style={styles.rulerWrap}>
        <FlatList
          ref={listRef}
          data={items}
          horizontal
          keyExtractor={(item) => String(item)}
          showsHorizontalScrollIndicator={false}
          snapToInterval={RULER_TICK_WIDTH}
          decelerationRate="fast"
          bounces={false}
          onMomentumScrollEnd={snapHeightFromScroll}
          onScrollEndDrag={snapHeightFromScroll}
          getItemLayout={(_, index) => ({
            length: RULER_TICK_WIDTH,
            offset: RULER_TICK_WIDTH * index,
            index,
          })}
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          renderItem={({ item }) => {
            const isMajorTick = item % 10 === 0;
            const isMiddleTick = item % 5 === 0;

            return (
              <View style={styles.rulerTick}>
                <View
                  style={[
                    styles.rulerTickLine,
                    isMiddleTick && styles.rulerTickLineMid,
                    isMajorTick && styles.rulerTickLineTall,
                  ]}
                />
                {isMajorTick && <Text style={styles.rulerTickLabel}>{item}</Text>}
              </View>
            );
          }}
        />
        <View pointerEvents="none" style={styles.rulerCenterMarker} />
      </View>
    </View>
  );
}

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { updateProfile } = useAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [edad, setEdad] = useState('25');
  const [peso, setPeso] = useState('70');
  const [altura, setAltura] = useState('170');
  const [genero, setGenero] = useState('');
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [restricciones, setRestricciones] = useState<string[]>([]);
  const [ingredientesFavoritos, setIngredientesFavoritos] = useState<string[]>([]);
  const [favoritoInput, setFavoritoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const completedCount = useMemo(() => {
    const checks = [
      parseMetricValue(edad) > 0,
      parseMetricValue(peso) > 0,
      parseMetricValue(altura) > 0,
      genero.length > 0,
      objetivos.length > 0,
      true,
      ingredientesFavoritos.length > 0,
    ];
    return checks.filter(Boolean).length;
  }, [altura, edad, genero, ingredientesFavoritos.length, objetivos.length, peso]);

  const toggleObjetivo = (option: string) => {
    setObjetivos((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
    setMsg('');
  };

  const toggleRestriccion = (option: string) => {
    setRestricciones((prev) => (prev.includes(option) ? prev.filter((r) => r !== option) : [...prev, option]));
    setMsg('');
  };

  const toggleFavorito = (option: string) => {
    setIngredientesFavoritos((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
    setMsg('');
  };

  const addFavorito = () => {
    const next = favoritoInput.trim();
    if (!next) return;
    setIngredientesFavoritos((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setFavoritoInput('');
    setMsg('');
  };

  function validateCurrentStep() {
    if (currentStep.id === 'genero' && !genero) {
      return 'Elige tu genero para continuar';
    }
    if (currentStep.id === 'objetivos' && objetivos.length === 0) {
      return 'Selecciona al menos un objetivo nutricional';
    }
    return '';
  }

  function goNext() {
    const validationMsg = validateCurrentStep();
    if (validationMsg) {
      setMsg(validationMsg);
      setError(true);
      return;
    }

    setMsg('');
    setError(false);

    if (isLastStep) {
      handleSaveProfile();
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setMsg('');
    setError(false);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }

  const handleSaveProfile = async () => {
    if (!genero) {
      setMsg('Elige tu genero para completar el perfil');
      setError(true);
      setStepIndex(STEPS.findIndex((step) => step.id === 'genero'));
      return;
    }

    if (objetivos.length === 0) {
      setMsg('Selecciona al menos un objetivo nutricional');
      setError(true);
      setStepIndex(STEPS.findIndex((step) => step.id === 'objetivos'));
      return;
    }

    setLoading(true);
    setError(false);
    setMsg('');

    const result = await updateProfile({
      edad: parseInt(edad, 10) || 0,
      peso: parseMetricValue(peso),
      altura: parseMetricValue(altura),
      genero: genero.trim().toLowerCase(),
      objetivos,
      restricciones,
      ingredientes_favoritos: ingredientesFavoritos,
    });

    if (result.success) {
      setMsg('Perfil guardado exitosamente');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 900);
    } else {
      setMsg(result.error || 'Error al guardar el perfil');
      setError(true);
    }

    setLoading(false);
  };

  function renderStepContent() {
    if (currentStep.id === 'edad') {
      return <MetricWheel decimals={0} max={100} min={10} onChange={setEdad} step={1} unit="años" value={edad} />;
    }

    if (currentStep.id === 'peso') {
      return <MetricWheel decimals={1} max={200} min={30} onChange={setPeso} step={0.5} unit="kg" value={peso} />;
    }

    if (currentStep.id === 'altura') {
      return <HeightRuler max={230} min={100} onChange={setAltura} value={altura} />;
    }

    if (currentStep.id === 'genero') {
      return (
        <View style={styles.genderStack}>
          {GENEROS.map((item) => {
            const isSelected = genero === item.label;
            return (
              <Pressable
                accessibilityRole="button"
                key={item.label}
                onPress={() => {
                  setGenero(item.label);
                  setMsg('');
                }}
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}>
                <View style={styles.optionIcon}>
                  <Ionicons name={item.icon} size={22} color={isSelected ? '#064E2F' : '#2F7A4F'} />
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item.label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color="#064E2F" />}
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (currentStep.id === 'objetivos') {
      return <ChipSelector accentColor="#00B86B" onToggle={toggleObjetivo} options={OBJETIVOS_OPTIONS} selected={objetivos} />;
    }

    if (currentStep.id === 'restricciones') {
      return (
        <ChipSelector
          accentColor="#60a5fa"
          onToggle={toggleRestriccion}
          options={RESTRICCIONES_OPTIONS}
          selected={restricciones}
        />
      );
    }

    return (
      <View style={styles.favoriteStack}>
        <View style={styles.addBar}>
          <TextInput
            autoCapitalize="words"
            onChangeText={setFavoritoInput}
            onSubmitEditing={addFavorito}
            placeholder="Agregar ingrediente"
            placeholderTextColor="#2F7A4F"
            returnKeyType="done"
            style={styles.favoriteInput}
            value={favoritoInput}
          />
          <Pressable accessibilityRole="button" onPress={addFavorito} style={styles.addButton}>
            <Ionicons name="add" size={22} color="#064E2F" />
          </Pressable>
        </View>

        <ChipSelector
          accentColor="#00B86B"
          onToggle={toggleFavorito}
          options={[...FAVORITOS_SUGERIDOS, ...ingredientesFavoritos.filter((item) => !FAVORITOS_SUGERIDOS.includes(item))]}
          selected={ingredientesFavoritos}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <View style={styles.progressPanel}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{progress}% completo</Text>
              <Text style={styles.progressMeta}>
                {stepIndex + 1}/{STEPS.length}
              </Text>
            </View>
            <View style={styles.progressShell}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          {msg !== '' && (
            <View style={[styles.messagePanel, error && styles.messagePanelError]}>
              <Ionicons name={error ? 'alert-circle' : 'checkmark-circle'} size={20} color={error ? '#FF8A8A' : '#00B86B'} />
              <Text style={[styles.statusText, error && styles.errorText]}>{msg}</Text>
            </View>
          )}

          <View style={styles.stepPanel}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIcon}>
                <MaterialCommunityIcons name={currentStep.icon} size={30} color="#064E2F" />
              </View>
              <Text style={styles.title}>{currentStep.title}</Text>
            </View>
            <Text style={styles.subtitle}>{currentStep.subtitle}</Text>

            <View style={styles.stepContent}>{renderStepContent()}</View>
          </View>

          <View style={styles.footer}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryLabel}>{currentStep.category}</Text>
              <Text style={styles.categoryMeta}>{completedCount} datos listos</Text>
            </View>

            <View style={styles.navRow}>
              <Pressable
                accessibilityRole="button"
                disabled={stepIndex === 0 || loading}
                onPress={goBack}
                style={[styles.navButton, styles.secondaryButton, stepIndex === 0 && styles.buttonDisabled]}>
                <Ionicons name="chevron-back" size={20} color="#064E2F" />
                <Text style={styles.secondaryButtonText}>Atrás</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={goNext}
                style={[styles.navButton, styles.primaryButton, loading && styles.buttonDisabled]}>
                {loading ? (
                  <ActivityIndicator color="#FBFFF8" />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>{isLastStep ? 'Guardar' : 'Siguiente'}</Text>
                    <Ionicons name={isLastStep ? 'checkmark' : 'chevron-forward'} size={20} color="#FBFFF8" />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: '#DDF8E7',
  },
  addButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  categoryBadge: {
    gap: 3,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  categoryLabel: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  categoryMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  chip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  chipText: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  content: {
    flex: 1,
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: '#FBFFF8',
  },
  errorText: {
    color: '#FF8A8A',
  },
  favoriteInput: {
    flex: 1,
    minWidth: 0,
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 12,
  },
  favoriteStack: {
    gap: 14,
    backgroundColor: 'transparent',
  },
  footer: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  genderStack: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  messagePanel: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  messagePanelError: {
    borderColor: '#8D2B3D',
    backgroundColor: '#351928',
  },
  metricInput: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
    minWidth: 62,
    padding: 0,
    textAlign: 'center',
  },
  metricUnit: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '800',
  },
  metricValueWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  metricWrap: {
    gap: 16,
    backgroundColor: 'transparent',
  },
  navButton: {
    minHeight: 56,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  optionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  optionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  optionRowSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#DFF2E6',
  },
  optionText: {
    flex: 1,
    color: '#2F7A4F',
    fontSize: 16,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: '#064E2F',
  },
  primaryButton: {
    backgroundColor: '#00B86B',
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FBFFF8',
    fontSize: 16,
    fontWeight: '900',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#00B86B',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  progressMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '800',
  },
  progressPanel: {
    gap: 10,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  progressShell: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
  },
  progressText: {
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
  },
  rulerCenterMarker: {
    position: 'absolute',
    top: 18,
    bottom: 34,
    left: '50%',
    width: 3,
    marginLeft: -1.5,
    borderRadius: 999,
    backgroundColor: '#00B86B',
  },
  rulerTick: {
    width: RULER_TICK_WIDTH,
    height: 118,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  rulerTickLabel: {
    marginTop: 12,
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  rulerTickLine: {
    width: 2,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#86E0A6',
  },
  rulerTickLineMid: {
    height: 34,
    backgroundColor: '#5FD58B',
  },
  rulerTickLineTall: {
    height: 48,
    backgroundColor: '#00B86B',
  },
  rulerWrap: {
    height: 132,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  secondaryButtonText: {
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
  },
  statusText: {
    flex: 1,
    color: '#00B86B',
    fontSize: 14,
    fontWeight: '800',
  },
  stepContent: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  stepIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#9FE7B9',
  },
  stepPanel: {
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    padding: 18,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  title: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  wheelItemText: {
    color: '#064E2F',
    fontWeight: '900',
    textAlign: 'center',
  },
  wheelSelected: {
    borderColor: '#00B86B',
    borderWidth: 1,
  },
  wheelWrap: {
    height: 210,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
