/* en esta vista se implementara la funcionalidad que debe mostrar el login para iniciar sesion o registrarse como
primera vista, si el usuario ya esta logueado, se debe redirigir a la pantalla de inicio. Si no, tiene que registrarse, 
si se registra correctamente, se debe redirigir a otra pantalla para rellenar otros datos como edad, peso, altura, genero, 
objetivos, restricciones, ingredientes favoritos.
si se loguea correctamente, se debe redirigir a la pantalla de inicio.
*/

import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';


import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
    const router = useRouter();
    const { login, register } = useAuth();
    const [activeTab, setActiveTab] = useState('login');

    // Estados de Login
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginMsg, setLoginMsg] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState(false);

    // Estados de Registro
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirm, setSignupConfirm] = useState('');
    const [signupMsg, setSignupMsg] = useState('');
    const [signupLoading, setSignupLoading] = useState(false);
    const [signupError, setSignupError] = useState(false);

    const switchTab = (tab: string) => {
        setActiveTab(tab);
        setLoginMsg('');
        setSignupMsg('');
        setLoginError(false);
        setSignupError(false);
    };

    // ---------- Login real con backend ----------
    const handleLogin = async () => {
        const email = loginEmail.trim();
        const pwd = loginPassword.trim();

        if (!email || !pwd) {
            setLoginMsg('Campos obligatorios faltantes');
            setLoginError(true);
            return;
        }

        if (!email.includes('@')) {
            setLoginMsg('Formato de correo invalido');
            setLoginError(true);
            return;
        }

        setLoginLoading(true);
        setLoginMsg('Accediendo...');
        setLoginError(false);

        const result = await login(email, pwd);

        if (result.success) {
            setLoginMsg('¡Bienvenido!');
            setLoginError(false);
            setTimeout(() => {
                router.replace('/(tabs)');
            }, 500);
        } else {
            setLoginMsg(result.error || 'Error al iniciar sesion');
            setLoginError(true);
        }

        setLoginLoading(false);
    };

    // ---------- Registro real con backend ----------
    const handleSignup = async () => {
        if (!signupName || !signupEmail || !signupPassword || !signupConfirm) {
            setSignupMsg('Complete todos los campos');
            setSignupError(true);
            return;
        }

        if (!signupEmail.includes('@')) {
            setSignupMsg('Formato de correo invalido');
            setSignupError(true);
            return;
        }

        if (signupPassword.length < 6) {
            setSignupMsg('La contraseña debe tener al menos 6 caracteres');
            setSignupError(true);
            return;
        }

        if (signupPassword !== signupConfirm) {
            setSignupMsg('Las contraseñas no coinciden');
            setSignupError(true);
            return;
        }

        setSignupLoading(true);
        setSignupMsg('Creando cuenta...');
        setSignupError(false);

        //registrar en el backend
        const result = await register({
            email: signupEmail.trim(), //borra los espacios en blanco al inicio y al final y envia al backend
            password: signupPassword,
            nombre: signupName.trim(), //borra los espacios en blanco al inicio y al final y envia al backend

        });

        if (result.success) {
            setSignupMsg('¡Cuenta creada! a continuacion complete el resto de su perfil');
            setSignupError(false);
            setTimeout(() => {
                router.replace('/(auth)/completar_perfil');
            }, 1500);
        } else {
            setSignupMsg(result.error || 'Error al crear la cuenta');
            setSignupError(true);
        }

        setSignupLoading(false);
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
                    <View style={styles.hero}>
                        <View style={styles.heroHeader}>
                            <View style={styles.logoMark}>
                                <Ionicons name="restaurant-outline" size={30} color="#FFFFFF" />
                            </View>
                            <View style={styles.heroCopy}>
                                <Text style={styles.title}>rechipe</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.card}>
                        {/* Selector de Pestañas */}
                        <View style={styles.tabsContainer}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'login' && styles.activeTab]}
                                onPress={() => switchTab('login')}
                            >
                                <Text style={[styles.tabText, activeTab === 'login' && styles.activeTabText]}>
                                    Ingresar
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'signup' && styles.activeTab]}
                                onPress={() => switchTab('signup')}
                            >
                                <Text style={[styles.tabText, activeTab === 'signup' && styles.activeTabText]}>
                                    Registro
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Formulario de Login */}
                        {activeTab === 'login' && (
                            <View style={styles.form}>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Correo electronico"
                                        placeholderTextColor="#9CA3AF"
                                        value={loginEmail}
                                        onChangeText={setLoginEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        editable={!loginLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Contraseña"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry
                                        value={loginPassword}
                                        onChangeText={setLoginPassword}
                                        editable={!loginLoading}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[styles.button, loginLoading && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={loginLoading}
                                >
                                    {loginLoading ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.buttonText}>Continuar</Text>
                                    )}
                                </TouchableOpacity>

                                {loginMsg !== '' && (
                                    <Text style={[styles.statusText, loginError && styles.errorText]}>
                                        {loginMsg}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Formulario de Registro */}
                        {activeTab === 'signup' && (
                            <View style={styles.form}>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Nombre completo"
                                        placeholderTextColor="#9CA3AF"
                                        value={signupName}
                                        onChangeText={setSignupName}
                                        editable={!signupLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Correo electronico"
                                        placeholderTextColor="#9CA3AF"
                                        value={signupEmail}
                                        onChangeText={setSignupEmail}
                                        autoCapitalize="none"
                                        editable={!signupLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Contraseña"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry
                                        value={signupPassword}
                                        onChangeText={setSignupPassword}
                                        editable={!signupLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="shield-checkmark-outline" size={20} color="#9CA3AF" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirmar contraseña"
                                        placeholderTextColor="#9CA3AF"
                                        secureTextEntry
                                        value={signupConfirm}
                                        onChangeText={setSignupConfirm}
                                        editable={!signupLoading}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={[styles.button, signupLoading && styles.buttonDisabled]}
                                    onPress={handleSignup}
                                    disabled={signupLoading}
                                >
                                    {signupLoading ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.buttonText}>Crear cuenta</Text>
                                    )}
                                </TouchableOpacity>

                                {signupMsg !== '' && (
                                    <Text style={[styles.statusText, signupError && styles.errorText]}>
                                        {signupMsg}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
//cosas de diseño detalles
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0B0B0B',
    },
    container: {
        flex: 1,
        backgroundColor: '#0B0B0B',
    },
    scrollView: {
        flexGrow: 1,
        justifyContent: 'center',
        gap: 18,
        paddingHorizontal: 20,
        paddingTop: 54,
        paddingBottom: 48,
    },
    hero: {
        gap: 16,
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
    heroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logoMark: {
        width: 54,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: '#2A2A2A',
    },
    heroCopy: {
        gap: 10,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '900',
        lineHeight: 40,
    },
    subtitle: {
        color: '#B8B8B8',
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 21,
    },
    card: {
        gap: 22,
        backgroundColor: '#171717',
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 2,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'transparent',
    },
    tab: {
        flex: 1,
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        backgroundColor: '#101010',
    },
    activeTab: {
        backgroundColor: '#2A2A2A',
        borderColor: '#3A3A3A',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#9CA3AF',
    },
    activeTabText: {
        color: '#FFFFFF',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        borderRadius: 18,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        minWidth: 0,
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        paddingVertical: 12,
    },
    button: {
        minHeight: 56,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#0B0B0B',
        fontSize: 16,
        fontWeight: '900',
    },
    statusText: {
        color: '#4ade80',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
    },
    errorText: {
        color: '#f87171',
    },
});
