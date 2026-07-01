import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Pressable,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { UserBudget, fetchBudget, saveBudget } from '@/services/budget';

// Opciones predefinidas (mismas que completar_perfil)

const OBJETIVOS_OPTIONS = [
    'Perder peso',
    'Ganar músculo',
    'Mantener peso',
    'Comer más saludable',
    'Reducir azúcar',
    'Aumentar proteínas',
    'Dieta equilibrada',
    'Control de porciones',
];

const RESTRICCIONES_OPTIONS = [
    'Vegetariano',
    'Vegano',
    'Sin gluten',
    'Sin lactosa',
    'Sin mariscos',
    'Sin frutos secos',
    'Bajo en sodio',
    'Diabético',
];

// Componente Tag (solo lectura)

function TagList({ items, color }: { items: string[]; color: string }) {
    if (items.length === 0) {
        return <Text style={styles.emptyTag}>No configurado</Text>;
    }
    return (
        <View style={styles.tagsContainer}>
            {items.map((item) => (
                <View key={item} style={[styles.tag, { borderColor: color + '55', backgroundColor: color + '15' }]}>
                    <Text style={[styles.tagText, { color }]}>{item}</Text>
                </View>
            ))}
        </View>
    );
}

// Componente ChipSelector (para edición)

function ChipSelector({
    options,
    selected,
    onToggle,
    accentColor = '#00B86B',
}: {
    options: string[];
    selected: string[];
    onToggle: (option: string) => void;
    accentColor?: string;
}) {
    return (
        <View style={styles.tagsContainer}>
            {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                    <Pressable
                        key={option}
                        onPress={() => onToggle(option)}
                        style={[
                            styles.tag,
                            {
                                borderColor: isSelected ? accentColor : '#9FE7B9',
                                backgroundColor: isSelected ? accentColor + '22' : '#DDF8E7',
                            },
                        ]}>
                        <Text style={[styles.tagText, { color: isSelected ? accentColor : '#2F7A4F' }]}>
                            {isSelected ? `✓ ${option}` : option}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

// pantalla principal

export default function PerfilScreen() {
    const { user, logout, updateProfile } = useAuth();
    const router = useRouter();

    const [editing, setEditing] = useState(false);
    const [budget, setBudget] = useState<UserBudget | null>(null);
    const [budgetEditing, setBudgetEditing] = useState(false);
    const [budgetAmount, setBudgetAmount] = useState('');
    const [budgetPeriod, setBudgetPeriod] = useState('mensual');
    const [budgetSaving, setBudgetSaving] = useState(false);
    const [budgetSaved, setBudgetSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    // estados editables
    const [editEdad, setEditEdad] = useState('');
    const [editPeso, setEditPeso] = useState('');
    const [editAltura, setEditAltura] = useState('');
    const [editGenero, setEditGenero] = useState('');
    const [editObjetivos, setEditObjetivos] = useState<string[]>([]);
    const [editRestricciones, setEditRestricciones] = useState<string[]>([]);
    const [editIngFavoritos, setEditIngFavoritos] = useState('');

    useEffect(() => {
        let active = true;
        async function loadBudget() {
            if (!user?.id) return;
            const result = await fetchBudget(user.id);
            if (!active) return;
            if (result.budget) {
                setBudget(result.budget);
                setBudgetAmount(String(result.budget.monto || ''));
                setBudgetPeriod(result.budget.periodo || 'mensual');
            } else {
                setBudget(null);
                setBudgetEditing(true);
            }
        }
        loadBudget();
        return () => {
            active = false;
        };
    }, [user?.id]);

    const startEditing = () => {
        // inicializar con datos actuales del usuario
        setEditEdad(user?.edad?.toString() || '');
        setEditPeso(user?.peso?.toString() || '');
        setEditAltura(user?.altura?.toString() || '');
        setEditGenero(user?.genero || '');
        setEditObjetivos(user?.objetivos || []);
        setEditRestricciones(user?.restricciones || []);
        setEditIngFavoritos(user?.ingredientes_favoritos?.join(', ') || '');
        setEditing(true);
        setMsg('');
    };

    const cancelEditing = () => {
        setEditing(false);
        setMsg('');
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg('');

        const formatStringToArray = (str: string) =>
            str.split(',').map(item => item.trim()).filter(item => item.length > 0);

        const result = await updateProfile({
            edad: parseInt(editEdad) || 0,
            peso: parseFloat(editPeso) || 0,
            altura: parseFloat(editAltura) || 0,
            genero: editGenero.toLowerCase(),
            objetivos: editObjetivos,
            restricciones: editRestricciones,
            ingredientes_favoritos: formatStringToArray(editIngFavoritos),
        });

        if (result.success) {
            setMsg('Perfil actualizado');
            setEditing(false);
        } else {
            setMsg(result.error || 'Error al actualizar');
        }
        setSaving(false);
    };

    const handleSaveBudget = async () => {
        if (!user?.id) return;
        const monto = Number(budgetAmount.replace(/[^\d]/g, ''));
        if (!Number.isFinite(monto) || monto <= 0) {
            setMsg('Ingresa un presupuesto valido');
            return;
        }

        setBudgetSaving(true);
        setMsg('');
        const result = await saveBudget({
            user_id: user.id,
            monto,
            periodo: budgetPeriod,
            moneda: 'CLP',
        });

        if (result.budget) {
            setBudget(result.budget);
            setBudgetEditing(true);
            setBudgetSaved(true);
            setMsg('Presupuesto actualizado desde cero');
        } else {
            setMsg(result.error || 'Error al guardar presupuesto');
        }
        setBudgetSaving(false);
    };

    const handleLogout = async () => {
        await logout();
        router.replace('/(auth)/login');
    };

    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/(tabs)');
    };

    const generos = ['masculino', 'femenino', 'otro'];
    const budgetRemaining = budget ? Number(budget.monto || 0) - Number(budget.gastado || 0) : 0;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}>
                        <MaterialCommunityIcons name="chevron-left" size={24} color="#064E2F" />
                    </Pressable>
                    <Text style={styles.title}>Mi Perfil</Text>
                </View>

                {msg !== '' && (
                    <Text style={[styles.msgText, msg.includes('Error') && styles.errorText]}>{msg}</Text>
                )}

                {/* datos personales */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Datos personales</Text>

                    {editing ? (
                        <View style={styles.editSection}>
                            <View style={styles.editRow}>
                                <Text style={styles.label}>Edad</Text>
                                <TextInput
                                    style={styles.editInput}
                                    value={editEdad}
                                    onChangeText={setEditEdad}
                                    keyboardType="numeric"
                                    placeholderTextColor="#4F9F70"
                                />
                            </View>
                            <View style={styles.editRow}>
                                <Text style={styles.label}>Peso (kg)</Text>
                                <TextInput
                                    style={styles.editInput}
                                    value={editPeso}
                                    onChangeText={setEditPeso}
                                    keyboardType="numeric"
                                    placeholderTextColor="#4F9F70"
                                />
                            </View>
                            <View style={styles.editRow}>
                                <Text style={styles.label}>Altura (cm)</Text>
                                <TextInput
                                    style={styles.editInput}
                                    value={editAltura}
                                    onChangeText={setEditAltura}
                                    keyboardType="numeric"
                                    placeholderTextColor="#4F9F70"
                                />
                            </View>
                            <Text style={styles.label}>Género</Text>
                            <View style={styles.genderRow}>
                                {generos.map((g) => (
                                    <Pressable
                                        key={g}
                                        onPress={() => setEditGenero(g)}
                                        style={[
                                            styles.genderChip,
                                            editGenero === g && styles.genderChipSelected,
                                        ]}>
                                        <Text style={[
                                            styles.genderChipText,
                                            editGenero === g && styles.genderChipTextSelected,
                                        ]}>
                                            {g.charAt(0).toUpperCase() + g.slice(1)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Nombre</Text>
                                <Text style={styles.value}>{user?.nombre || '—'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Email</Text>
                                <Text style={styles.value}>{user?.email || '—'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Edad</Text>
                                <Text style={styles.value}>{user?.edad || '—'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Peso</Text>
                                <Text style={styles.value}>{user?.peso ? `${user.peso} kg` : '—'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Altura</Text>
                                <Text style={styles.value}>{user?.altura ? `${user.altura} cm` : '—'}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Género</Text>
                                <Text style={styles.value}>{user?.genero || '—'}</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Objetivos */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Objetivos nutricionales</Text>
                    {editing ? (
                        <ChipSelector
                            options={OBJETIVOS_OPTIONS}
                            selected={editObjetivos}
                            onToggle={(o) => setEditObjetivos(prev =>
                                prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
                            )}
                            accentColor="#00B86B"
                        />
                    ) : (
                        <TagList items={user?.objetivos || []} color="#00B86B" />
                    )}
                </View>

                {/* Restricciones */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Restricciones alimentarias</Text>
                    {editing ? (
                        <ChipSelector
                            options={RESTRICCIONES_OPTIONS}
                            selected={editRestricciones}
                            onToggle={(r) => setEditRestricciones(prev =>
                                prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                            )}
                            accentColor="#60a5fa"
                        />
                    ) : (
                        <TagList items={user?.restricciones || []} color="#60a5fa" />
                    )}
                </View>

                {/* ingredientes favoritos */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Ingredientes favoritos</Text>
                    {editing ? (
                        <View style={styles.editInputGroup}>
                            <TextInput
                                style={styles.editInputFull}
                                value={editIngFavoritos}
                                onChangeText={setEditIngFavoritos}
                                placeholder="Ej: pollo, arroz, tomate"
                                placeholderTextColor="#4F9F70"
                            />
                        </View>
                    ) : (
                        <TagList items={user?.ingredientes_favoritos || []} color="#f472b6" />
                    )}
                </View>

                <View style={styles.budgetCard}>
                    <View style={styles.budgetHeader}>
                        <View style={styles.budgetIcon}>
                            <MaterialCommunityIcons name="cash-multiple" size={24} color="#064E2F" />
                        </View>
                        <View style={styles.budgetCopy}>
                            <Text style={styles.sectionTitle}>Presupuesto</Text>
                            <Text style={styles.budgetHint}>
                                {budget ? 'Al editarlo se reinicia lo gastado para un nuevo periodo.' : 'Configuralo para planificar recetas y semana.'}
                            </Text>
                        </View>
                    </View>

                    {budget && !budgetEditing ? (
                        <View style={styles.budgetStats}>
                            <View style={styles.budgetStat}>
                                <Text style={styles.label}>Inicial</Text>
                                <Text style={styles.budgetValue}>${Math.round(Number(budget.monto || 0)).toLocaleString('es-CL')}</Text>
                            </View>
                            <View style={styles.budgetStat}>
                                <Text style={styles.label}>Gastado</Text>
                                <Text style={styles.budgetValue}>${Math.round(Number(budget.gastado || 0)).toLocaleString('es-CL')}</Text>
                            </View>
                            <View style={styles.budgetStat}>
                                <Text style={styles.label}>Disponible</Text>
                                <Text style={styles.budgetValue}>${Math.round(budgetRemaining).toLocaleString('es-CL')}</Text>
                            </View>
                            <TouchableOpacity style={styles.editBudgetButton} onPress={() => {
                                setBudgetSaved(false);
                                setBudgetEditing(true);
                            }}>
                                <MaterialCommunityIcons name="pencil-outline" size={18} color="#064E2F" />
                                <Text style={styles.editButtonText}>Editar presupuesto</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.editSection}>
                            <Text style={styles.label}>Monto del periodo</Text>
                            <TextInput
                                style={styles.editInputFull}
                                value={budgetAmount}
                                onChangeText={(value) => {
                                    setBudgetSaved(false);
                                    setBudgetAmount(value);
                                }}
                                keyboardType="numeric"
                                placeholder="Ej: 120000"
                                placeholderTextColor="#4F9F70"
                            />
                            <View style={styles.genderRow}>
                                {['semanal', 'mensual'].map((period) => (
                                    <Pressable
                                        key={period}
                                        onPress={() => {
                                            setBudgetSaved(false);
                                            setBudgetPeriod(period);
                                        }}
                                        style={[styles.genderChip, budgetPeriod === period && styles.genderChipSelected]}>
                                        <Text style={[styles.genderChipText, budgetPeriod === period && styles.genderChipTextSelected]}>
                                            {period}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                            <TouchableOpacity
                                style={[styles.saveButton, budgetSaved && styles.budgetSavedButton]}
                                onPress={handleSaveBudget}
                                disabled={budgetSaving || budgetSaved}>
                                {budgetSaving ? (
                                    <ActivityIndicator color="#FBFFF8" />
                                ) : (
                                    <Text style={styles.saveButtonText}>{budgetSaved ? '¡Guardado!' : 'Guardar presupuesto'}</Text>
                                )}
                            </TouchableOpacity>
                            {budget && (
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setBudgetEditing(false)}>
                                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* botones de acción    */}
                {editing ? (
                    <View style={styles.editActions}>
                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.buttonDisabled]}
                            onPress={handleSave}
                            disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color="#FBFFF8" />
                            ) : (
                                <Text style={styles.saveButtonText}>Guardar cambios</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.editButton} onPress={startEditing}>
                        <Text style={styles.editButtonText}>Editar perfil</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FBFFF8',
    },
    scrollContent: {
        padding: 24,
        paddingTop: 48,
        paddingBottom: 120,
        gap: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#064E2F',
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'transparent',
    },
    msgText: {
        color: '#00B86B',
        fontSize: 13,
        textAlign: 'center',
    },
    errorText: {
        color: '#FF8A8A',
    },
    card: {
        backgroundColor: '#DDF8E7',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#9FE7B9',
        gap: 14,
    },
    budgetCard: {
        backgroundColor: '#E9FBEF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#9FE7B9',
        gap: 14,
        shadowColor: '#74D997',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 2,
    },
    budgetCopy: {
        flex: 1,
        gap: 3,
        backgroundColor: 'transparent',
    },
    budgetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'transparent',
    },
    budgetHint: {
        color: '#2F7A4F',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 18,
    },
    budgetIcon: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: '#9FE7B9',
    },
    budgetSavedButton: {
        backgroundColor: '#16A34A',
    },
    budgetStat: {
        gap: 4,
        padding: 12,
        borderRadius: 14,
        backgroundColor: '#DDF8E7',
    },
    budgetStats: {
        gap: 10,
        backgroundColor: 'transparent',
    },
    budgetValue: {
        color: '#064E2F',
        fontSize: 18,
        fontWeight: '900',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#064E2F',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 15,
        color: '#2F7A4F',
    },
    value: {
        fontSize: 15,
        color: '#064E2F',
        fontWeight: '500',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 13,
        fontWeight: '600',
    },
    emptyTag: {
        color: '#4F9F70',
        fontSize: 14,
        fontStyle: 'italic',
    },
    // edicion
    editSection: {
        gap: 12,
    },
    editRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    editInput: {
        backgroundColor: '#DDF8E7',
        borderWidth: 1,
        borderColor: '#9FE7B9',
        borderRadius: 10,
        color: '#064E2F',
        fontSize: 15,
        paddingHorizontal: 14,
        paddingVertical: 10,
        width: 120,
        textAlign: 'right',
    },
    editInputGroup: {
        backgroundColor: '#DDF8E7',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#9FE7B9',
    },
    editInputFull: {
        color: '#064E2F',
        fontSize: 15,
        paddingVertical: 14,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 8,
    },
    genderChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#9FE7B9',
        backgroundColor: '#DDF8E7',
    },
    genderChipSelected: {
        borderColor: '#00B86B',
        backgroundColor: '#D8FBE3',
    },
    genderChipText: {
        color: '#2F7A4F',
        fontSize: 13,
        fontWeight: '600',
    },
    genderChipTextSelected: {
        color: '#00B86B',
    },
    // Botones
    editButton: {
        backgroundColor: '#E9FBEF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#9FE7B9',
        shadowColor: '#74D997',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 2,
    },
    editBudgetButton: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#D8FBE3',
        paddingVertical: 13,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#9FE7B9',
    },
    editButtonText: {
        color: '#064E2F',
        fontSize: 16,
        fontWeight: '600',
    },
    editActions: {
        gap: 10,
    },
    saveButton: {
        backgroundColor: '#00B86B',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#00B86B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
        elevation: 3,
    },
    saveButtonText: {
        color: '#FBFFF8',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#9FE7B9',
    },
    cancelButtonText: {
        color: '#2F7A4F',
        fontSize: 15,
        fontWeight: '500',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    logoutButton: {
        backgroundColor: '#9FE7B9',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF8A8A',
    },
    logoutText: {
        color: '#FF8A8A',
        fontSize: 16,
        fontWeight: '600',
    },
});
