//SERVICIO DE VERIFICACIÓN DE CORREO ELECTRÓNICO (HU-11)
import { API_URL } from './api';

//TIPOS
export interface ResendVerificationResponse {
  msg?: string;
  error?: string;
}

export interface CheckVerificationResponse {
  verified: boolean;
  error?: string;
}

//FUNCIONES

//Reenvia el correo de verificacion
export async function resendVerificationEmail(email: string): Promise<ResendVerificationResponse> {
  try {
    const res = await fetch(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    return data;
  } catch (e: any) {
    return { error: `Error de conexión: ${e.message}` };
  }
}

//Verifica si el correo del usuario ya fue confirmado intentando un login
export async function checkEmailVerified(email: string, password: string): Promise<CheckVerificationResponse> {
  try {
    const res = await fetch(`${API_URL}/auth/check-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    return data;
  } catch (e: any) {
    return { verified: false, error: `Error de conexión: ${e.message}` };
  }
}
