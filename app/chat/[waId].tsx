import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { ContactMessage } from '@/api/types';
import { Badge, Body, Empty, ErrorBanner, Loading, Subtle } from '@/components/ui';
import { useAsync, useEndpoints } from '@/hooks/useApi';
import { useConnection } from '@/state/ConnectionContext';
import { radius, spacing, useTheme } from '@/theme';

const PAGINA = 50;
/** Cada cuánto se buscan mensajes nuevos con la conversación abierta. */
const POLL_MS = 10_000;

export default function ChatScreen() {
  const params = useLocalSearchParams<{ waId: string; accountId?: string; entryId?: string }>();
  const { conn } = useConnection();
  const ep = useEndpoints();
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const waId = params.waId;
  // La conversación puede venir de la bandeja, cuya entrada apunta a su propia cuenta: usar la
  // cuenta activa a secas mostraría el historial de otro número.
  const accountId = params.accountId || conn.accountId;

  const contacto = useAsync(() => ep.getContact(accountId, waId), [accountId, waId], {
    enabled: !!accountId && !!waId,
  });

  const [mensajes, setMensajes] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evita que dos peticiones simultáneas (poll + scroll) dupliquen o pisen la lista.
  const enVuelo = useRef(false);

  const fusionar = useCallback((nuevos: ContactMessage[], previos: ContactMessage[]) => {
    const vistos = new Set(previos.map((m) => m.id));
    const frescos = nuevos.filter((m) => !vistos.has(m.id));
    if (frescos.length === 0) return previos;
    // La API devuelve del más reciente al más antiguo y la lista se pinta invertida, así que lo
    // nuevo va al principio del array (y abajo del todo en pantalla).
    return [...frescos, ...previos];
  }, []);

  const cargarPrimera = useCallback(async () => {
    if (!accountId || !waId) return;
    setCargando(true);
    setError(null);
    try {
      const res = await ep.contactMessages(accountId, waId, PAGINA, 0);
      setMensajes(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [ep, accountId, waId]);

  const buscarNuevos = useCallback(async () => {
    if (!accountId || !waId || enVuelo.current) return;
    enVuelo.current = true;
    try {
      const res = await ep.contactMessages(accountId, waId, 20, 0);
      setMensajes((prev) => (prev.length === 0 ? res.items : fusionar(res.items, prev)));
      setTotal(res.total);
    } catch {
      // Un sondeo que falla no debe romper la pantalla: se reintenta al siguiente tick.
    } finally {
      enVuelo.current = false;
    }
  }, [ep, accountId, waId, fusionar]);

  const cargarMas = useCallback(async () => {
    if (enVuelo.current || cargandoMas || mensajes.length >= total) return;
    enVuelo.current = true;
    setCargandoMas(true);
    try {
      const res = await ep.contactMessages(accountId, waId, PAGINA, mensajes.length);
      setMensajes((prev) => {
        const vistos = new Set(prev.map((m) => m.id));
        return [...prev, ...res.items.filter((m) => !vistos.has(m.id))];
      });
      setTotal(res.total);
    } catch {
      /* al reintentar el scroll se vuelve a pedir */
    } finally {
      setCargandoMas(false);
      enVuelo.current = false;
    }
  }, [ep, accountId, waId, mensajes.length, total, cargandoMas]);

  useEffect(() => {
    void cargarPrimera();
  }, [cargarPrimera]);

  useEffect(() => {
    const id = setInterval(() => void buscarNuevos(), POLL_MS);
    return () => clearInterval(id);
  }, [buscarNuevos]);

  const nombre = contacto.data?.name?.trim() || `+${waId}`;
  const ventanaAbierta = contacto.data?.windowOpen ?? false;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <Stack.Screen options={{ title: nombre }} />

      {contacto.data ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            backgroundColor: t.surface,
            borderBottomColor: t.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          }}
        >
          <Subtle style={{ flex: 1 }} numberOfLines={1}>
            +{waId}
          </Subtle>
          {ventanaAbierta ? (
            <Badge text="VENTANA ABIERTA" tone="success" />
          ) : (
            <Badge text="VENTANA CERRADA" tone="warning" />
          )}
          {contacto.data.optedOut ? <Badge text="DE BAJA" tone="danger" /> : null}
        </View>
      ) : null}

      {cargando && mensajes.length === 0 ? <Loading label="Cargando conversación…" /> : null}
      {error ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={error} onRetry={() => void cargarPrimera()} />
        </View>
      ) : null}

      <FlatList
        inverted
        data={mensajes}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        onEndReachedThreshold={0.4}
        onEndReached={() => void cargarMas()}
        ListFooterComponent={
          cargandoMas ? <ActivityIndicator style={{ margin: spacing.md }} color={t.primary} /> : null
        }
        ListEmptyComponent={
          cargando || error ? null : (
            <Empty
              title="Sin mensajes"
              hint="Aquí aparecerá la conversación en cuanto haya tráfico con este contacto."
            />
          )
        }
        renderItem={({ item }) => <Burbuja mensaje={item} />}
      />

      <Compositor
        accountId={accountId}
        waId={waId}
        entryId={params.entryId}
        ventanaAbierta={ventanaAbierta}
        onEnviado={() => void buscarNuevos()}
      />
    </KeyboardAvoidingView>
  );
}

