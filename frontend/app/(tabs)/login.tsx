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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('login');

  // Estados de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMsg, setLoginMsg] = useState('');

  // Estados de Registro
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupMsg, setSignupMsg] = useState('');

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    setLoginMsg('');
    setSignupMsg('');
  };

  const handleLogin = () => {
    const email = loginEmail.trim();
    const pwd = loginPassword.trim();

    if (!email || !pwd) {
      setLoginMsg('Campos obligatorios faltantes');
      return;
    }

    if (!email.includes('@')) {
      setLoginMsg('Formato de correo invalido');
      return;
    }

    // Simulacion de inicio de sesion exitoso
    setLoginMsg('Accediendo...');
    setTimeout(() => {
      // Navega a la carpeta (tabs) que mostraste en tu imagen
      router.replace('/(tabs)');
    }, 1000);
  };

  const handleSignup = () => {
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm) {
      setSignupMsg('Complete todos los campos');
      return;
    }

    if (signupPassword !== signupConfirm) {
      setSignupMsg('Las contraseñas no coinciden');
      return;
    }

    setSignupMsg('Cuenta creada exitosamente');
    setTimeout(() => {
      switchTab('login');
    }, 1500);
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
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Correo electronico"
                    placeholderTextColor="#555"
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contraseña"
                    placeholderTextColor="#555"
                    secureTextEntry
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                  />
                </View>
                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                  <Text style={styles.buttonText}>Continuar</Text>
                </TouchableOpacity>
                
                {loginMsg !== '' && (
                  <Text style={styles.statusText}>{loginMsg}</Text>
                )}
              </View>
            )}

            {/* Formulario de Registro */}
            {activeTab === 'signup' && (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre completo"
                    placeholderTextColor="#555"
                    value={signupName}
                    onChangeText={setSignupName}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder="Correo electronico"
                    placeholderTextColor="#555"
                    value={signupEmail}
                    onChangeText={setSignupEmail}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder="Contraseña"
                    placeholderTextColor="#555"
                    secureTextEntry
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmar contraseña"
                    placeholderTextColor="#555"
                    secureTextEntry
                    value={signupConfirm}
                    onChangeText={setSignupConfirm}
                  />
                </View>
                <TouchableOpacity style={styles.button} onPress={handleSignup}>
                  <Text style={styles.buttonText}>Crear cuenta</Text>
                </TouchableOpacity>

                {signupMsg !== '' && (
                  <Text style={styles.statusText}>{signupMsg}</Text>
                )}
              </View>
            )}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  form: {
    gap: 16,
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
  icon: {
    marginRight: 12,
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
    marginTop: 8,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
