import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Loading } from '@/components/ui';
import { useConnection } from '@/state/ConnectionContext';
import { normalizeBaseUrl } from '@/api/client';
import { useTheme } from '@/theme';

/**
 * Puerta de entrada. El orden importa: sin URL de la API no se puede ni iniciar sesión, así que
 * la pantalla de conexión va antes que el login. Y mientras se lee la sesión guardada no se
 * decide nada: mandar a login para volver al panel medio segundo después se ve como un parpadeo
 * y hace dudar de si la sesión sigue viva.
 */
export default function Index() {
  const { hydrating, hasSession, conn } = useConnection();
  const t = useTheme();

  if (hydrating) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
        <Loading label="Abriendo Wapi…" />
      </View>
    );
  }

  if (!normalizeBaseUrl(conn.baseUrl)) return <Redirect href="/connection" />;
  if (!hasSession) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
