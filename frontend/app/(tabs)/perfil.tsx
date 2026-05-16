import React, { useState } from 'react';
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
    accentColor = '#4ade80',
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
                                borderColor: isSelected ? accentColor : '#333',
                                backgroundColor: isSelected ? accentColor + '22' : '#0f0f0f',
                            },
                        ]}>
                        <Text style={[styles.tagText, { color: isSelected ? accentColor : '#999' }]}>
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

    const handleLogout = async () => {
        await logout();
        router.replace('/(auth)/login');
    };

    const generos = ['masculino', 'femenino', 'otro'];

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Mi Perfil</Text>

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
                                    placeholderTextColor="#555"
                                />
                            </View>
                            <View style={styles.editRow}>
                                <Text style={styles.label}>Peso (kg)</Text>
                                <TextInput
                                    style={styles.editInput}
                                    value={editPeso}
                                    onChangeText={setEditPeso}
                                    keyboardType="numeric"
                                    placeholderTextColor="#555"
                                />
                            </View>
                            <View style={styles.editRow}>
                                <Text style={styles.label}>Altura (cm)</Text>
                                <TextInput
                                    style={styles.editInput}
                                    value={editAltura}
                                    onChangeText={setEditAltura}
                                    keyboardType="numeric"
                                    placeholderTextColor="#555"
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
                            accentColor="#4ade80"
                        />
                    ) : (
                        <TagList items={user?.objetivos || []} color="#4ade80" />
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
                                placeholderTextColor="#555"
                            />
                        </View>
                    ) : (
                        <TagList items={user?.ingredientes_favoritos || []} color="#f472b6" />
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
                                <ActivityIndicator color="#000" />
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
        backgroundColor: '#000',
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
        color: '#fff',
    },
    msgText: {
        color: '#4ade80',
        fontSize: 13,
        textAlign: 'center',
    },
    errorText: {
        color: '#f87171',
    },
    card: {
        backgroundColor: '#0a0a0a',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        gap: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 15,
        color: '#888',
    },
    value: {
        fontSize: 15,
        color: '#fff',
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
        color: '#555',
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
        backgroundColor: '#0f0f0f',
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 10,
        color: '#fff',
        fontSize: 15,
        paddingHorizontal: 14,
        paddingVertical: 10,
        width: 120,
        textAlign: 'right',
    },
    editInputGroup: {
        backgroundColor: '#0f0f0f',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#222',
    },
    editInputFull: {
        color: '#fff',
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
        borderColor: '#333',
        backgroundColor: '#0f0f0f',
    },
    genderChipSelected: {
        borderColor: '#a78bfa',
        backgroundColor: '#a78bfa22',
    },
    genderChipText: {
        color: '#999',
        fontSize: 13,
        fontWeight: '600',
    },
    genderChipTextSelected: {
        color: '#a78bfa',
    },
    // Botones
    editButton: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    editButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    editActions: {
        gap: 10,
    },
    saveButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    cancelButtonText: {
        color: '#999',
        fontSize: 15,
        fontWeight: '500',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    logoutButton: {
        backgroundColor: '#1a1a1a',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f87171',
    },
    logoutText: {
        color: '#f87171',
        fontSize: 16,
        fontWeight: '600',
    },
});
