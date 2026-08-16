import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { normalizeBaseUrl } from '@/api/client';
import { Body, Button, Card, ErrorBanner, Field, Subtle, Title } from '@/components/ui';
import { useConnection } from '@/state/ConnectionContext';
import { spacing, useTheme } from '@/theme';

type Prueba =
  | { estado: 'inactiva' }
  | { estado: 'probando' }
  | { estado: 'ok'; publicBaseUrl: string }
  | { estado: 'fallo'; mensaje: string };

/**
 * Dirección del backend. En la app nativa no hay proxy que la adivine —eso era cosa del panel
 * web— así que es lo primero que hay que configurar y lo único que se puede tocar sin sesión.
 */
export default function ConnectionScreen() {
  const { conn, update, hasSession } = useConnection();
  const router = useRouter();
  const t = useTheme();

  const [url, setUrl] = useState(conn.baseUrl);
  const [prueba, setPrueba] = useState<Prueba>({ estado: 'inactiva' });

  const normalizada = normalizeBaseUrl(url);
  const invalida = url.trim().length > 0 && !normalizada;

  /**
   * Se prueba contra `/api/config`, que es anónimo: así se distingue «no llego al servidor» de
   * «llego pero mis credenciales no valen», que son dos arreglos totalmente distintos.
   */
  async function probar() {
    if (!normalizada) return;
    setPrueba({ estado: 'probando' });
    const corte = new AbortController();
    const timer = setTimeout(() => corte.abort(), 15_000);
    try {
      const res = await fetch(`${normalizada}/api/config`, {
        headers: { Accept: 'application/json' },
        signal: corte.signal,
      });
      const texto = await res.text();
      if (!res.ok) {
        setPrueba({ estado: 'fallo', mensaje: `El servidor respondió ${res.status}.` });
        return;
      }
      if (texto.trimStart().startsWith('<')) {
        setPrueba({
          estado: 'fallo',
          mensaje: 'Esa dirección devuelve una web, no la API. Suele ser la URL del panel web.',
        });
        return;
      }
      const datos = JSON.parse(texto) as { publicBaseUrl?: string };
      setPrueba({ estado: 'ok', publicBaseUrl: datos.publicBaseUrl ?? normalizada });
    } catch {
      setPrueba({
        estado: 'fallo',
        mensaje:
          'No se pudo conectar. Si el backend corre en tu PC, el móvil no llega a «localhost»: ' +
          'usa la IP de la red local (por ejemplo http://192.168.1.20:5107).',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function guardar() {
    update({ baseUrl: normalizada });
    // `replace` a la raíz para que la puerta de entrada vuelva a decidir: con URL nueva puede
    // tocar el login, y con sesión ya abierta, el panel.
    if (hasSession && router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card>
          <Title>Dirección de la API</Title>
          <Subtle>
            La URL del backend de Wapi, con http:// o https://. La app la guarda en este
            dispositivo; no se comparte con nadie.
          </Subtle>

          <Field
            label="URL base"
            value={url}
            onChangeText={(v) => {
              setUrl(v);
              setPrueba({ estado: 'inactiva' });
            }}
            placeholder="https://api.tu-dominio.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            inputMode="url"
            hint={invalida ? 'Falta el esquema: escribe http:// o https:// delante.' : undefined}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Probar"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={probar}
              loading={prueba.estado === 'probando'}
              disabled={!normalizada}
            />
            <Button
              title="Guardar"
              style={{ flex: 1 }}
              onPress={guardar}
              disabled={!normalizada}
            />
          </View>

          {prueba.estado === 'ok' ? (
            <View style={{ gap: spacing.xs }}>
              <Body style={{ color: t.success }}>Conexión correcta.</Body>
              <Subtle>El servidor se anuncia como {prueba.publicBaseUrl}</Subtle>
            </View>
          ) : null}
          {prueba.estado === 'fallo' ? <ErrorBanner message={prueba.mensaje} /> : null}
        </Card>

        <Card>
          <Body style={{ fontWeight: '600' }}>Si pruebas en local</Body>
          <Subtle>
            El emulador de Android llega al PC anfitrión por 10.0.2.2 (por ejemplo
            http://10.0.2.2:5107). Un móvil físico necesita la IP de tu equipo en la red wifi, y
            que el backend escuche en 0.0.0.0, no solo en localhost.
          </Subtle>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
