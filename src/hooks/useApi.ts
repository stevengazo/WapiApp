import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { makeEndpoints, type Endpoints } from '@/api/endpoints';
import { useConnection } from '@/state/ConnectionContext';

/** Devuelve los endpoints tipados ligados a la conexión actual. */
export function useEndpoints(): Endpoints {
  const { api } = useConnection();
  return useMemo(() => makeEndpoints(api), [api]);
}

/**
 * Gestión de la propia organización, siempre vía `/api/me`. El tenant lo fija el JWT: no hay
 * modo administrador porque operar sobre organizaciones ajenas es cosa de la plataforma, no
 * de esta app.
 */
export function useTenantEndpoints() {
  const ep = useEndpoints();
  return useMemo(
    () => ({
      listAccounts: () => ep.myAccounts(),
      createAccount: (b: Parameters<typeof ep.createMyAccount>[0]) => ep.createMyAccount(b),
      deleteAccount: (id: string) => ep.deleteMyAccount(id),
      listUsers: () => ep.myUsers(),
      listRoles: () => ep.myRoles(),
      listApiKeys: () => ep.myApiKeys(),
      createApiKey: (name: string) => ep.myCreateApiKey(name),
      revokeApiKey: (id: string) => ep.myRevokeApiKey(id),
    }),
    [ep],
  );
}

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  /**
   * Código HTTP del fallo, cuando lo hubo. Con el mensaje solo no se puede distinguir «esto no
   * existe todavía» de «esto falló»: un 404 en una función recién añadida significa que la API
   * desplegada es anterior, y eso se le explica al usuario de otra manera.
   */
  status?: number;
}

/**
 * Ejecuta una función asíncrona y expone {data, loading, error, reload}.
 * Se re-ejecuta cuando cambian las dependencias.
 *
 * `refreshing` distingue el primer arranque de un tirón para recargar: en móvil son dos estados
 * visuales distintos —pantalla vacía con spinner frente a la lista de siempre con el indicador
 * arriba— y mezclarlos hace parpadear la lista entera en cada gesto.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): AsyncState<T> & { refreshing: boolean; reload: () => void; refresh: () => void } {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: enabled,
    error: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  // La función se guarda en un ref para que el efecto dependa solo de `deps`: si dependiera de
  // `fn`, una flecha creada en el render dispararía una petición en cada pintado.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, loading: false, error: null });
      return;
    }
    const runId = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (runId === latest.current) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        if (runId !== latest.current) return;
        const msg = e instanceof ApiError ? e.message : (e as Error).message;
        setState({
          data: undefined,
          loading: false,
          error: msg,
          status: e instanceof ApiError ? e.status : undefined,
        });
      })
      .finally(() => {
        if (runId === latest.current) setRefreshing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  return { ...state, refreshing, reload, refresh };
}

/** Envuelve una acción mutable con estado de envío/errores. */
export function useAction<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
): {
  run: (...args: Args) => Promise<R | undefined>;
  loading: boolean;
  error: string | null;
  status?: number;
  clearError: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | undefined>(undefined);

  // Guardamos siempre la última versión de `fn` para no capturar un closure
  // obsoleto (con el estado del primer render). Sin esto, `run` enviaría los
  // valores iniciales (vacíos) del formulario en lugar de los actuales.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: Args) => {
    setLoading(true);
    setError(null);
    setStatus(undefined);
    try {
      return await fnRef.current(...args);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
      setStatus(e instanceof ApiError ? e.status : undefined);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { run, loading, error, status, clearError };
}
