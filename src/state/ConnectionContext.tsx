import Constants from 'expo-constants';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { createApiClient, normalizeBaseUrl, type ApiClient, type Credentials } from '@/api/client';
import { getItem, getSecret, setItem, setSecret } from './storage';

/**
 * Por qué dejó de haber sesión. No es un detalle cosmético: cada motivo lleva a una explicación
 * distinta, y «tu sesión se cerró» a secas hace que la gente sospeche de un fallo de la app.
 */
export type SessionEndReason = 'caducada' | 'rechazada';

export interface ConnectionState extends Credentials {
  /**
   * Organización del usuario, tomada del claim `tenant_id` al iniciar sesión. No se elige ni se
   * cambia desde la app: un usuario pertenece a una sola organización.
   */
  tenantId: string;
  /** Cuenta de WhatsApp activa para operaciones (mensajes, contactos, etc.). */
  accountId: string;
  /** Identidad del usuario autenticado por JWT. */
  userEmail: string;
  userName: string;
  userRole: string;
}

interface ConnectionContextValue {
  conn: ConnectionState;
  /** True mientras se lee la sesión guardada; hasta entonces no se sabe si hay que ir al login. */
  hydrating: boolean;
  update: (patch: Partial<ConnectionState>) => void;
  reset: () => void;
  /** Cierra la sesión: borra el JWT, la identidad y todo el contexto del tenant. */
  signOut: () => void;
  api: ApiClient;
  /** ¿Hay clave de tenant (X-Api-Key) configurada? */
  hasTenantKey: boolean;
  /** ¿Hay sesión de usuario (JWT)? */
  hasBearer: boolean;
  /** ¿El usuario de la sesión está asociado a una organización? */
  hasTenant: boolean;
  /** Sesión válida: JWT + organización asociada. */
  hasSession: boolean;
  /** Motivo por el que la sesión dejó de valer, mientras el aviso siga sin atender. */
  sessionEnded: SessionEndReason | null;
  /** Cierra el aviso de sesión caída y limpia las credenciales muertas. */
  dismissSessionEnded: () => void;
}

/** Claves en el llavero del sistema. Un valor por clave: SecureStore no guarda objetos. */
const SECRET_KEYS = ['bearerToken', 'refreshToken', 'tenantApiKey'] as const;

/** El resto del estado, en un solo JSON de AsyncStorage. */
const PLAIN_KEY = 'wapi.connection';
type PlainKey = 'baseUrl' | 'tenantId' | 'accountId' | 'userEmail' | 'userName' | 'userRole';
const PLAIN_KEYS: PlainKey[] = [
  'baseUrl',
  'tenantId',
  'accountId',
  'userEmail',
  'userName',
  'userRole',
];

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

/**
 * Un usuario solo es válido si pertenece a una organización: el backend emite el
 * claim `tenant_id` y lo devuelve en `user.tenantId`. Sin él no hay sesión.
 */
export function isTenantAssigned(tenantId: string | null | undefined): boolean {
  const value = (tenantId ?? '').trim();
  return value.length > 0 && value !== EMPTY_GUID;
}

/**
 * URL de la API con la que arranca una instalación nueva.
 *
 * `EXPO_PUBLIC_API_URL` se resuelve al compilar el bundle y sirve para las builds internas, donde
 * nadie debería tener que teclear la URL. En su defecto, `extra.apiBaseUrl` de app.json. Si no
 * hay ninguna, la app pide la dirección en la pantalla de conexión: es lo correcto para un
 * backend autoalojado, que es a lo que apunta cada cliente.
 */
