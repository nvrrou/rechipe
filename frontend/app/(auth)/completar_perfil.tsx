import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';

type MetricKey = 'edad' | 'peso' | 'altura';

function parseMetricValue(value: string) {
  return Number(value.replace(',', '.')) || 0;
}

function formatMetricValue(value: number, decimals = 0) {
  const formatted = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return formatted.replace('.', ',');
}

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

function MetricSlider({
  label,
  value,
  unit,
  icon,
  min,
  max,
  step,
  decimals = 0,
  onChange,
}: {
  label: string;
  value: string;
  unit: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (value: string) => void;
}) {
  const trackRef = useRef<View>(null);
  const numericValue = parseMetricValue(value);
  const clampedValue = Math.min(max, Math.max(min, numericValue || min));
  const progress = ((clampedValue - min) / (max - min)) * 100;

  function updateFromPageX(pageX: number) {
    trackRef.current?.measure((_x, _y, width, _height, pageLeft) => {
      if (!width) return;
      const ratio = Math.min(1, Math.max(0, (pageX - pageLeft) / width));
      const rawValue = min + ratio * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      const nextValue = Math.min(max, Math.max(min, steppedValue));
      onChange(formatMetricValue(nextValue, decimals));
    });
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => updateFromPageX(event.nativeEvent.pageX),
      onPanResponderMove: (event) => updateFromPageX(event.nativeEvent.pageX),
    })
  ).current;

  function handleTextChange(text: string) {
    const normalizedText = decimals > 0 ? text.replace(/[^\d,.]/g, '').replace('.', ',') : text.replace(/\D/g, '');
    const parts = normalizedText.split(',');
    const nextText =
      decimals > 0 && parts.length > 1 ? `${parts[0]},${parts.slice(1).join('').slice(0, decimals)}` : normalizedText;

    onChange(nextText);
  }

  return (
    <View style={styles.metricField}>
      <View style={styles.metricHeader}>
        <View style={styles.metricIcon}>
          <MaterialCommunityIcons name={icon} size={22} color="#FFFFFF" />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>

      <View style={styles.metricValueWrap}>
        <TextInput
          keyboardType={decimals > 0 ? 'decimal-pad' : 'numeric'}
          onChangeText={handleTextChange}
          placeholder="0"
          placeholderTextColor="#6B7280"
          selectTextOnFocus
          style={styles.metricInput}
          value={value}
        />
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>

      <View style={styles.sliderBlock}>
        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>{formatMetricValue(min, decimals)}</Text>
          <Text style={styles.sliderRangeText}>{formatMetricValue(max, decimals)}</Text>
        </View>
        <View ref={trackRef} style={styles.sliderTrack} {...panResponder.panHandlers}>
          <View style={[styles.sliderFill, { width: `${progress}%` }]} />
          <View style={[styles.sliderThumb, { left: `${progress}%` }]} />
        </View>
      </View>
    </View>
  );
}

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { updateProfile } = useAuth();

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

  const profileProgress = useMemo(() => {
    const checks = [
      parseMetricValue(edad) > 0,
      parseMetricValue(peso) > 0,
      parseMetricValue(altura) > 0,
      genero.length > 0,
      objetivos.length > 0,
      ingredientesFavoritos.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [edad, peso, altura, genero, objetivos.length, ingredientesFavoritos.length]);

  const metrics: Array<{
    key: MetricKey;
    label: string;
    value: string;
    unit: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onChange: (value: string) => void;
  }> = [
    { key: 'edad', label: 'Edad', value: edad, unit: 'años', icon: 'calendar-heart', onChange: setEdad },
    { key: 'peso', label: 'Peso', value: peso, unit: 'kg', icon: 'scale-bathroom', onChange: setPeso },
    { key: 'altura', label: 'Altura', value: altura, unit: 'cm', icon: 'human-male-height', onChange: setAltura },
  ];

  const toggleObjetivo = (option: string) => {
    setObjetivos((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  };

  const toggleRestriccion = (option: string) => {
    setRestricciones((prev) => (prev.includes(option) ? prev.filter((r) => r !== option) : [...prev, option]));
  };

  const toggleFavorito = (option: string) => {
    setIngredientesFavoritos((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]
    );
  };

  const addFavorito = () => {
    const next = favoritoInput.trim();
    if (!next) return;
    setIngredientesFavoritos((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setFavoritoInput('');
  };

  const handleSaveProfile = async () => {
    if (!genero) {
      setMsg('Elige tu genero para completar el perfil');
      setError(true);
      return;
    }

    if (objetivos.length === 0) {
      setMsg('Selecciona al menos un objetivo nutricional');
      setError(true);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.titleRow}>
              <View style={styles.logoMark}>
                <MaterialCommunityIcons name="food-apple-outline" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Tu perfil</Text>
                <Text style={styles.subtitle}>Ajusta tus datos para personalizar recetas y porciones.</Text>
              </View>
            </View>
            <View style={styles.progressShell}>
              <View style={[styles.progressFill, { width: `${profileProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{profileProgress}% completo</Text>
          </View>

          {msg !== '' && (
            <View style={[styles.messagePanel, error && styles.messagePanelError]}>
              <Ionicons name={error ? 'alert-circle' : 'checkmark-circle'} size={20} color={error ? '#f87171' : '#4ade80'} />
              <Text style={[styles.statusText, error && styles.errorText]}>{msg}</Text>
            </View>
          )}

          <View style={styles.detailPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Datos personales</Text>
                <Text style={styles.panelSubtitle}>Completa cada campo en orden.</Text>
              </View>
            </View>

            <View style={styles.formStack}>
            {metrics.map((metric) => (
              <MetricSlider
                decimals={metric.key === 'peso' ? 1 : 0}
                icon={metric.icon}
                key={metric.key}
                label={metric.label}
                max={metric.key === 'edad' ? 100 : metric.key === 'peso' ? 200 : 230}
                min={metric.key === 'edad' ? 10 : metric.key === 'peso' ? 30 : 120}
                onChange={metric.onChange}
                step={metric.key === 'peso' ? 0.5 : 1}
                unit={metric.unit}
                value={metric.value}
              />
            ))}
            </View>
          </View>

          <View style={styles.detailPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <Ionicons name="person-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Genero</Text>
                <Text style={styles.panelSubtitle}>Usado para calcular recomendaciones iniciales.</Text>
              </View>
            </View>

            <View style={styles.genderRow}>
              {GENEROS.map((item) => {
                const isSelected = genero === item.label;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={item.label}
                    onPress={() => setGenero(item.label)}
                    style={[styles.genderChip, isSelected && styles.genderChipSelected]}>
                    <Ionicons name={item.icon} size={20} color={isSelected ? '#FFFFFF' : '#9CA3AF'} />
                    <Text style={[styles.genderChipText, isSelected && styles.genderChipTextSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.detailPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <MaterialCommunityIcons name="target" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Objetivos</Text>
                <Text style={styles.panelSubtitle}>{objetivos.length || 'Sin'} seleccionado{objetivos.length === 1 ? '' : 's'}</Text>
              </View>
            </View>
            <ChipSelector options={OBJETIVOS_OPTIONS} selected={objetivos} onToggle={toggleObjetivo} accentColor="#4ade80" />
          </View>

          <View style={styles.detailPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Restricciones</Text>
                <Text style={styles.panelSubtitle}>Opcional, pero ayuda a filtrar recetas.</Text>
              </View>
            </View>
            <ChipSelector
              options={RESTRICCIONES_OPTIONS}
              selected={restricciones}
              onToggle={toggleRestriccion}
              accentColor="#60a5fa"
            />
          </View>

          <View style={styles.detailPanel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.panelTitle}>Favoritos</Text>
                <Text style={styles.panelSubtitle}>Ingredientes que quieres ver más seguido.</Text>
              </View>
            </View>

            <View style={styles.addBar}>
              <TextInput
                autoCapitalize="words"
                onChangeText={setFavoritoInput}
                onSubmitEditing={addFavorito}
                placeholder="Agregar ingrediente"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                style={styles.favoriteInput}
                value={favoritoInput}
              />
              <Pressable accessibilityRole="button" onPress={addFavorito} style={styles.addButton}>
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </Pressable>
            </View>

            <ChipSelector
              options={[...FAVORITOS_SUGERIDOS, ...ingredientesFavoritos.filter((item) => !FAVORITOS_SUGERIDOS.includes(item))]}
              selected={ingredientesFavoritos}
              onToggle={toggleFavorito}
              accentColor="#F97316"
            />
          </View>

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSaveProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="#0B0B0B" /> : <Text style={styles.buttonText}>Guardar perfil</Text>}
          </TouchableOpacity>
        </ScrollView>
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  addButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  button: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '900',
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
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  chipText: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 48,
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
  errorText: {
    color: '#f87171',
  },
  favoriteInput: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 12,
  },
  formStack: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  genderChip: {
    flex: 1,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  genderChipSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2A2A2A',
  },
  genderChipText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  genderChipTextSelected: {
    color: '#FFFFFF',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
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
  logoMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
  },
  messagePanel: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#235D38',
    backgroundColor: '#102017',
  },
  messagePanelError: {
    borderColor: '#7F1D1D',
    backgroundColor: '#241313',
  },
  metricField: {
    width: '100%',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#101010',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  metricIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  metricInput: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    minWidth: 54,
    padding: 0,
    textAlign: 'center',
  },
  metricLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  metricUnit: {
    color: '#B8B8B8',
    fontSize: 13,
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
  sliderBlock: {
    gap: 8,
    backgroundColor: 'transparent',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  sliderRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  sliderRangeText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },
  sliderThumb: {
    position: 'absolute',
    top: -7,
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#171717',
    backgroundColor: '#FFFFFF',
  },
  sliderTrack: {
    height: 10,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
  },
  panelCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  panelIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
  },
  panelSubtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '600',
  },
  panelTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  progressShell: {
    height: 8,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#2A2A2A',
  },
  progressText: {
    color: '#B8B8B8',
    fontSize: 13,
    fontWeight: '800',
  },
  roundButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0B0B',
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
  statusText: {
    flex: 1,
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: '#B8B8B8',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  titleCopy: {
    flex: 1,
    gap: 5,
    backgroundColor: 'transparent',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
});
