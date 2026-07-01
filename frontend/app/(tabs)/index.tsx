import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { savePreparationRecipe } from '@/services/preparation';
import { WeeklyMeal, WeeklyPlan, WeeklyPlanDay, fetchLatestWeeklyPlan, generateWeeklyPlan } from '@/services/budget';
import { GeneratedRecipe } from '@/services/recipes';

const WEEKDAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function normalizeDayName(value?: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getTodayPlanIndex(days: WeeklyPlanDay[] = []) {
  const todayMondayIndex = (new Date().getDay() + 6) % 7;
  const todayName = WEEKDAY_ORDER[todayMondayIndex];
  const matchingIndex = days.findIndex((day) => normalizeDayName(day.dia) === todayName);
  if (matchingIndex >= 0) return matchingIndex;
  return Math.min(todayMondayIndex, Math.max(days.length - 1, 0));
}

export default function WeeklyPlannerScreen() {
  const { user } = useAuth();
  const { colorScheme } = useThemePreference();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const darkIconColor = isDark ? '#EAFBF0' : '#064E2F';
  const darkMutedIconColor = isDark ? '#BDF7D2' : '#2F7A4F';
  const [weeklyWishes, setWeeklyWishes] = useState('');
  const [allowIntermediateMeals, setAllowIntermediateMeals] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const activeDay: WeeklyPlanDay | undefined = plan?.dias?.[selectedDayIndex];

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadPlannerData() {
        if (!user?.id) return;
        const planResult = await fetchLatestWeeklyPlan(user.id);
        if (!active) return;
        if (planResult.plan) {
          const days = planResult.plan.dias || [];
          setPlan(planResult.plan);
          setSelectedDayIndex(getTodayPlanIndex(days));
        }
      }
      loadPlannerData();
      return () => {
        active = false;
      };
    }, [user?.id])
  );

  async function prepareWeeklyMeal(meal: WeeklyMeal) {
    if (!user?.id) {
      setMessage('No hay usuario activo.');
      return;
    }

    const recipe: GeneratedRecipe = {
      id: meal.recipe_id,
      titulo: meal.titulo,
      tiempo_preparacion: meal.tiempo_preparacion,
      por_que_funciona: meal.por_que,
      macros_totales: meal.macros_totales,
      ingredientes: meal.ingredientes || [],
      pasos: meal.pasos || [],
      costo_estimado: meal.costo_estimado,
    };

    await savePreparationRecipe({
      receta: recipe,
      compras_sugeridas: [],
      compras_receta: [],
      restricciones: [],
      tipo_comida: meal.tipo,
      weekly_plan_id: meal.plan_id || plan?.id,
      weekly_meal_id: meal.id,
    });
    router.push('/(navbarnt)/preparacion');
  }

  async function handleGeneratePlan() {
    if (!user?.id) {
      setMessage('No hay usuario activo.');
      return;
    }

    setLoading(true);
    setMessage('');
    setSelectedDayIndex(0);
    const result = await generateWeeklyPlan({
      user_id: user.id,
      usar_presupuesto_perfil: false,
      preferencias_semana: weeklyWishes.trim(),
      permitir_comidas_intermedias: allowIntermediateMeals,
      dias: 7,
      comidas_por_dia: 3,
    });

    if (result.error) {
      setMessage(result.error);
    } else {
      setPlan(result);
      setSelectedDayIndex(getTodayPlanIndex(result.dias || []));
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.calendarIcon}>
            <MaterialCommunityIcons name="calendar-week-outline" size={30} color="#064E2F" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Planificacion semanal</Text>
            <Text style={styles.subtitle}>Comidas y colaciones segun tu perfil y lo que tienes en despensa.</Text>
          </View>
        </View>

        <View style={[styles.plannerPanel, isDark && styles.darkPanel]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allowIntermediateMeals }}
            onPress={() => setAllowIntermediateMeals((current) => !current)}
            style={[
              styles.optionToggle,
              isDark && styles.darkCard,
              allowIntermediateMeals && styles.optionToggleActive,
              isDark && allowIntermediateMeals && styles.darkCardActive,
            ]}>
            <MaterialCommunityIcons
              name={allowIntermediateMeals ? 'check-circle' : 'circle-outline'}
              size={22}
              color={allowIntermediateMeals ? darkIconColor : darkMutedIconColor}
            />
            <View style={styles.optionToggleCopy}>
              <Text style={styles.optionToggleTitle}>Comidas intermedias</Text>
              <Text style={styles.optionToggleText}>Recomendado si quieres mayor cantidad de macros totales</Text>
            </View>
          </Pressable>

          <View style={[styles.weeklyWishesBox, isDark && styles.darkCard]}>
            <View style={styles.weeklyWishesHeader}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={darkMutedIconColor} />
              <Text style={styles.weeklyWishesTitle}>Cosas que quiero esta semana</Text>
            </View>
            <TextInput
              multiline
              onChangeText={setWeeklyWishes}
              placeholder="Ej: desayunos rapidos, pasta el viernes, mas proteina, evitar arroz..."
              placeholderTextColor={isDark ? '#8EDBA9' : '#4F9F70'}
              style={[styles.weeklyWishesInput, isDark && styles.darkInput]}
              textAlignVertical="top"
              value={weeklyWishes}
            />
          </View>

          <Pressable accessibilityRole="button" onPress={handleGeneratePlan} style={styles.generateButton} disabled={loading}>
            {loading ? <ActivityIndicator color="#FBFFF8" /> : <MaterialCommunityIcons name="creation" size={20} color="#FBFFF8" />}
            <Text style={styles.generateButtonText}>{loading ? 'Generando plan...' : 'Generar semana'}</Text>
          </Pressable>
        </View>

        {message !== '' && (
          <View style={styles.messageBox}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#064E2F" />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {plan?.dias?.length ? (
          <View style={[styles.planPanel, isDark && styles.darkPanel]}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.sectionTitle}>Semana generada</Text>
                <Text style={styles.choiceText}>{plan.resumen || 'Plan balanceado listo para revisar.'}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
              {plan.dias.map((day, index) => {
                const selected = index === selectedDayIndex;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={`${day.dia}-${index}`}
                    onPress={() => setSelectedDayIndex(index)}
                    style={[
                      styles.dayChip,
                      isDark && styles.darkCard,
                      selected && styles.dayChipActive,
                      isDark && selected && styles.darkCardActive,
                    ]}>
                    <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>{day.dia.slice(0, 3)}</Text>
                    <Text style={[styles.dayCost, selected && styles.dayChipTextActive]}>{Math.round(Number(day.calorias_estimadas || 0))} kcal</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activeDay && (
              <View style={styles.dayDetail}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{activeDay.dia}</Text>
                  <Text style={styles.choiceText}>Solo despensa</Text>
                </View>
                <View style={styles.macroGrid}>
                  <View style={[styles.macroItem, isDark && styles.darkCardSoft]}>
                    <Text style={styles.macroValue}>{Math.round(Number(activeDay.calorias_estimadas || 0))}</Text>
                    <Text style={styles.macroLabel}>kcal</Text>
                  </View>
                  <View style={[styles.macroItem, isDark && styles.darkCardSoft]}>
                    <Text style={styles.macroValue}>{Math.round(Number(activeDay.proteinas_g || 0))}g</Text>
                    <Text style={styles.macroLabel}>Proteina</Text>
                  </View>
                  <View style={[styles.macroItem, isDark && styles.darkCardSoft]}>
                    <Text style={styles.macroValue}>{Math.round(Number(activeDay.carbohidratos_g || 0))}g</Text>
                    <Text style={styles.macroLabel}>Carbos</Text>
                  </View>
                  <View style={[styles.macroItem, isDark && styles.darkCardSoft]}>
                    <Text style={styles.macroValue}>{Math.round(Number(activeDay.grasas_g || 0))}g</Text>
                    <Text style={styles.macroLabel}>Grasas</Text>
                  </View>
                </View>
                {(activeDay.comidas || []).map((meal, index) => (
                  <View key={`${meal.tipo}-${index}`} style={[styles.mealCard, isDark && styles.darkCardSoft]}>
                    <View style={styles.mealTop}>
                      <Text style={styles.mealType}>{meal.tipo}</Text>
                    </View>
                    <Text style={styles.mealTitle}>{meal.titulo}</Text>
                    {!!meal.por_que && <Text style={styles.mealReason}>{meal.por_que}</Text>}
                    <View style={styles.mealMacroRow}>
                    <Text style={[styles.mealMacroText, isDark && styles.darkPill]}> {Math.round(Number(meal.macros_totales?.calorias || 0))} kcal</Text>
                    <Text style={[styles.mealMacroText, isDark && styles.darkPill]}>P {Math.round(Number(meal.macros_totales?.proteinas || 0))}g</Text>
                    <Text style={[styles.mealMacroText, isDark && styles.darkPill]}>C {Math.round(Number(meal.macros_totales?.carbohidratos || 0))}g</Text>
                    <Text style={[styles.mealMacroText, isDark && styles.darkPill]}>G {Math.round(Number(meal.macros_totales?.grasas || 0))}g</Text>
                    </View>
                    {(meal.ingredientes || []).slice(0, 4).map((ingredient) => (
                      <Text key={ingredient} style={styles.ingredientLine}>• {ingredient}</Text>
                    ))}
                    <Pressable accessibilityRole="button" onPress={() => prepareWeeklyMeal(meal)} style={styles.prepareMealButton}>
                      <MaterialCommunityIcons name="chef-hat" size={17} color="#FBFFF8" />
                      <Text style={styles.prepareMealButtonText}>Preparar</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyPanel}>
            <MaterialCommunityIcons name="calendar-plus" size={42} color="#43A66C" />
            <Text style={styles.emptyTitle}>Arma tu semana sin sobrepensar</Text>
            <Text style={styles.emptyText}>Una sola generacion crea los 7 dias para mantenerlo rapido y usable.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  plannerPanel: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  calendarIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#9FE7B9',
  },
  choiceText: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 140,
  },
  dayChip: {
    minWidth: 84,
    gap: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  dayChipActive: {
    borderColor: '#00B86B',
    backgroundColor: '#00B86B',
  },
  dayChipText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  dayChipTextActive: {
    color: '#FBFFF8',
  },
  dayCost: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  dayDetail: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  darkCard: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  darkCardActive: {
    borderColor: '#20D684',
    backgroundColor: '#00B86B',
  },
  darkCardSoft: {
    backgroundColor: '#173321',
  },
  darkInput: {
    color: '#EAFBF0',
  },
  darkPanel: {
    borderColor: '#2F7A4F',
    backgroundColor: '#0B1C12',
  },
  darkPill: {
    color: '#EAFBF0',
    backgroundColor: '#245C38',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  dayTitle: {
    color: '#064E2F',
    fontSize: 22,
    fontWeight: '900',
  },
  daysRow: {
    gap: 10,
  },
  emptyPanel: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  generateButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#00B86B',
  },
  generateButtonText: {
    color: '#FBFFF8',
    fontSize: 16,
    fontWeight: '900',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'transparent',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  ingredientLine: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 12,
  },
  inputShell: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  weeklyWishesBox: {
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  weeklyWishesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  weeklyWishesInput: {
    minHeight: 76,
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    padding: 0,
  },
  weeklyWishesTitle: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  mealCard: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  macroItem: {
    flexGrow: 1,
    minWidth: '22%',
    gap: 2,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#DDF8E7',
  },
  macroLabel: {
    color: '#2F7A4F',
    fontSize: 11,
    fontWeight: '800',
  },
  macroValue: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  mealCost: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '900',
  },
  mealMacroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  mealMacroText: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    color: '#064E2F',
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: '#9FE7B9',
  },
  mealReason: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  mealTitle: {
    color: '#064E2F',
    fontSize: 17,
    fontWeight: '900',
  },
  mealTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  mealType: {
    color: '#00B86B',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  messageText: {
    flex: 1,
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '800',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'transparent',
  },
  optionToggle: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  optionToggleActive: {
    borderColor: '#00B86B',
    backgroundColor: '#D8FBE3',
  },
  optionToggleCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  optionToggleText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
  optionToggleTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  planPanel: {
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  prepareMealButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: '#00B86B',
  },
  prepareMealButtonText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  pricePill: {
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '900',
    backgroundColor: '#9FE7B9',
  },
  sectionTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  title: {
    color: '#064E2F',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
});
