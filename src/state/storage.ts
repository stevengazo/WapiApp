import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Dónde vive la sesión en el dispositivo.
 *
 * Los tokens van al llavero del sistema (Keychain en iOS, EncryptedSharedPreferences en Android)
 * y el resto —URL de la API, cuenta activa, nombre— a AsyncStorage. La separación no es estética:
 * AsyncStorage es texto plano en el sandbox de la app, así que un dispositivo con root deja el
 * JWT a la vista. Y al revés, SecureStore en Android tiene un tope de ~2 KB por valor, de modo
 * que meter ahí el estado entero se rompería en cuanto creciera.
 *
 * En web no existe SecureStore: se degrada a AsyncStorage (localStorage). El modo web es para
 * probar rápido en el escritorio, no para operar con una sesión real.
 */
const usaLlavero = Platform.OS !== 'web';

export async function getSecret(key: string): Promise<string | null> {
  try {
    if (!usaLlavero) return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    // Llavero bloqueado o valor ilegible tras reinstalar: se trata como «no hay sesión».
    return null;
  }
}

export async function setSecret(key: string, value: string): Promise<void> {
  try {
    if (!usaLlavero) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    // Cadena vacía = borrar. SecureStore no distingue «vacío» de «ausente» al leer, y dejar la
    // clave con "" haría que un token borrado se leyera como presente.
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    /* sin almacenamiento seguro: la sesión durará lo que dure la app en memoria */
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
}
