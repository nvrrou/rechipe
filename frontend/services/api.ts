import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://rechipe.onrender.com';

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  const host = typeof hostUri === 'string' ? hostUri.split(':')[0] : undefined;

  if (__DEV__) {
    if (Platform.OS === 'web') {
      return 'http://localhost:8000';
    }

    if (host) {
      return `http://${host}:8000`;
    }
  }

  return PRODUCTION_API_URL;
}

// URL base del backend FastAPI
export const API_URL = getApiUrl();

// ---------- Tipos ----------

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    email: string;
    nombre: string;
    edad: number;
    peso: number;
    altura: number;
    genero: string;
    objetivos: string[];
    restricciones: string[];
    ingredientes_favoritos: string[];
  };
  error?: string;
}

export interface RegisterResponse {
  id?: string;
  email?: string;
  nombre?: string;
  error?: string;
}

// ---------- Funciones ----------

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  return data;
}

export interface RegisterData {
  email: string;
  password: string;
  nombre: string;
  edad?: number;
  peso?: number;
  altura?: number;
  genero?: string;
  objetivos?: string[];
  restricciones?: string[];
  ingredientes_favoritos?: string[];
}

export async function registerUser(data: RegisterData): Promise<RegisterResponse> {
  // Enviamos todos los campos que el backend espera, con defaults para los opcionales
  const payload = {
    email: data.email,
    password: data.password,
    nombre: data.nombre,
    edad: data.edad ?? 0,
    peso: data.peso ?? 0,
    altura: data.altura ?? 0,
    genero: data.genero ?? '',
    objetivos: data.objetivos ?? [],
    restricciones: data.restricciones ?? [],
    ingredientes_favoritos: data.ingredientes_favoritos ?? [],
  };

  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const responseData = await res.json();
  return responseData;
}

export interface UpdateProfileData {
  user_id: string;
  edad: number;
  peso: number;
  altura: number;
  genero: string;
  objetivos: string[];
  restricciones: string[];
  ingredientes_favoritos: string[];
}

export async function updateUserProfile(data: UpdateProfileData): Promise<{ msg?: string; error?: string }> {
  const res = await fetch(`${API_URL}/auth/update_profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const responseData = await res.json();
  return responseData;
}