function Burbuja({ mensaje }: { mensaje: ContactMessage }) {
  const t = useTheme();
  const saliente = mensaje.direction === 'outbound';
  const fallo = mensaje.status === 'failed';

  return (
    // Sin transformaciones a mano: `inverted` de FlatList ya voltea la lista Y cada celda por
    // separado, así que el contenido sale derecho. Compensarlo aquí lo volvería del revés.
    <View style={{ alignItems: saliente ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '85%',
          backgroundColor: saliente ? t.bubbleOut : t.bubbleIn,
          borderColor: fallo ? t.danger : t.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: 2,
        }}
      >
        {mensaje.body ? (
          <Text style={{ color: t.text, fontSize: 15 }}>{mensaje.body}</Text>
        ) : (
          <Text style={{ color: t.textMuted, fontSize: 15, fontStyle: 'italic' }}>
            [{mensaje.type}
            {mensaje.mediaFilename ? `: ${mensaje.mediaFilename}` : ''}]
          </Text>
        )}
        <Text style={{ color: fallo ? t.danger : t.textMuted, fontSize: 11 }}>
          {hora(mensaje.createdAt)}
          {saliente ? ` · ${mensaje.status}` : ''}
        </Text>
        {mensaje.errorMessage ? (
          <Text style={{ color: t.danger, fontSize: 11 }}>{mensaje.errorMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Caja de envío.
 *
 * Con la ventana de 24 h cerrada el botón se deshabilita en vez de dejar que el backend responda
 * `service_window_closed`: el mensaje se habría escrito para nada, y esa regla es de WhatsApp, no
 * un fallo que se arregle reintentando.
 */
function Compositor({
  accountId,
  waId,
  entryId,
  ventanaAbierta,
  onEnviado,
}: {
  accountId: string;
  waId: string;
  entryId?: string;
  ventanaAbierta: boolean;
  onEnviado: () => void;
}) {
  const ep = useEndpoints();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      // Desde la bandeja se responde por la entrada de la cola: así el envío queda atribuido al
      // agente y la conversación no se marca como abandonada.
      if (entryId) await ep.agentReply(entryId, cuerpo);
      else await ep.sendText(accountId, { to: waId, text: cuerpo });
      setTexto('');
      onEnviado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View
      style={{
        borderTopColor: t.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        backgroundColor: t.surface,
        padding: spacing.md,
        paddingBottom: Math.max(spacing.md, insets.bottom),
        gap: spacing.sm,
      }}
    >
      {error ? <ErrorBanner message={error} /> : null}
      {!ventanaAbierta ? (
        <Subtle>
          Pasaron 24 h desde el último mensaje del contacto: solo se puede escribir con una
          plantilla aprobada, desde el panel web.
        </Subtle>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View
          style={{
            flex: 1,
            backgroundColor: t.surfaceAlt,
            borderColor: t.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
          }}
        >
          <TextInput
            value={texto}
            onChangeText={setTexto}
            editable={ventanaAbierta && !enviando}
            multiline
            placeholder={ventanaAbierta ? 'Escribe un mensaje…' : 'Ventana de 24 h cerrada'}
            placeholderTextColor={t.textMuted}
            style={{
              color: t.text,
              fontSize: 15,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              maxHeight: 120,
            }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          onPress={enviar}
          disabled={!ventanaAbierta || !texto.trim() || enviando}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.primary,
            opacity: !ventanaAbierta || !texto.trim() || enviando ? 0.4 : 1,
          }}
        >
          {enviando ? (
            <ActivityIndicator size="small" color={t.primaryText} />
          ) : (
            <Body style={{ color: t.primaryText, fontWeight: '700' }}>➤</Body>
          )}
        </Pressable>
      </View>
    </View>
  );
}
