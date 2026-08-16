import { useConnection } from '@/state/ConnectionContext';
import type { MessagingChannel } from '@/api/types';
import { useAsync, useEndpoints } from './useApi';

export interface AccountOption {
  id: string;
  displayName: string;
  /** Falso si el número quedó desactivado en el backend (no se puede enviar). */
  isActive: boolean;
  /** Cuenta de pruebas: se marca en la interfaz para no confundirla con tráfico real. */
  isSandbox: boolean;
  /** El canal decide qué se puede enviar: en Instagram y Messenger no hay plantillas. */
  channel: MessagingChannel;
}

/**
 * Cuentas disponibles para el selector, de `/api/me/accounts`, que ya devuelve solo las de la
 * organización del usuario.
 */
export function useAccountOptions() {
  const ep = useEndpoints();
  const { conn } = useConnection();
  const viaBearer = conn.bearerToken.trim() !== '';

  return useAsync<AccountOption[]>(
    async () => {
      const accounts = await ep.myAccounts();
      return accounts.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        isActive: a.isActive,
        isSandbox: a.isSandbox,
        channel: a.channel,
      }));
    },
    [viaBearer, conn.bearerToken],
    { enabled: viaBearer },
  );
}

/**
 * Fija una cuenta activa en cuanto se conoce la lista, si no había ninguna o la guardada ya no
 * existe. Sin esto, quien entra por primera vez ve todas las pantallas de tenant vacías sin que
 * nada explique que falta elegir cuenta.
 */
export function useEnsureActiveAccount(options: AccountOption[] | undefined) {
  const { conn, update } = useConnection();
  const actual = conn.accountId;

  if (options && options.length > 0) {
    const sigueExistiendo = options.some((a) => a.id === actual);
    if (!sigueExistiendo) {
      const preferida = options.find((a) => a.isActive && !a.isSandbox) ?? options[0];
      if (preferida.id !== actual) {
        // Se aplaza al siguiente tick: cambiar el estado durante el render de otro componente
        // avisa en consola y, con varias pantallas montadas, puede repetirse.
        setTimeout(() => update({ accountId: preferida.id }), 0);
      }
    }
  }
}
