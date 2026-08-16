// Cliente HTTP para la API de Wapi, adaptado a React Native.
//
// Autenticación (según el backend):
//   - X-Api-Key    → endpoints de tenant (mensajes, estadísticas, flows, sesiones, archivos, webhooks)
//   - Bearer JWT   → autoservicio (/api/me), bandeja del agente e identidad
//
// Diferencia clave con el panel web: aquí NO hay «mismo origen». El navegador podía llamar a
// rutas relativas y dejar que el proxy (Vite en desarrollo, nginx en producción) encontrase el
// backend; una app nativa no tiene ese proxy detrás, así que la URL base absoluta es obligatoria
// y es lo primero que hay que configurar. Por eso el error de «falta la URL base» es explícito y
// no un fallo de red genérico: sin él, la primera pantalla parecería una API caída.

export type AuthKind = 'tenant' | 'bearer' | 'none';

export interface Credentials {
  baseUrl: string;
  tenantApiKey: string;
  bearerToken: string;
  /** Token de refresco, si la sesión se inició con usuario. */
  refreshToken: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  /** Código de negocio del backend: quota_exceeded, permission_denied, service_window_closed… */
  code?: string;
  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

/** Traduce los mensajes de validación más comunes de ASP.NET al español. */
function translate(msg: string): string {
  const m = msg
    .replace(
      /The field (\w+) must be a string or array type with a minimum length of '(\d+)'\.?/i,
      'El campo $1 debe tener al menos $2 caracteres.',
    )
    .replace(/The (\w+) field is not a valid e-mail address\.?/i, 'El campo $1 no es un email válido.')
    .replace(/The (\w+) field is required\.?/i, 'El campo $1 es obligatorio.');
  return m
    .replace(/\bPassword\b/g, 'contraseña')
    .replace(/\bEmail\b/g, 'email')
    .replace(/\bOrganizationName\b/g, 'nombre de la organización');
}

/**
 * Pista añadida al mensaje del backend para los errores que tienen una salida concreta. Sin
 * esto, un 402 se lee como un fallo pasajero y el usuario reintenta en bucle.
 */
const CODE_HINTS: Record<string, string> = {
  quota_exceeded: 'Se agotó el cupo del plan: hay que ampliarlo, esperar no lo arregla.',
  permission_denied: 'El rol no tiene este permiso. Revísalo en «Usuarios y roles».',
  service_window_closed:
    'Pasaron 24 h desde el último mensaje del contacto: solo se puede escribir con plantilla.',
  opted_out: 'El contacto se dio de baja.',
};

/** Código de negocio que acompaña al error, si el backend lo envió. */
function extractCode(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const code = (body as Record<string, unknown>).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** Devuelve un mensaje legible a partir de una respuesta de error del backend. */
function extractError(status: number, body: unknown): string {
  const hint = CODE_HINTS[extractCode(body) ?? ''];

  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.error === 'string') return hint ? `${b.error} ${hint}` : b.error;
    // Los errores de validación específicos por campo tienen prioridad sobre el
    // "title" genérico ("One or more validation errors occurred.").
    if (b.errors && typeof b.errors === 'object') {
      const msgs = Object.values(b.errors as Record<string, string[]>).flat();
      if (msgs.length) return msgs.map(translate).join(' ');
    }
    if (typeof b.title === 'string') return b.title;
  }
  return `Error ${status}`;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: string;
  auth?: AuthKind;
  query?: QueryParams;
  body?: unknown;
  /** Cuerpo multipart (FormData); tiene prioridad sobre body. */
  formData?: FormData;
  signal?: AbortSignal;
  /** Milisegundos antes de abortar. En móvil una red que no responde cuelga la pantalla. */
  timeoutMs?: number;
}

/**
 * Tope por petición. El backend responde rápido, así que un silencio largo es una red móvil que
 * se fue: sin este corte la pantalla se queda cargando para siempre y no hay forma de reintentar.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Normaliza la URL base: sin barra final y solo http(s). Cadena vacía si no vale. */
export function normalizeBaseUrl(raw: string): string {
  const base = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(base) ? base : '';
}

