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
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function CompleteProfileScreen() {
    const router = useRouter();
    const { user } = useAuth();

    // Estados del perfil
    const [edad, setEdad] = useState('');
    const [peso, setPeso] = useState('');
    const [altura, setAltura] = useState('');
    const [genero, setGenero] = useState('');
    const [objetivos, setObjetivos] = useState('');
    const [restricciones, setRestricciones] = useState('');
    const [ingredientesFavoritos, setIngredientesFavoritos] = useState('');

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState(false);

    const handleSaveProfile = async () => {
        setLoading(true);
        // Aqui se deberan enviar estos datos al backend (se creara un endpoint como updateProfile)
        // ya que el registro principal ocurrió en login.tsx

        setMsg('Perfil guardado exitosamente');
        setError(false);

        // Simular guardado
        setTimeout(() => {
            router.replace('/(tabs)');
        }, 1500);
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
                            {msg !== '' && (
                                <Text style={[styles.statusText, error && styles.errorText]}>
                                    {msg}
                                </Text>
                            )}

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

                            {/* Género */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Género (Ej: masculino)"
                                    placeholderTextColor="#888"
                                    value={genero}
                                    onChangeText={setGenero}
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Objetivos */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Objetivos (Ej: perder peso, ganar musculo)"
                                    placeholderTextColor="#888"
                                    value={objetivos}
                                    onChangeText={setObjetivos}
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Restricciones */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Restricciones (Ej: alergia a la lactosa)"
                                    placeholderTextColor="#888"
                                    value={restricciones}
                                    onChangeText={setRestricciones}
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Ingredientes Favoritos */}
                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ingredientes Favoritos (Ej: pollo, arroz)"
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
        gap: 16,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
        textAlign: 'center',
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f0f0f',
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#222',
        marginBottom: 8,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        paddingVertical: 16,
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
