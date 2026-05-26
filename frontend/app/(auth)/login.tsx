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
                                <Ionicons name="restaurant-outline" size={30} color="#064E2F" />
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
                                    <Ionicons name="mail-outline" size={20} color="#2F7A4F" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Correo electronico"
                                        placeholderTextColor="#2F7A4F"
                                        value={loginEmail}
                                        onChangeText={setLoginEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        editable={!loginLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#2F7A4F" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Contraseña"
                                        placeholderTextColor="#2F7A4F"
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
                                        <ActivityIndicator color="#FBFFF8" />
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
                                    <Ionicons name="person-outline" size={20} color="#2F7A4F" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Nombre completo"
                                        placeholderTextColor="#2F7A4F"
                                        value={signupName}
                                        onChangeText={setSignupName}
                                        editable={!signupLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="mail-outline" size={20} color="#2F7A4F" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Correo electronico"
                                        placeholderTextColor="#2F7A4F"
                                        value={signupEmail}
                                        onChangeText={setSignupEmail}
                                        autoCapitalize="none"
                                        editable={!signupLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#2F7A4F" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Contraseña"
                                        placeholderTextColor="#2F7A4F"
                                        secureTextEntry
                                        value={signupPassword}
                                        onChangeText={setSignupPassword}
                                        editable={!signupLoading}
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Ionicons name="shield-checkmark-outline" size={20} color="#2F7A4F" style={styles.icon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirmar contraseña"
                                        placeholderTextColor="#2F7A4F"
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
                                        <ActivityIndicator color="#FBFFF8" />
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
        backgroundColor: '#FBFFF8',
    },
    container: {
        flex: 1,
        backgroundColor: '#FBFFF8',
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
        paddingVertical: 4,
        backgroundColor: 'transparent',
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
        backgroundColor: '#9FE7B9',
    },
    heroCopy: {
        gap: 10,
    },
    title: {
        color: '#064E2F',
        fontSize: 36,
        fontWeight: '900',
        lineHeight: 40,
    },
    subtitle: {
        color: '#2F7A4F',
        fontSize: 15,
        fontWeight: '700',
        lineHeight: 21,
    },
    card: {
        gap: 22,
        backgroundColor: '#E9FBEF',
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: '#9FE7B9',
        shadowColor: '#74D997',
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
        borderColor: '#9FE7B9',
        backgroundColor: '#DDF8E7',
    },
    activeTab: {
        backgroundColor: '#9FE7B9',
        borderColor: '#3A3A3A',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#2F7A4F',
    },
    activeTabText: {
        color: '#064E2F',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DDF8E7',
        borderRadius: 18,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#9FE7B9',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        minWidth: 0,
        color: '#064E2F',
        fontSize: 16,
        fontWeight: '800',
        paddingVertical: 12,
    },
    button: {
        minHeight: 56,
        backgroundColor: '#00B86B',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: '#00B86B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
        elevation: 3,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FBFFF8',
        fontSize: 16,
        fontWeight: '900',
    },
    statusText: {
        color: '#00B86B',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 8,
    },
    errorText: {
        color: '#FF8A8A',
    },
});
