import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    Pressable,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';

// Opciones predefinidas

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

// Componente Chip

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
        <View style={chipStyles.container}>
            {options.map((option) => {
                const isSelected = selected.includes(option);
                return (
                    <Pressable
                        key={option}
                        onPress={() => onToggle(option)}
                        style={[
                            chipStyles.chip,
                            isSelected && { backgroundColor: accentColor + '22', borderColor: accentColor },
                        ]}>
                        <Text
                            style={[
                                chipStyles.chipText,
                                isSelected && { color: accentColor },
                            ]}>
                            {option}
                        </Text>
                        {isSelected && (
                            <Text style={[chipStyles.checkmark, { color: accentColor }]}>✓</Text>
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}

const chipStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
        backgroundColor: '#0f0f0f',
    },
    chipText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '600',
    },
    checkmark: {
        fontSize: 13,
        fontWeight: '700',
    },
});

// Pantalla principal

export default function CompleteProfileScreen() {
    const router = useRouter();
    const { user, updateProfile } = useAuth();

    // Estados del perfil
    const [edad, setEdad] = useState('');
    const [peso, setPeso] = useState('');
    const [altura, setAltura] = useState('');
    const [genero, setGenero] = useState('');
    const [objetivos, setObjetivos] = useState<string[]>([]);
    const [restricciones, setRestricciones] = useState<string[]>([]);
    const [ingredientesFavoritos, setIngredientesFavoritos] = useState('');

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState(false);

    // Toggle para chips
    const toggleObjetivo = (option: string) => {
        setObjetivos((prev) =>
            prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
        );
    };

    const toggleRestriccion = (option: string) => {
        setRestricciones((prev) =>
            prev.includes(option) ? prev.filter((r) => r !== option) : [...prev, option]
        );
    };

    // Selector de genero
    const generos = ['Masculino', 'Femenino', 'Otro'];

    const handleSaveProfile = async () => {
        setLoading(true);
        setError(false);
        setMsg('');

        // Transformamos ingredientes favoritos de string a array
        const formatStringToArray = (str: string) =>
            str.split(',')
                .map(item => item.trim())
                .filter(item => item.length > 0);

        const data = {
            edad: parseInt(edad) || 0,
            peso: parseFloat(peso) || 0,
            altura: parseFloat(altura) || 0,
            genero: genero.trim().toLowerCase(),
            objetivos: objetivos,
            restricciones: restricciones,
            ingredientes_favoritos: formatStringToArray(ingredientesFavoritos),
        };

        const result = await updateProfile(data);

        if (result.success) {
            setMsg('Perfil guardado exitosamente');
            setError(false);
            setTimeout(() => {
                router.replace('/(tabs)');
            }, 1500);
        } else {
            setMsg(result.error || 'Error al guardar el perfil');
            setError(true);
        }

        setLoading(false);
    };


    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <View style={styles.formContainer}>
                            <Text style={styles.formTitle}>Complete su perfil</Text>
                            <Text style={styles.formSubtitle}>
                                Esta información nos ayuda a personalizar tu experiencia
                            </Text>

                            {msg !== '' && (
                                <Text style={[styles.statusText, error && styles.errorText]}>
                                    {msg}
                                </Text>
                            )}

                            {/* Datos básicos */}
                            <Text style={styles.sectionLabel}>Datos personales</Text>

                            {/* Edad */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Edad"
                                    placeholderTextColor="#888"
                                    value={edad}
                                    onChangeText={setEdad}
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Peso */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Peso (kg)"
                                    placeholderTextColor="#888"
                                    value={peso}
                                    onChangeText={setPeso}
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Altura */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Altura (cm)"
                                    placeholderTextColor="#888"
                                    value={altura}
                                    onChangeText={setAltura}
                                    keyboardType="numeric"
                                />
                            </View>

                            {/* Género con chips */}
                            <Text style={styles.sectionLabel}>Género</Text>
                            <View style={styles.genderRow}>
                                {generos.map((g) => (
                                    <Pressable
                                        key={g}
                                        onPress={() => setGenero(g)}
                                        style={[
                                            styles.genderChip,
                                            genero === g && styles.genderChipSelected,
                                        ]}>
                                        <Text
                                            style={[
                                                styles.genderChipText,
                                                genero === g && styles.genderChipTextSelected,
                                            ]}>
                                            {g}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Objetivos con chips */}
                            <Text style={styles.sectionLabel}>
                                Objetivos nutricionales
                                {objetivos.length > 0 && (
                                    <Text style={styles.selectedCount}> ({objetivos.length})</Text>
                                )}
                            </Text>
                            <ChipSelector
                                options={OBJETIVOS_OPTIONS}
                                selected={objetivos}
                                onToggle={toggleObjetivo}
                                accentColor="#4ade80"
                            />

                            {/* Restricciones con chips */}
                            <Text style={styles.sectionLabel}>
                                Restricciones alimentarias
                                {restricciones.length > 0 && (
                                    <Text style={styles.selectedCount}> ({restricciones.length})</Text>
                                )}
                            </Text>
                            <ChipSelector
                                options={RESTRICCIONES_OPTIONS}
                                selected={restricciones}
                                onToggle={toggleRestriccion}
                                accentColor="#60a5fa"
                            />

                            {/* Ingredientes Favoritos */}
                            <Text style={styles.sectionLabel}>Ingredientes favoritos</Text>
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej: pollo, arroz, tomate (separar con comas)"
                                    placeholderTextColor="#888"
                                    value={ingredientesFavoritos}
                                    onChangeText={setIngredientesFavoritos}
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Botón de Guardar */}
                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleSaveProfile}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text style={styles.buttonText}>Guardar Perfil</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000000',
    },
    container: {
        flex: 1,
    },
    scrollView: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#0a0a0a',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    formContainer: {
        gap: 12,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    formSubtitle: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 8,
    },
    sectionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ccc',
        marginTop: 8,
    },
    selectedCount: {
        color: '#4ade80',
        fontWeight: '600',
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f0f0f',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#222',
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        paddingVertical: 16,
    },
    genderRow: {
        flexDirection: 'row',
        gap: 8,
    },
    genderChip: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
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
        fontSize: 14,
        fontWeight: '600',
    },
    genderChipTextSelected: {
        color: '#a78bfa',
    },
    button: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    statusText: {
        color: '#4ade80',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 8,
    },
    errorText: {
        color: '#f87171',
    },
});
