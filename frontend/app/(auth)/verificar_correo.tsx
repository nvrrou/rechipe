import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { resendVerificationEmail } from '@/services/verificacion';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerificarCorreoScreen() {
  const router = useRouter();
  const { pendingVerificationEmail, login, pendingCredentials, clearPendingVerification } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const email = pendingVerificationEmail || '';

  // Countdown timer para cooldown de reenvío
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (!email || cooldown > 0) return;
    setResending(true);
    setMessage('');
    setIsError(false);

    const result = await resendVerificationEmail(email);

    if (result.error) {
      setMessage(result.error);
      setIsError(true);
    } else {
      setMessage('Correo de verificación reenviado. Revisa tu bandeja de entrada.');
      setIsError(false);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }

    setResending(false);
  }, [email, cooldown]);

  const handleCheckVerification = useCallback(async () => {
    if (!pendingCredentials) {
      setMessage('No se encontraron credenciales. Por favor, vuelve a iniciar sesión.');
      setIsError(true);
      return;
    }

    setChecking(true);
    setMessage('');
    setIsError(false);

    // Intentamos hacer login - si el email está verificado, Supabase nos dará el token
    const result = await login(pendingCredentials.email, pendingCredentials.password);

    if (result.success) {
      clearPendingVerification();
      setMessage('¡Correo verificado exitosamente!');
      setIsError(false);
      // El ProtectedLayout redirigirá automáticamente
    } else {
      const errorMsg = result.error || 'Error al verificar';
      // Si el error es por email no confirmado, mostramos mensaje específico
      if (errorMsg.toLowerCase().includes('email not confirmed') || errorMsg.toLowerCase().includes('no confirmado')) {
        setMessage('Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada y haz clic en el enlace de verificación.');
      } else {
        setMessage(errorMsg);
      }
      setIsError(true);
    }

    setChecking(false);
  }, [pendingCredentials, login, clearPendingVerification]);

  const handleSkip = useCallback(() => {
    clearPendingVerification();
    if (pendingCredentials) {
      router.replace('/(auth)/completar_perfil');
    }
  }, [clearPendingVerification, pendingCredentials, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={48} color="#064E2F" />
            </View>
            <Text style={styles.title}>Verifica tu correo</Text>
            <Text style={styles.subtitle}>
              Te enviamos un enlace de verificación a:
            </Text>
            <View style={styles.emailBadge}>
              <Ionicons name="at-outline" size={18} color="#00B86B" />
              <Text style={styles.emailText}>{email || 'tu correo'}</Text>
            </View>
          </View>

          {/* Card de instrucciones */}
          <View style={styles.card}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Revisa tu bandeja de entrada (y spam)</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Haz clic en el enlace de verificación</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Vuelve aquí y presiona "Ya verifiqué"</Text>
            </View>
          </View>

          {/* Botones de acción */}
          <View style={styles.actionsCard}>
            {/* Botón principal: Ya verifiqué */}
            <TouchableOpacity
              style={[styles.primaryButton, checking && styles.buttonDisabled]}
              onPress={handleCheckVerification}
              disabled={checking || resending}
            >
              {checking ? (
                <ActivityIndicator color="#FBFFF8" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#FBFFF8" />
                  <Text style={styles.primaryButtonText}>Ya verifiqué mi correo</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Botón secundario: Reenviar */}
            <TouchableOpacity
              style={[styles.secondaryButton, (cooldown > 0 || resending) && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={cooldown > 0 || resending}
            >
              {resending ? (
                <ActivityIndicator color="#064E2F" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={20} color="#064E2F" />
                  <Text style={styles.secondaryButtonText}>
                    {cooldown > 0
                      ? `Reenviar en ${cooldown}s`
                      : 'Reenviar correo de verificación'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Enlace: Continuar sin verificar */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipText}>Continuar sin verificar →</Text>
            </TouchableOpacity>
          </View>

          {/* Mensaje de estado */}
          {message !== '' && (
            <View style={[styles.messageCard, isError ? styles.messageError : styles.messageSuccess]}>
              <Ionicons
                name={isError ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                size={20}
                color={isError ? '#DC2626' : '#00B86B'}
              />
              <Text style={[styles.messageText, isError ? styles.messageTextError : styles.messageTextSuccess]}>
                {message}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  iconContainer: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#9FE7B9',
    marginBottom: 8,
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 3,
  },
  title: {
    color: '#064E2F',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#2F7A4F',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E9FBEF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#9FE7B9',
  },
  emailText: {
    color: '#064E2F',
    fontSize: 15,
    fontWeight: '800',
  },
  card: {
    gap: 14,
    backgroundColor: '#E9FBEF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#9FE7B9',
    shadowColor: '#74D997',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#00B86B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FBFFF8',
    fontSize: 14,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actionsCard: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 56,
    backgroundColor: '#00B86B',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#00B86B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FBFFF8',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 52,
    backgroundColor: '#DDF8E7',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#9FE7B9',
  },
  secondaryButtonText: {
    color: '#064E2F',
    fontSize: 14,
    fontWeight: '800',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    color: '#2F7A4F',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  messageSuccess: {
    backgroundColor: '#E9FBEF',
    borderColor: '#74D997',
  },
  messageError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  messageTextSuccess: {
    color: '#064E2F',
  },
  messageTextError: {
    color: '#DC2626',
  },
});