export function buildQueryString(query?: QueryParams): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function createApiClient(
  getCreds: () => Credentials,
  /**
   * Se invoca cuando el backend rechaza con 401 una petición que **sí** llevaba credenciales:
   * las que hay dejaron de valer (token caducado, revocado o contraseña cambiada).
   *
   * La distinción importa: un 401 sin credenciales es la respuesta normal del login a una
   * contraseña equivocada, y confundirlo con una sesión caída sacaría el aviso justo a quien
   * todavía no ha entrado.
   */
  onUnauthorized?: () => void,
  /**
   * Renueva la sesión con el token de refresco y devuelve el token de acceso nuevo, o null si ya
   * no se puede. Lo aporta quien tenga acceso al estado de conexión, porque hay que guardar el
   * par nuevo, no solo usarlo.
   */
  onRefresh?: () => Promise<string | null>,
) {
  /**
   * Renovación en curso, si la hay.
   *
   * Cuando caduca el token, todas las peticiones en vuelo devuelven 401 casi a la vez. Sin esto,
   * cada una lanzaría su propia renovación y —como el refresco rota y solo se puede canjear una
   * vez— la primera invalidaría el token que usan las demás: el servidor lo leería como una
   * reutilización y cerraría la sesión. Compartiendo la promesa, solo se canjea una vez.
   */
  let renovacion: Promise<string | null> | null = null;

  function renovarUnaVez(): Promise<string | null> {
    if (!onRefresh) return Promise.resolve(null);
    renovacion ??= onRefresh().finally(() => {
      renovacion = null;
    });
    return renovacion;
  }

  /** URL base utilizable. Vacía si no hay ninguna configurada o está malformada. */
  function resolveBase(): string {
    return normalizeBaseUrl(getCreds().baseUrl);
  }

  function buildUrl(path: string, query?: QueryParams, base: string = resolveBase()): string {
    return `${base}${path}${buildQueryString(query)}`;
  }

  function authHeaders(auth: AuthKind): Record<string, string> {
    const creds = getCreds();
    switch (auth) {
      case 'tenant':
        // Preferimos la clave de tenant (X-Api-Key); si no hay, usamos la sesión de
        // usuario (JWT), que el backend acepta para operar el propio tenant.
        if (creds.tenantApiKey) return { 'X-Api-Key': creds.tenantApiKey };
        if (creds.bearerToken) return { Authorization: `Bearer ${creds.bearerToken}` };
        return {};
      case 'bearer':
        return creds.bearerToken ? { Authorization: `Bearer ${creds.bearerToken}` } : {};
      default:
        return {};
    }
  }

  /**
   * Une el AbortSignal de quien llama con el del temporizador, para que cancelar la pantalla y
   * agotar el tiempo lleven al mismo sitio. Devuelve también el motivo del corte: un abort por
   * temporizador y uno por desmontar el componente se cuentan distinto.
   */
  function withTimeout(signal: AbortSignal | undefined, ms: number) {
    const ctrl = new AbortController();
    let expirado = false;
    const timer = setTimeout(() => {
      expirado = true;
      ctrl.abort();
    }, ms);
    const propagar = () => ctrl.abort();
    signal?.addEventListener('abort', propagar);
    return {
      signal: ctrl.signal,
      expirado: () => expirado,
      limpiar: () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', propagar);
      },
    };
  }

  async function request<T>(
    path: string,
    opts: RequestOptions = {},
    /**
     * Interno: marca el reintento posterior a una renovación, para no entrar en bucle si la
     * sesión nueva también es rechazada.
     */
    yaRenovado = false,
  ): Promise<T> {
    const {
      method = 'GET',
      auth = 'none',
      query,
      body,
      formData,
      signal,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = opts;

    const base = resolveBase();
    if (!base) {
      throw new ApiError(
        0,
        'No hay URL de la API configurada. Ponla en Ajustes → Conexión ' +
          '(por ejemplo https://api.tu-dominio.com).',
        null,
      );
    }

    const credenciales = authHeaders(auth);
    const conCredenciales = Object.keys(credenciales).length > 0;
    const headers: Record<string, string> = { Accept: 'application/json', ...credenciales };
    let payload: BodyInit | undefined;

    if (formData) {
      payload = formData; // RN pone el Content-Type con boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const url = buildUrl(path, query, base);
    const reloj = withTimeout(signal, timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: payload, signal: reloj.signal });
    } catch (e) {
      if (reloj.expirado()) {
        throw new ApiError(
          0,
          `La API de ${base} tardó más de ${Math.round(timeoutMs / 1000)} s en responder. ` +
            'Comprueba la cobertura y que el servidor esté en marcha.',
          null,
        );
      }
      // Aborto de quien llamó (pantalla cerrada, búsqueda re-lanzada): se propaga tal cual.
      if (signal?.aborted || (e as Error).name === 'AbortError') throw e;
      throw new ApiError(
        0,
        `No se pudo conectar con la API en ${base}. Revisa la URL en Ajustes → Conexión y que ` +
          'el servidor sea accesible desde este dispositivo.',
        null,
      );
    } finally {
      reloj.limpiar();
    }

    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const parsed = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      // 401 con credenciales: antes de dar la sesión por perdida, se intenta renovar y repetir.
      // Es lo que hace que el token de acceso pueda ser corto sin que se note al usarlo.
      if (res.status === 401 && conCredenciales && !yaRenovado) {
        const nuevo = await renovarUnaVez();
        if (nuevo) return request<T>(path, opts, true);
      }

      if (res.status === 401 && conCredenciales) onUnauthorized?.();
      throw new ApiError(res.status, extractError(res.status, parsed), parsed, extractCode(parsed));
    }

    // Si esperábamos JSON pero llegó HTML, la URL base apunta al frontend (o a cualquier otra
    // web) en vez de al backend. Se dice a dónde se llamó: sin eso, el mensaje no lleva a nada.
    if (typeof parsed === 'string' && parsed.trimStart().startsWith('<')) {
      throw new ApiError(
        res.status,
        `La API devolvió HTML en lugar de JSON al llamar a ${url}. O la URL de «Conexión» apunta ` +
          'al panel web en vez de al backend, o ese backend es de una versión anterior y no ' +
          'tiene esta ruta.',
        parsed,
      );
    }

    return parsed as T;
  }

  /**
   * URL absoluta y cabeceras de una descarga (CSV, media). En móvil no se descarga a un Blob: se
   * baja a disco con expo-file-system o se abre en el navegador, y ambas cosas necesitan esto.
   */
  function downloadRequest(path: string, query?: QueryParams) {
    return { url: buildUrl(path, query), headers: authHeaders('tenant') };
  }

  return { request, buildUrl, authHeaders, downloadRequest, resolveBase };
}

export type ApiClient = ReturnType<typeof createApiClient>;
