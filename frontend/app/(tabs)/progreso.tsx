import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useAuth } from '@/contexts/AuthContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { DespensaItemData, fetchDespensa } from '@/services/despensa';
import { savePreparationRecipe } from '@/services/preparation';
import { BudgetPurchaseSuggestion, GeneratedRecipe, prepareRecipeForUser } from '@/services/recipes';
import {
  GroupMember,
  SocialGroup,
  createGroup,
  fetchGroupDetail,
  fetchGroupRecipeHistory,
  fetchGroups,
  generateBudgetGroupRecipes,
  generateGroupRecipes,
  joinGroup,
  kickGroupMember,
  updateGroupMemberAccepted,
  updateGroupMemberRole,
} from '@/services/social';

type MealType = {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const MEAL_TYPES: MealType[] = [
  { id: 'Desayuno', label: 'Desayuno', icon: 'coffee-outline' },
  { id: 'Almuerzo', label: 'Almuerzo', icon: 'silverware-fork-knife' },
  { id: 'Cena', label: 'Cena', icon: 'food-turkey' },
  { id: 'Snack', label: 'Snack', icon: 'food-apple-outline' },
  { id: 'Meal prep', label: 'Meal prep', icon: 'calendar-clock' },
];

const QUICK_OBJECTIVES = ['Alto en proteinas', 'Bajo en calorias', 'Barato', 'Rapido', 'Equilibrado'];
const ROLE_FLOW: Array<'espectador' | 'editor' | 'admin'> = ['espectador', 'editor', 'admin'];

function roleIcon(role: 'admin' | 'editor' | 'espectador'): keyof typeof MaterialCommunityIcons.glyphMap {
  if (role === 'admin') return 'shield-account-outline';
  if (role === 'editor') return 'pencil';
  return 'eye-outline';
}

function parseBudget(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPrice(value?: number | null) {
  if (!value) return 'CLP 0';
  return `CLP ${Math.round(value).toLocaleString('es-CL')}`;
}

function formatHistoryDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' }).format(date);
}

function initials(value?: string) {
  const clean = (value || 'U').trim();
  return clean.charAt(0).toUpperCase();
}

function itemSubtitle(item: DespensaItemData) {
  return [item.categoria, item.cantidad ? `${item.cantidad} ${item.unidad || ''}`.trim() : undefined]
    .filter(Boolean)
    .join(' - ');
}

export default function ProgressScreen() {
  const { user } = useAuth();
  const { colorScheme } = useThemePreference();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const darkIconColor = isDark ? '#EAFBF0' : '#064E2F';
  const darkSecondaryIconColor = isDark ? '#BDF7D2' : '#2F7A4F';
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<SocialGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myRole, setMyRole] = useState<'admin' | 'editor' | 'espectador'>('espectador');
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [items, setItems] = useState<DespensaItemData[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(MEAL_TYPES[1].id);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [objective, setObjective] = useState('');
  const [extraRestrictions, setExtraRestrictions] = useState('');
  const [isBudgeted, setIsBudgeted] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [purchaseSuggestions, setPurchaseSuggestions] = useState<BudgetPurchaseSuggestion[]>([]);
  const [historyItems, setHistoryItems] = useState<GeneratedRecipe[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usingRecipeKey, setUsingRecipeKey] = useState<string | null>(null);
  const [roleMenuMember, setRoleMenuMember] = useState<GroupMember | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );
  const currentGroup = activeGroup || selectedGroup;
  const isGroupView = selectedGroupId !== null;

  const isAdmin = myRole === 'admin';
  const canEdit = myRole === 'admin' || myRole === 'editor';
  const acceptedMembers = useMemo(() => members.filter((member) => member.accepted !== false), [members]);
  const pendingMembers = useMemo(() => members.filter((member) => member.accepted === false), [members]);

  const filteredItems = useMemo(() => {
    const query = ingredientSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.nombre_producto, item.categoria, item.marca].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [ingredientSearch, items]);

  const selectedIngredients = useMemo(
    () => items.filter((item) => selectedIngredientIds.includes(item.id)),
    [items, selectedIngredientIds]
  );

  const activeRestrictions = useMemo(() => parseCommaList(extraRestrictions), [extraRestrictions]);

  const loadGroups = useCallback(async () => {
    if (!user?.id) return;
    setLoadingGroups(true);
    const result = await fetchGroups(user.id);
    if (result.items) {
      setGroups(result.items);
      if (selectedGroupId) {
        const refreshedGroup = result.items.find((group) => group.id === selectedGroupId);
        if (refreshedGroup?.accepted === false) {
          setActiveGroup(null);
          setSelectedGroupId(null);
        } else if (refreshedGroup) {
          setActiveGroup(refreshedGroup);
        }
      }
    } else if (result.error) {
      setError(result.error);
    }
    setLoadingGroups(false);
  }, [selectedGroupId, user?.id]);

  const loadDespensa = useCallback(async () => {
    if (!user?.id) return;
    setLoadingItems(true);
    const result = await fetchDespensa(user.id);
    if (result.items) {
      setItems(result.items);
    } else if (result.error) {
      setError(result.error);
    }
    setLoadingItems(false);
  }, [user?.id]);

  const loadGroupDetail = useCallback(async () => {
    if (!user?.id || !selectedGroupId) return;
    setLoadingDetail(true);
    const result = await fetchGroupDetail(selectedGroupId, user.id);
    if (result.miembros) {
      if (result.grupo) {
        setActiveGroup(result.grupo);
      }
      setMembers(result.miembros);
      setMyRole(result.mi_rol || 'espectador');
    } else if (result.error) {
      setError(result.error);
    }
    setLoadingDetail(false);
  }, [selectedGroupId, user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id || !selectedGroupId) return;
    setHistoryLoading(true);
    const result = await fetchGroupRecipeHistory(selectedGroupId, user.id);
    if (result.items) {
      setHistoryItems(result.items);
    } else if (result.error) {
      setError(result.error);
    }
    setHistoryLoading(false);
  }, [selectedGroupId, user?.id]);

  useEffect(() => {
    loadGroups();
    loadDespensa();
  }, [loadDespensa, loadGroups]);

  useEffect(() => {
    loadGroupDetail();
    loadHistory();
  }, [loadGroupDetail, loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
      loadDespensa();
      loadGroupDetail();
      loadHistory();
    }, [loadDespensa, loadGroupDetail, loadGroups, loadHistory])
  );

  async function handleCreateGroup() {
    if (!user?.id || creating) return;
    if (!groupName.trim()) {
      setError('Ponle un nombre al grupo.');
      return;
    }

    setCreating(true);
    setError('');
    setStatusMessage('');
    const result = await createGroup(user.id, groupName.trim());
    if (result.grupo?.id) {
      setGroupName('');
      setActiveGroup(result.grupo);
      setSelectedGroupId(result.grupo.id);
      await loadGroups();
    } else {
      setError(result.error || 'No se pudo crear el grupo.');
    }
    setCreating(false);
  }

  async function handleJoinGroup() {
    if (!user?.id || joining) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('El codigo debe tener 6 caracteres.');
      return;
    }

    setJoining(true);
    setError('');
    setStatusMessage('');
    const result = await joinGroup(user.id, code);
    if (result.grupo?.id) {
      setJoinCode('');
      if (result.miembro?.accepted === false) {
        setActiveGroup(null);
        setSelectedGroupId(null);
        setStatusMessage('Solicitud enviada. Un editor debe aceptarte para entrar al grupo.');
      } else {
        setActiveGroup(result.grupo);
        setSelectedGroupId(result.grupo.id);
      }
      await loadGroups();
    } else {
      setError(result.error || 'No se pudo unir al grupo.');
    }
    setJoining(false);
  }

  function toggleIngredient(id: string) {
    setSelectedIngredientIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function openGroup(group: SocialGroup) {
    if (group.accepted === false) {
      setError('');
      setStatusMessage('Este grupo esta esperando aprobacion de un editor.');
      return;
    }
    setStatusMessage('');
    setActiveGroup(group);
    setSelectedGroupId(group.id);
  }

  function closeGroup() {
    setSelectedGroupId(null);
    setActiveGroup(null);
    setMembers([]);
    setRecipes([]);
    setPurchaseSuggestions([]);
    setHistoryOpen(false);
    setUsingRecipeKey(null);
    setError('');
  }

  async function openHistory() {
    setHistoryOpen(true);
    await loadHistory();
  }

  function openRoleMenu(member: GroupMember) {
    if (!isAdmin || member.user_id === user?.id) return;
    setRoleMenuMember(member);
  }

  async function changeMemberRole(member: GroupMember, role: 'admin' | 'editor' | 'espectador') {
    if (!user?.id || !selectedGroupId || !isAdmin || member.user_id === user.id) return;
    setError('');
    setStatusMessage('');
    const result = await updateGroupMemberRole(selectedGroupId, member.user_id, user.id, role);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRoleMenuMember(null);
    await loadGroupDetail();
  }

  async function reviewMember(member: GroupMember, accepted: boolean) {
    if (!user?.id || !selectedGroupId || !isAdmin || member.user_id === user.id) return;
    setError('');
    setStatusMessage('');
    const result = await updateGroupMemberAccepted(selectedGroupId, member.user_id, user.id, accepted);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatusMessage(accepted ? 'Solicitud aceptada.' : 'Solicitud marcada como no aceptada.');
    await loadGroupDetail();
  }

  async function kickMember(member: GroupMember) {
    if (!user?.id || !selectedGroupId || !isAdmin || member.user_id === user.id) return;
    setError('');
    setStatusMessage('');
    const result = await kickGroupMember(selectedGroupId, member.user_id, user.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatusMessage(`${member.nombre} fue expulsado del grupo.`);
    await loadGroupDetail();
  }

  async function prepareRecipe(recipe: GeneratedRecipe) {
    if (!user?.id) return;
    const key = recipe.id || recipe.titulo;
    setUsingRecipeKey(key);
    setError('');
    setStatusMessage('');

    const prepared = await prepareRecipeForUser({
      user_id: user.id,
      receta: recipe,
    });

    if (prepared.error) {
      setError(prepared.error);
      setUsingRecipeKey(null);
      return;
    }

    await savePreparationRecipe({
      receta: prepared.receta || recipe,
      compras_sugeridas: prepared.compras_sugeridas || purchaseSuggestions,
      compras_receta: prepared.compras_receta || [],
      restricciones: activeRestrictions,
      tipo_comida: selectedMeal,
    });

    setUsingRecipeKey(null);
    setHistoryOpen(false);
    router.push('/(navbarnt)/preparacion');
  }

  async function handleGeneratePack() {
    if (!user?.id || !selectedGroupId || generating) return;
    if (!canEdit) {
      setError('Tu rol actual solo permite ver este grupo.');
      return;
    }

    const budget = parseBudget(budgetInput);
    if (isBudgeted && budget <= 0) {
      setError('Ingresa un presupuesto mayor a 0.');
      return;
    }

    setGenerating(true);
    setError('');
    setStatusMessage('');
    setRecipes([]);
    setPurchaseSuggestions([]);

    const payload = {
      user_id: user.id,
      tipo_comida: selectedMeal,
      ingredientes: selectedIngredients.map((item) => item.nombre_producto).filter(Boolean),
      objetivo_nutricional: objective.trim(),
      restricciones: activeRestrictions,
      presupuestada: isBudgeted,
      presupuesto: isBudgeted ? budget : undefined,
    };

    const result = isBudgeted
      ? await generateBudgetGroupRecipes(selectedGroupId, payload)
      : await generateGroupRecipes(selectedGroupId, payload);

    if (result.error) {
      setError(result.error);
    } else if (result.recetas?.length) {
      setRecipes(result.recetas);
      setPurchaseSuggestions(result.compras_sugeridas || []);
      await loadHistory();
    } else {
      setError('No llegaron recetas desde el backend.');
    }
    setGenerating(false);
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="account-group-outline" size={44} color="#00B86B" />
        <Text style={styles.emptyTitle}>Inicia sesion para usar grupos</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isGroupView && (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name="account-group-outline" size={28} color={darkIconColor} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.title}>Social</Text>
                <Text style={styles.subtitle}>Arma packs de comida para un grupo segun gustos, objetivos y roles.</Text>
              </View>
            </View>

            <View style={styles.setupGrid}>
              <View style={[styles.panel, isDark && styles.panelDark]}>
                <View style={styles.panelHeader}>
                  <View style={[styles.panelIcon, isDark && styles.panelIconDark]}>
                    <MaterialCommunityIcons name="plus" size={22} color={darkIconColor} />
                  </View>
                  <View style={styles.panelCopy}>
                    <Text style={styles.panelTitle}>Crear grupo</Text>
                    <Text style={styles.panelSubtitle}>Genera un codigo de 6 caracteres.</Text>
                  </View>
                </View>
                <TextInput
                  onChangeText={setGroupName}
                  placeholder="Nombre del grupo"
                  placeholderTextColor="#43A66C"
                  style={[styles.textInput, isDark && styles.textInputDark]}
                  value={groupName}
                />
                <Pressable accessibilityRole="button" disabled={creating} onPress={handleCreateGroup} style={styles.primaryButton}>
                  {creating ? <ActivityIndicator color="#FBFFF8" /> : <MaterialCommunityIcons name="account-multiple-plus" size={20} color="#FBFFF8" />}
                  <Text style={styles.primaryButtonText}>Crear grupo</Text>
                </Pressable>
              </View>

              <View style={[styles.panel, isDark && styles.panelDark]}>
                <View style={styles.panelHeader}>
                  <View style={[styles.panelIconWarm, isDark && styles.panelIconWarmDark]}>
                    <MaterialCommunityIcons name="login" size={22} color={darkIconColor} />
                  </View>
                  <View style={styles.panelCopy}>
                    <Text style={styles.panelTitle}>Unirse a grupo</Text>
                    <Text style={styles.panelSubtitle}>Ingresa el codigo compartido.</Text>
                  </View>
                </View>
                <TextInput
                  autoCapitalize="characters"
                  maxLength={6}
                  onChangeText={(value) => setJoinCode(value.toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor="#43A66C"
                  style={[styles.codeInput, isDark && styles.textInputDark]}
                  value={joinCode}
                />
                <Pressable accessibilityRole="button" disabled={joining} onPress={handleJoinGroup} style={styles.secondaryButton}>
                  {joining ? <ActivityIndicator color={darkIconColor} /> : <MaterialCommunityIcons name="account-arrow-right" size={20} color={darkIconColor} />}
                  <Text style={styles.secondaryButtonText}>Unirse</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Grupos</Text>
              <Text style={styles.sectionMeta}>{groups.length} grupo{groups.length === 1 ? '' : 's'}</Text>
            </View>

            {loadingGroups ? (
              <View style={styles.loadingPanel}>
                <ActivityIndicator color="#064E2F" />
              </View>
            ) : groups.length > 0 ? (
              <View style={styles.groupList}>
                {groups.map((group) => (
                  <Pressable
                    accessibilityRole="button"
                    key={group.id}
                    onPress={() => openGroup(group)}
                    style={[
                      styles.groupRow,
                      isDark && styles.groupRowDark,
                      group.accepted === false && styles.groupRowPending,
                      isDark && group.accepted === false && styles.groupRowPendingDark,
                    ]}>
                    <View style={[styles.groupRowIcon, isDark && styles.groupRowIconDark]}>
                      <MaterialCommunityIcons name="account-group-outline" size={22} color={darkIconColor} />
                    </View>
                    <View style={styles.groupHeaderCopy}>
                      <Text style={styles.groupChipTitle} numberOfLines={1}>{group.nombre}</Text>
                      <Text style={styles.groupChipCode}>{group.accepted === false ? 'Pendiente de aceptacion' : `Codigo ${group.codigo_grupo || 'sin codigo'}`}</Text>
                    </View>
                    <MaterialCommunityIcons name={group.accepted === false ? 'clock-outline' : 'chevron-right'} size={22} color={darkSecondaryIconColor} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyPanel}>
                <MaterialCommunityIcons name="account-group" size={38} color="#00B86B" />
                <Text style={styles.emptyTitle}>Aun no tienes grupos</Text>
                <Text style={styles.emptyText}>Crea uno o entra con un codigo para empezar.</Text>
              </View>
            )}
          </>
        )}

        {isGroupView && (
          <>
            <View style={[styles.groupHeader, isDark && styles.panelDark]}>
              <Pressable accessibilityRole="button" onPress={closeGroup} style={styles.backButton}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={darkIconColor} />
              </Pressable>
              <View style={styles.groupHeaderCopy}>
                <Text style={styles.sectionTitle}>{currentGroup?.nombre || 'Grupo'}</Text>
                <Text style={styles.sectionMeta}>Tu rol: {myRole}</Text>
              </View>
              <View style={styles.codeBadge}>
                <Text style={styles.codeBadgeLabel}>Codigo</Text>
                <Text style={styles.codeBadgeValue}>{currentGroup?.codigo_grupo || '...'}</Text>
              </View>
            </View>

            <View style={[styles.panel, isDark && styles.panelDark]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Participantes</Text>
                <Text style={styles.sectionMeta}>{acceptedMembers.length} persona{acceptedMembers.length === 1 ? '' : 's'}</Text>
              </View>

              {loadingDetail ? (
                <View style={styles.loadingPanel}>
                  <ActivityIndicator color="#064E2F" />
                </View>
              ) : (
                <View style={styles.memberList}>
                  {acceptedMembers.map((member) => (
                    <View key={member.user_id} style={[styles.memberCard, isDark && styles.memberCardDark]}>
                      <View style={[styles.memberAvatar, isDark && styles.groupRowIconDark]}>
                        <Text style={styles.memberAvatarText}>{initials(member.nombre)}</Text>
                      </View>
                      <View style={styles.memberCopy}>
                        <Text style={styles.memberName} numberOfLines={1}>{member.nombre}</Text>
                        <Text style={styles.memberMeta} numberOfLines={2}>
                          {[...(member.objetivos || []), ...(member.restricciones || [])].slice(0, 3).join(' - ') || 'Sin preferencias guardadas'}
                        </Text>
                        {member.ingredientes_favoritos.length > 0 && (
                          <Text style={styles.memberFavs} numberOfLines={1}>
                            Fav: {member.ingredientes_favoritos.slice(0, 3).join(', ')}
                          </Text>
                        )}
                      </View>
                      <View style={styles.memberActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={!isAdmin || member.user_id === user.id}
                          onPress={() => openRoleMenu(member)}
                          style={[
                            styles.rolePill,
                            member.rol === 'admin'
                              ? styles.rolePillAdmin
                              : member.rol === 'editor'
                                ? styles.rolePillEditor
                                : styles.rolePillViewer,
                          ]}>
                          <MaterialCommunityIcons
                            name={roleIcon(member.rol)}
                            size={14}
                            color={member.rol === 'espectador' ? '#064E2F' : '#FBFFF8'}
                          />
                          <Text style={[styles.rolePillText, member.rol !== 'espectador' && styles.rolePillTextEditor]}>
                            {member.rol}
                          </Text>
                        </Pressable>
                        {isAdmin && member.user_id !== user.id && (
                          <Pressable accessibilityRole="button" onPress={() => kickMember(member)} style={styles.kickButton}>
                            <MaterialCommunityIcons name="account-remove-outline" size={16} color="#B03A3A" />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}

                  {isAdmin && pendingMembers.length > 0 && (
                    <View style={styles.pendingWrap}>
                      <Text style={styles.pendingTitle}>Solicitudes pendientes</Text>
                      {pendingMembers.map((member) => (
                        <View key={member.user_id} style={[styles.memberCard, isDark && styles.memberCardDark]}>
                          <View style={styles.memberAvatarPending}>
                            <Text style={styles.memberAvatarText}>{initials(member.nombre)}</Text>
                          </View>
                          <View style={styles.memberCopy}>
                            <Text style={styles.memberName} numberOfLines={1}>{member.nombre}</Text>
                            <Text style={styles.memberMeta} numberOfLines={1}>Quiere entrar al grupo</Text>
                          </View>
                          <View style={styles.reviewActions}>
                            <Pressable accessibilityRole="button" onPress={() => reviewMember(member, true)} style={styles.acceptButton}>
                              <MaterialCommunityIcons name="check" size={16} color="#FBFFF8" />
                            </Pressable>
                            <Pressable accessibilityRole="button" onPress={() => reviewMember(member, false)} style={styles.rejectButton}>
                              <MaterialCommunityIcons name="close" size={16} color="#064E2F" />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.panel, isDark && styles.panelDark]}>
              <View style={styles.panelHeader}>
                <View style={[styles.panelIcon, isDark && styles.panelIconDark]}>
                  <MaterialCommunityIcons name="creation" size={22} color={darkIconColor} />
                </View>
                <View style={styles.panelCopy}>
                  <Text style={styles.panelTitle}>Generador grupal</Text>
                  <Text style={styles.panelSubtitle}>Busca compatibilidades y adapta cada plato por persona.</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={openHistory} style={[styles.historyButton, isDark && styles.historyButtonDark]}>
                  <MaterialCommunityIcons name="history" size={20} color={darkIconColor} />
                  <Text style={styles.historyButtonText}>{historyItems.length}</Text>
                </Pressable>
              </View>

              <View style={styles.mealGrid}>
                {MEAL_TYPES.map((meal) => {
                  const isSelected = selectedMeal === meal.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={meal.id}
                      onPress={() => setSelectedMeal(meal.id)}
                      style={[styles.mealChip, isDark && styles.chipDark, isSelected && styles.mealChipSelected]}>
                      <MaterialCommunityIcons name={meal.icon} size={18} color={isSelected ? '#FBFFF8' : darkIconColor} />
                      <Text style={[styles.mealChipText, isSelected && styles.mealChipTextSelected]}>{meal.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.objectiveRow}>
                {QUICK_OBJECTIVES.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => setObjective((current) => (current === item ? '' : item))}
                    style={[
                      styles.objectiveChip,
                      isDark && styles.chipDark,
                      objective === item && styles.objectiveChipSelected,
                      isDark && objective === item && styles.objectiveChipSelectedDark,
                    ]}>
                    <Text style={[styles.objectiveChipText, objective === item && styles.objectiveChipTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                onChangeText={setObjective}
                placeholder="Objetivo del pack, ej: base arroz y alta proteina"
                placeholderTextColor="#43A66C"
                style={[styles.textInput, isDark && styles.textInputDark]}
                value={objective}
              />

              <TextInput
                onChangeText={setExtraRestrictions}
                placeholder="Restricciones extra separadas por coma"
                placeholderTextColor="#43A66C"
                style={[styles.textInput, isDark && styles.textInputDark]}
                value={extraRestrictions}
              />

              <View style={[styles.searchBar, isDark && styles.searchBarDark]}>
                <MaterialCommunityIcons name="magnify" size={22} color={darkSecondaryIconColor} />
                <TextInput
                  onChangeText={setIngredientSearch}
                  placeholder="Ingrediente sugerido, ej: arroz"
                  placeholderTextColor={isDark ? '#8EDBA9' : '#2F7A4F'}
                  style={[styles.searchInput, isDark && styles.searchInputDark]}
                  value={ingredientSearch}
                />
              </View>

              {loadingItems ? (
                <View style={styles.loadingPanel}>
                  <ActivityIndicator color="#064E2F" />
                </View>
              ) : (
                <ScrollView nestedScrollEnabled style={styles.ingredientScroller} contentContainerStyle={styles.ingredientList}>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIngredientIds.includes(item.id);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={item.id}
                        onPress={() => toggleIngredient(item.id)}
                        style={[
                          styles.ingredientRow,
                          isDark && styles.ingredientRowDark,
                          isSelected && styles.ingredientRowSelected,
                          isDark && isSelected && styles.ingredientRowSelectedDark,
                        ]}>
                        <View style={[styles.checkBox, isDark && styles.checkBoxDark, isSelected && styles.checkBoxSelected]}>
                          {isSelected && <MaterialCommunityIcons name="check" size={16} color="#FBFFF8" />}
                        </View>
                        <View style={styles.ingredientCopy}>
                          <Text style={styles.ingredientTitle} numberOfLines={1}>{item.nombre_producto}</Text>
                          <Text style={styles.ingredientSubtitle} numberOfLines={1}>{itemSubtitle(item) || 'Sin detalle'}</Text>
                        </View>
                        <Text style={styles.macroPill}>{item.energia_kcal ?? 0} kcal</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.budgetToggleRow}>
                <Pressable accessibilityRole="button" onPress={() => setIsBudgeted((current) => !current)} style={[styles.budgetToggle, isDark && styles.budgetToggleDark]}>
                  <View style={[styles.switchTrack, isBudgeted && styles.switchTrackOn]}>
                    <View style={[styles.switchKnob, isBudgeted && styles.switchKnobOn]} />
                  </View>
                  <View style={styles.panelCopy}>
                    <Text style={styles.budgetToggleTitle}>Presupuestada</Text>
                    <Text style={styles.panelSubtitle}>Activa compras sugeridas y costo total.</Text>
                  </View>
                </Pressable>
                {isBudgeted && (
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={setBudgetInput}
                    placeholder="CLP"
                    placeholderTextColor="#43A66C"
                    style={[styles.budgetInput, isDark && styles.textInputDark]}
                    value={budgetInput}
                  />
                )}
              </View>

              <Pressable
                accessibilityRole="button"
                disabled={generating || !canEdit}
                onPress={handleGeneratePack}
                style={[styles.generateButton, !canEdit && styles.generateButtonDisabled]}>
                {generating ? (
                  <ActivityIndicator color="#FBFFF8" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="chef-hat" size={22} color="#FBFFF8" />
                    <Text style={styles.generateButtonText}>Generar pack</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}

        {statusMessage !== '' && (
          <View style={styles.statusPanel}>
            <MaterialCommunityIcons name="information-outline" size={20} color="#064E2F" />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        {error !== '' && (
          <View style={styles.errorPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#FF8A8A" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {purchaseSuggestions.length > 0 && (
          <View style={[styles.panel, isDark && styles.panelDark]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Compras sugeridas</Text>
              <Text style={styles.sectionMeta}>{formatPrice(purchaseSuggestions.reduce((sum, item) => sum + Number(item.precio || 0), 0))}</Text>
            </View>
            {purchaseSuggestions.map((item, index) => (
              <View key={`${item.nombre}-${index}`} style={[styles.purchaseRow, isDark && styles.ingredientRowDark]}>
                <View style={[styles.purchaseIcon, isDark && styles.groupRowIconDark]}>
                  <MaterialCommunityIcons name="cart-outline" size={18} color={darkIconColor} />
                </View>
                <View style={styles.ingredientCopy}>
                  <Text style={styles.ingredientTitle}>{item.nombre}</Text>
                  <Text style={styles.ingredientSubtitle}>
                    {[item.cantidad, item.supermercado_nombre, item.reason || item.categoria].filter(Boolean).join(' - ')}
                  </Text>
                </View>
                <Text style={styles.pricePill}>{formatPrice(item.precio)}</Text>
              </View>
            ))}
          </View>
        )}

        {recipes.length > 0 && (
          <RecipeList
            title="Pack generado"
            items={recipes}
            onPrepare={prepareRecipe}
            usingRecipeKey={usingRecipeKey}
          />
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={historyOpen} onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.historyBackdrop}>
          <Pressable style={styles.historyDismiss} onPress={() => setHistoryOpen(false)} />
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <View style={styles.historyTitleWrap}>
                <Text style={styles.historyTitle}>Historial grupal</Text>
                <Text style={styles.historySubtitle}>Recetas generadas para este grupo.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setHistoryOpen(false)} style={styles.historyCloseButton}>
                <MaterialCommunityIcons name="close" size={22} color="#064E2F" />
              </Pressable>
            </View>

            {historyLoading ? (
              <View style={styles.historyEmpty}>
                <ActivityIndicator size="large" color="#064E2F" />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
                <RecipeList
                  title="Historial"
                  items={historyItems}
                  emptyText="Todavia no hay recetas grupales."
                  compact
                  onPrepare={prepareRecipe}
                  usingRecipeKey={usingRecipeKey}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={!!roleMenuMember} onRequestClose={() => setRoleMenuMember(null)}>
        <View style={styles.roleModalBackdrop}>
          <Pressable style={styles.roleModalDismiss} onPress={() => setRoleMenuMember(null)} />
          <View style={styles.roleModal}>
            <View style={styles.roleModalHeader}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{initials(roleMenuMember?.nombre)}</Text>
              </View>
              <View style={styles.panelCopy}>
                <Text style={styles.roleModalTitle}>{roleMenuMember?.nombre || 'Integrante'}</Text>
                <Text style={styles.panelSubtitle}>Cambiar rol dentro del grupo</Text>
              </View>
            </View>

            <View style={styles.roleOptionList}>
              {ROLE_FLOW.map((role) => {
                const isSelected = roleMenuMember?.rol === role;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={role}
                    onPress={() => roleMenuMember && changeMemberRole(roleMenuMember, role)}
                    style={[styles.roleOption, isSelected && styles.roleOptionSelected]}>
                    <View
                      style={[
                        styles.roleOptionIcon,
                        role === 'admin'
                          ? styles.rolePillAdmin
                          : role === 'editor'
                            ? styles.rolePillEditor
                            : styles.rolePillViewer,
                      ]}>
                      <MaterialCommunityIcons
                        name={roleIcon(role)}
                        size={18}
                        color={role === 'espectador' ? '#064E2F' : '#FBFFF8'}
                      />
                    </View>
                    <View style={styles.panelCopy}>
                      <Text style={styles.roleOptionTitle}>{role}</Text>
                      <Text style={styles.roleOptionText}>
                        {role === 'admin'
                          ? 'Administra miembros y roles'
                          : role === 'editor'
                            ? 'Puede generar y editar planes'
                            : 'Solo puede ver el grupo'}
                      </Text>
                    </View>
                    {isSelected && <MaterialCommunityIcons name="check-circle" size={21} color="#00B86B" />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RecipeList({
  title,
  items,
  emptyText,
  compact = false,
  onPrepare,
  usingRecipeKey,
}: {
  title: string;
  items: GeneratedRecipe[];
  emptyText?: string;
  compact?: boolean;
  onPrepare?: (recipe: GeneratedRecipe) => void;
  usingRecipeKey?: string | null;
}) {
  return (
    <View style={[styles.resultsWrap, compact && styles.resultsCompact]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionMeta}>{items.length} receta{items.length === 1 ? '' : 's'}</Text>
      </View>
      {items.length === 0 && emptyText ? (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        items.map((recipe, index) => {
          const actionKey = recipe.id || recipe.titulo;
          const isPreparing = usingRecipeKey === actionKey;
          return (
            <View key={`${actionKey}-${index}`} style={styles.recipeCard}>
              <View style={styles.recipeHeader}>
                <View style={styles.recipeNumber}>
                  <Text style={styles.recipeNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.recipeHeaderCopy}>
                  <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.titulo}</Text>
                  <Text style={styles.recipeMeta}>
                    {[recipe.persona_nombre, recipe.tiempo_preparacion, recipe.presupuestada ? formatPrice(recipe.costo_estimado) : undefined]
                      .filter(Boolean)
                      .join(' - ') || formatHistoryDate(recipe.created_at)}
                  </Text>
                </View>
                {!!onPrepare && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isPreparing}
                    onPress={() => onPrepare(recipe)}
                    style={[styles.prepareButton, isPreparing && styles.prepareButtonDisabled]}>
                    {isPreparing ? (
                      <ActivityIndicator size="small" color="#FBFFF8" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="play-circle-outline" size={17} color="#FBFFF8" />
                        <Text style={styles.prepareButtonText}>Preparar</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {!!recipe.por_que_funciona && (
                <View style={styles.whyBox}>
                  <Text style={styles.whyText}>{recipe.por_que_funciona}</Text>
                </View>
              )}

              {!!recipe.macros_totales && (
                <View style={styles.macroRow}>
                  <Text style={styles.macroPill}>{recipe.macros_totales.calorias ?? 0} kcal</Text>
                  <Text style={styles.macroPill}>P {recipe.macros_totales.proteinas ?? 0}g</Text>
                  <Text style={styles.macroPill}>C {recipe.macros_totales.carbohidratos ?? 0}g</Text>
                  <Text style={styles.macroPill}>G {recipe.macros_totales.grasas ?? 0}g</Text>
                </View>
              )}

              {!!recipe.ingredientes?.length && (
                <View style={styles.recipeSection}>
                  <Text style={styles.recipeSectionTitle}>Ingredientes</Text>
                  {recipe.ingredientes.slice(0, compact ? 5 : 7).map((ingredient, ingredientIndex) => (
                    <Text key={`${ingredient}-${ingredientIndex}`} style={styles.recipeLine}>- {ingredient}</Text>
                  ))}
                </View>
              )}

              {!!recipe.pasos?.length && (
                <View style={styles.recipeSection}>
                  <Text style={styles.recipeSectionTitle}>Pasos</Text>
                  {recipe.pasos.slice(0, compact ? 4 : 8).map((step, stepIndex) => (
                    <Text key={`${step}-${stepIndex}`} style={styles.recipeLine}>{step}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  acceptButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#00B86B',
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#9FE7B9',
  },
  budgetInput: {
    minWidth: 102,
    minHeight: 50,
    color: '#064E2F',
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
  },
  budgetToggleDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  budgetToggle: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  budgetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  budgetToggleTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#FBFFF8',
  },
  checkBox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#FBFFF8',
  },
  checkBoxDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#173321',
  },
  checkBoxSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#00B86B',
  },
  codeBadge: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: '#FFE8A3',
  },
  codeBadgeLabel: {
    color: '#8B6B00',
    fontSize: 11,
    fontWeight: '900',
  },
  codeBadgeValue: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  codeInput: {
    minHeight: 52,
    color: '#064E2F',
    fontSize: 22,
    fontWeight: '900',
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
    letterSpacing: 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#FBFFF8',
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 132,
  },
  emptyPanel: {
    alignItems: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  emptyText: {
    color: '#2F7A4F',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorPanel: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFF1F1',
  },
  errorText: {
    flex: 1,
    color: '#B03A3A',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  generateButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 17,
    backgroundColor: '#00B86B',
  },
  generateButtonDisabled: {
    opacity: 0.55,
  },
  generateButtonText: {
    color: '#FBFFF8',
    fontSize: 16,
    fontWeight: '900',
  },
  groupChip: {
    minWidth: 128,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  groupChipCode: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '900',
  },
  groupChipCodeSelected: {
    color: '#FBFFF8',
  },
  groupChipSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#00B86B',
  },
  groupChipTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  groupChipTitleSelected: {
    color: '#FBFFF8',
  },
  groupChips: {
    gap: 10,
    paddingRight: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  groupHeaderCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  groupList: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  groupRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  groupRowDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  groupRowIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#9FE7B9',
  },
  groupRowIconDark: {
    backgroundColor: '#245C38',
  },
  groupRowPending: {
    borderColor: '#FFE8A3',
    backgroundColor: '#FFF8DE',
  },
  groupRowPendingDark: {
    borderColor: '#7A5C16',
    backgroundColor: '#2A210F',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'transparent',
  },
  heroCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  heroIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#9FE7B9',
  },
  historyButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  historyButtonDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#173321',
  },
  historyButtonText: {
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '900',
  },
  historyBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 78, 47, 0.26)',
  },
  historyCloseButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#D8FBE3',
  },
  historyDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  historyEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  historyList: {
    gap: 12,
    paddingBottom: 28,
  },
  historySheet: {
    maxHeight: '82%',
    gap: 15,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#FBFFF8',
  },
  historySubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  historyTitle: {
    color: '#064E2F',
    fontSize: 24,
    fontWeight: '900',
  },
  historyTitleWrap: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  ingredientCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  ingredientList: {
    gap: 9,
  },
  ingredientRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  ingredientRowDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  ingredientRowSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#D8FBE3',
  },
  ingredientRowSelectedDark: {
    borderColor: '#20D684',
    backgroundColor: '#183C27',
  },
  ingredientScroller: {
    maxHeight: 230,
  },
  ingredientSubtitle: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
  },
  ingredientTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  loadingPanel: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  kickButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD0D0',
    backgroundColor: '#FFF1F1',
  },
  macroPill: {
    color: '#00B86B',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
    overflow: 'hidden',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    backgroundColor: 'transparent',
  },
  mealChip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  chipDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  mealChipSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#00B86B',
  },
  mealChipText: {
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '900',
  },
  mealChipTextSelected: {
    color: '#FBFFF8',
  },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  memberAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#9FE7B9',
  },
  memberAvatarPending: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFE8A3',
  },
  memberAvatarText: {
    color: '#064E2F',
    fontSize: 17,
    fontWeight: '900',
  },
  memberActions: {
    alignItems: 'flex-end',
    gap: 7,
    backgroundColor: 'transparent',
  },
  memberCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: 18,
    backgroundColor: '#DDF8E7',
  },
  memberCardDark: {
    backgroundColor: '#173321',
  },
  memberCopy: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  memberFavs: {
    color: '#087247',
    fontSize: 12,
    fontWeight: '800',
  },
  memberList: {
    gap: 9,
    backgroundColor: 'transparent',
  },
  memberMeta: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  memberName: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  objectiveChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#DDF8E7',
  },
  objectiveChipSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#9FE7B9',
  },
  objectiveChipSelectedDark: {
    borderColor: '#20D684',
    backgroundColor: '#183C27',
  },
  objectiveChipText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '900',
  },
  objectiveChipTextSelected: {
    color: '#064E2F',
  },
  objectiveRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  panel: {
    gap: 13,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 2,
  },
  panelDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
    shadowColor: '#000000',
  },
  panelCopy: {
    flex: 1,
    gap: 3,
    backgroundColor: 'transparent',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'transparent',
  },
  panelIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#9FE7B9',
  },
  panelIconDark: {
    backgroundColor: '#245C38',
  },
  panelIconWarm: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#FFE8A3',
  },
  panelIconWarmDark: {
    backgroundColor: '#4A3714',
  },
  panelSubtitle: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  panelTitle: {
    color: '#064E2F',
    fontSize: 17,
    fontWeight: '900',
  },
  pendingTitle: {
    color: '#8B6B00',
    fontSize: 13,
    fontWeight: '900',
  },
  pendingWrap: {
    gap: 9,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
  pricePill: {
    color: '#064E2F',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFE8A3',
    overflow: 'hidden',
  },
  prepareButton: {
    minHeight: 38,
    minWidth: 98,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#00B86B',
  },
  prepareButtonDisabled: {
    opacity: 0.72,
  },
  prepareButtonText: {
    color: '#FBFFF8',
    fontSize: 12,
    fontWeight: '900',
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#00B86B',
  },
  primaryButtonText: {
    color: '#FBFFF8',
    fontSize: 15,
    fontWeight: '900',
  },
  purchaseIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFE8A3',
  },
  purchaseRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 17,
    backgroundColor: '#DDF8E7',
  },
  rejectButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
  },
  recipeCard: {
    gap: 12,
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  recipeHeader: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: 'transparent',
  },
  recipeHeaderCopy: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  recipeLine: {
    color: '#0B6B40',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  recipeMeta: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  recipeNumber: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#9FE7B9',
  },
  recipeNumberText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  recipeSection: {
    gap: 5,
    backgroundColor: 'transparent',
  },
  recipeSectionTitle: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '900',
  },
  recipeTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  resultsWrap: {
    gap: 11,
    backgroundColor: 'transparent',
  },
  resultsCompact: {
    paddingTop: 2,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: 'transparent',
  },
  rolePill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  rolePillAdmin: {
    backgroundColor: '#064E2F',
  },
  rolePillEditor: {
    backgroundColor: '#00B86B',
  },
  rolePillText: {
    color: '#064E2F',
    fontSize: 11,
    fontWeight: '900',
  },
  rolePillTextEditor: {
    color: '#FBFFF8',
  },
  rolePillViewer: {
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
  },
  roleModal: {
    width: '88%',
    maxWidth: 380,
    gap: 14,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
    shadowColor: '#064E2F',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  roleModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(6, 78, 47, 0.22)',
  },
  roleModalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  roleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'transparent',
  },
  roleModalTitle: {
    color: '#064E2F',
    fontSize: 18,
    fontWeight: '900',
  },
  roleOption: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#E9FBEF',
  },
  roleOptionIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  roleOptionList: {
    gap: 9,
    backgroundColor: 'transparent',
  },
  roleOptionSelected: {
    borderColor: '#00B86B',
    backgroundColor: '#D8FBE3',
  },
  roleOptionText: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '700',
  },
  roleOptionTitle: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  searchBar: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
  },
  searchBarDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#102619',
  },
  searchInput: {
    flex: 1,
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
  },
  searchInputDark: {
    color: '#EAFBF0',
  },
  secondaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#74D997',
    backgroundColor: '#D8FBE3',
  },
  secondaryButtonText: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: 'transparent',
  },
  sectionMeta: {
    color: '#2F7A4F',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#064E2F',
    fontSize: 19,
    fontWeight: '900',
  },
  setupGrid: {
    gap: 12,
    backgroundColor: 'transparent',
  },
  statusPanel: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#D8FBE3',
  },
  statusText: {
    flex: 1,
    color: '#064E2F',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  switchKnob: {
    width: 21,
    height: 21,
    borderRadius: 999,
    backgroundColor: '#FBFFF8',
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  switchTrack: {
    width: 46,
    height: 27,
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 999,
    backgroundColor: '#9FE7B9',
  },
  switchTrackOn: {
    backgroundColor: '#00B86B',
  },
  textInput: {
    minHeight: 50,
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    backgroundColor: '#FBFFF8',
  },
  textInputDark: {
    borderColor: '#2F7A4F',
    backgroundColor: '#173321',
    color: '#EAFBF0',
  },
  title: {
    color: '#064E2F',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  whyBox: {
    padding: 11,
    borderRadius: 16,
    backgroundColor: '#DDF8E7',
  },
  whyText: {
    color: '#0B6B40',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