export const DEFAULT_BASE_URL = primeraNoVacia([
  // Ojo con `??` aquí: la variable se inlinea al compilar, así que en un CI que la exporte vacía
  // llegaría como `''` —que no es nullish— y se comería el valor de app.json. Hay que descartar
  // las cadenas en blanco explícitamente.
  process.env.EXPO_PUBLIC_API_URL,
  (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.apiBaseUrl as
    | string
    | undefined,
]);

function primeraNoVacia(valores: (string | undefined)[]): string {
  for (const v of valores) {
    const normalizada = normalizeBaseUrl(v ?? '');
    if (normalizada) return normalizada;
  }
  return '';
}

const defaults: ConnectionState = {
  baseUrl: DEFAULT_BASE_URL,
  tenantApiKey: '',
  bearerToken: '',
  refreshToken: '',
  tenantId: '',
  accountId: '',
  userEmail: '',
  userName: '',
  userRole: '',
};

async function load(): Promise<ConnectionState> {
  const [plainRaw, ...secretos] = await Promise.all([
    getItem(PLAIN_KEY),
    ...SECRET_KEYS.map((k) => getSecret(`wapi.${k}`)),
  ]);

  let plain: Partial<ConnectionState> = {};
  try {
    if (plainRaw) plain = JSON.parse(plainRaw) as Partial<ConnectionState>;
  } catch {
    /* contenido ilegible: se arranca limpio */
  }

  const state = { ...defaults };
  for (const k of PLAIN_KEYS) {
    const v = plain[k];
    if (typeof v === 'string') state[k] = v;
  }
  SECRET_KEYS.forEach((k, i) => {
    state[k] = secretos[i] ?? '';
  });
  return state;
}

async function save(next: ConnectionState, previo: ConnectionState): Promise<void> {
  const plain: Record<string, string> = {};
  for (const k of PLAIN_KEYS) plain[k] = next[k];
  const escrituras: Promise<void>[] = [setItem(PLAIN_KEY, JSON.stringify(plain))];

  // Solo se toca el llavero cuando el valor cambia: cada escritura cruza el puente nativo y
  // puede pedir desbloqueo, y esto se llama en cada cambio de cuenta activa o de nombre.
  for (const k of SECRET_KEYS) {
    if (next[k] !== previo[k]) escrituras.push(setSecret(`wapi.${k}`, next[k]));
  }
  await Promise.all(escrituras);
}

/**
 * Decodifica base64 (o base64url) a texto latin-1. Hermes no trae `atob` en todas las versiones y
 * aquí solo hace falta leer un número (`exp`) de un JSON: los caracteres multibyte de otros
 * claims quedan como bytes sueltos dentro de cadenas, que `JSON.parse` acepta sin problema.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64Decode(input: string): string {
  const limpio = input.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  let salida = '';
  for (let i = 0; i < limpio.length; i += 4) {
    const n =
      (B64.indexOf(limpio[i]) << 18) |
      (B64.indexOf(limpio[i + 1]) << 12) |
      ((limpio[i + 2] ? B64.indexOf(limpio[i + 2]) : 0) << 6) |
      (limpio[i + 3] ? B64.indexOf(limpio[i + 3]) : 0);
    salida += String.fromCharCode((n >> 16) & 0xff);
    if (limpio[i + 2]) salida += String.fromCharCode((n >> 8) & 0xff);
    if (limpio[i + 3]) salida += String.fromCharCode(n & 0xff);
  }
  return salida;
}

/**
 * Momento (ms) en que caduca el JWT según su claim `exp`, o null si el token no lo dice.
 *
 * Se lee el payload sin verificar la firma a propósito: aquí no se decide ningún permiso —de eso
 * se encarga el backend—, solo cuándo avisar. Un token manipulado como mucho adelantaría su
 * propio aviso.
 */
function jwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const { exp } = JSON.parse(base64Decode(payload)) as { exp?: unknown };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Tope de setTimeout (~24,8 días): por encima, el temporizador dispara de inmediato. */
const MAX_TIMEOUT = 2_147_483_647;

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<ConnectionState>(defaults);
  const [hydrating, setHydrating] = useState(true);

  // Ref siempre actualizado para que el ApiClient lea el estado más reciente.
  const connRef = useRef(conn);
  connRef.current = conn;

  const persist = useCallback((next: ConnectionState) => {
    const previo = connRef.current;
    connRef.current = next;
    setConn(next);
    void save(next, previo);
  }, []);

  useEffect(() => {
    let vivo = true;
    void load().then((guardado) => {
      if (!vivo) return;
      connRef.current = guardado;
      setConn(guardado);
      setHydrating(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const [sesionCaida, setSesionCaida] = useState<SessionEndReason | null>(null);
  // El ref, y no el estado, es lo que corta las repeticiones: en cuanto caduca el token, todas
  // las peticiones en vuelo devuelven 401 a la vez, y el estado todavía no se ha propagado.
  const caidaRef = useRef<SessionEndReason | null>(null);

  const marcarCaida = useCallback((motivo: SessionEndReason) => {
    if (caidaRef.current) return;
    // Sin sesión no hay nada que perder: el 401 es del endpoint, no de las credenciales.
    if (!connRef.current.bearerToken) return;
    caidaRef.current = motivo;
    setSesionCaida(motivo);
  }, []);

  /**
   * Canjea el token de refresco por una sesión nueva y la guarda.
   *
   * Se llama con `fetch` directo y no con el propio cliente para no morderse la cola: el cliente
   * reacciona a un 401 llamando aquí, y si esta llamada pasara por él, un refresco rechazado
   * dispararía otra renovación.
   */
  const renovar = useCallback(async (): Promise<string | null> => {
    const actual = connRef.current;
    const base = normalizeBaseUrl(actual.baseUrl);
    if (!actual.refreshToken || !base) return null;

    try {
      const res = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: actual.refreshToken }),
      });
      if (!res.ok) return null;

      const datos = (await res.json()) as { token?: string; refreshToken?: string };
      if (!datos.token || !datos.refreshToken) return null;

      // El par nuevo se guarda entero: el de refresco acaba de rotar y el viejo ya no vale.
      persist({ ...connRef.current, bearerToken: datos.token, refreshToken: datos.refreshToken });
      return datos.token;
    } catch {
      return null;
    }
  }, [persist]);

  // `persist`, `marcarCaida` y `renovar` son estables, así que el cliente se crea una sola vez.
  const api = useMemo(
    () => createApiClient(() => connRef.current, () => marcarCaida('rechazada'), renovar),
    [marcarCaida, renovar],
  );

  const update = useCallback(
    (patch: Partial<ConnectionState>) => persist({ ...connRef.current, ...patch }),
    [persist],
  );

  const reset = useCallback(() => persist({ ...defaults }), [persist]);

  // Al cerrar sesión no basta con soltar el JWT: la clave del tenant y el tenant
  // activo darían acceso al área privada sin haber iniciado sesión. La URL de la API sí se
  // conserva: es configuración del dispositivo, no de la persona, y volver a teclearla en cada
  // inicio de sesión no protege de nada.
  const signOut = useCallback(() => {
    // Se avisa al servidor para que revoque la cadena: borrar el token solo de aquí lo dejaría
    // válido durante días para quien lo tuviera copiado. No se espera la respuesta ni se
    // reintenta — cerrar sesión no puede quedarse bloqueado porque la red falle.
    const { refreshToken, baseUrl } = connRef.current;
    const base = normalizeBaseUrl(baseUrl);
    if (refreshToken && base) {
      void fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }

    persist({
      ...defaults,
      baseUrl: connRef.current.baseUrl,
    });
  }, [persist]);

  /**
   * Caducidad anunciada por el propio token. Esperar al primer 401 dejaría la app enseñando
   * datos viejos como si nada hasta que a alguien se le ocurriera pulsar algo; con el `exp` se
   * avisa en el momento exacto.
   *
   * El temporizador cubre la app en primer plano y la revisión al volver a ella cubre el móvil
   * suspendido, donde el sistema congela los temporizadores y despiertan tarde. En móvil esto es
   * la norma, no la excepción: la app pasa la mayor parte del tiempo en segundo plano.
   */
  useEffect(() => {
    const token = conn.bearerToken;
    if (!token) return;
    const caduca = jwtExpiry(token);
    if (caduca === null) return;

    // Al caducar se intenta renovar antes de dar la sesión por perdida: con refresco válido, la
    // persona no se entera de que el token de acceso se acaba cada dos horas. Solo si la
    // renovación falla —refresco caducado, revocado o reutilizado— sale el aviso.
    const revisar = () => {
      if (Date.now() < caduca) return;
      void renovar().then((nuevo) => {
        if (!nuevo) marcarCaida('caducada');
      });
    };
    revisar();

    const restante = caduca - Date.now();
    const temporizador =
      restante > 0 && restante <= MAX_TIMEOUT ? setTimeout(revisar, restante) : undefined;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisar();
    });
    return () => {
      if (temporizador !== undefined) clearTimeout(temporizador);
      sub.remove();
    };
  }, [conn.bearerToken, marcarCaida, renovar]);

  // Atender el aviso es lo que de verdad cierra la sesión: hasta entonces las credenciales
  // muertas se conservan para que las guardas no cambien de pantalla por debajo del modal y la
  // persona pueda leerlo sobre lo que estaba haciendo.
  const dismissSessionEnded = useCallback(() => {
    caidaRef.current = null;
    setSesionCaida(null);
    signOut();
  }, [signOut]);

  const value = useMemo<ConnectionContextValue>(() => {
    const hasBearer = conn.bearerToken.trim().length > 0;
    const hasTenant = isTenantAssigned(conn.tenantId);
    return {
      conn,
      hydrating,
      update,
      reset,
      signOut,
      api,
      hasTenantKey: conn.tenantApiKey.trim().length > 0,
      hasBearer,
      hasTenant,
      hasSession: hasBearer && hasTenant,
      sessionEnded: sesionCaida,
      dismissSessionEnded,
    };
  }, [conn, hydrating, update, reset, signOut, api, sesionCaida, dismissSessionEnded]);

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection debe usarse dentro de <ConnectionProvider>');
  return ctx;
}
