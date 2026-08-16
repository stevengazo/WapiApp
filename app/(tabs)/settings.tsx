import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Badge, Body, Button, Card, Empty, ErrorBanner, Field, Loading, Subtle, Title } from '@/components/ui';
import { useAccountOptions, useEnsureActiveAccount } from '@/hooks/useAccounts';
import { useConnection } from '@/state/ConnectionContext';
import { spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  const { conn, update, signOut, hasTenantKey } = useConnection();
  const router = useRouter();
  const t = useTheme();

  const cuentas = useAccountOptions();
  useEnsureActiveAccount(cuentas.data);

  const [clave, setClave] = useState('');
  const [editandoClave, setEditandoClave] = useState(false);

  function confirmarSalida() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => {
          signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card>
        <Title>{conn.userName || conn.userEmail || 'Sesión'}</Title>
        <Subtle>{conn.userEmail}</Subtle>
        {conn.userRole ? <Badge text={conn.userRole.toUpperCase()} tone="primary" /> : null}
      </Card>

      <Card>
        <Title>Cuenta activa</Title>
        <Subtle>
          Decide sobre qué número se leen contactos y se envían mensajes desde esta app.
        </Subtle>

        {cuentas.loading && !cuentas.data ? <Loading /> : null}
        {cuentas.error ? <ErrorBanner message={cuentas.error} onRetry={cuentas.reload} /> : null}
        {cuentas.data?.length === 0 ? (
          <Empty
            title="No hay cuentas conectadas"
            hint="Conecta un número de WhatsApp desde el panel web para empezar a operar."
          />
        ) : null}

        {(cuentas.data ?? []).map((a) => {
          const activa = a.id === conn.accountId;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              onPress={() => update({ accountId: a.id })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
              }}
            >
              <Ionicons
                name={activa ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={activa ? t.primary : t.textMuted}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Body numberOfLines={1}>{a.displayName}</Body>
                <Subtle>{a.channel}</Subtle>
              </View>
              {a.isSandbox ? <Badge text="PRUEBAS" tone="warning" /> : null}
              {!a.isActive ? <Badge text="INACTIVA" tone="danger" /> : null}
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <Title>Conexión</Title>
        <Subtle numberOfLines={1}>{conn.baseUrl || 'sin configurar'}</Subtle>
        <Button
          title="Cambiar dirección de la API"
          variant="secondary"
          onPress={() => router.push('/connection')}
        />
      </Card>

      <Card>
        <Title>Clave de tenant</Title>
        <Subtle>
          Opcional. La sesión de usuario ya sirve para operar tu organización; una X-Api-Key solo
          hace falta si quieres que la app use la misma clave que tus integraciones. Se guarda en
          el llavero del dispositivo.
        </Subtle>

        {hasTenantKey && !editandoClave ? (
          <View style={{ gap: spacing.sm }}>
            <Body>Configurada ✓</Body>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Reemplazar"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  setClave('');
                  setEditandoClave(true);
                }}
              />
              <Button
                title="Quitar"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => update({ tenantApiKey: '' })}
              />
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Field
              value={clave}
              onChangeText={setClave}
              placeholder="wapi_..."
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Guardar clave"
                style={{ flex: 1 }}
                disabled={!clave.trim()}
                onPress={() => {
                  update({ tenantApiKey: clave.trim() });
                  setClave('');
                  setEditandoClave(false);
                }}
              />
              {editandoClave ? (
                <Button
                  title="Cancelar"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setClave('');
                    setEditandoClave(false);
                  }}
                />
              ) : null}
            </View>
          </View>
        )}
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={confirmarSalida} />
    </ScrollView>
  );
}
