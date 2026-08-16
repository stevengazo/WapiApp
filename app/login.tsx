import { Link, Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { normalizeBaseUrl } from '@/api/client';
import { Body, Button, Card, ErrorBanner, Field, Subtle, Title } from '@/components/ui';
import { useAction, useEndpoints } from '@/hooks/useApi';
import { isTenantAssigned, useConnection } from '@/state/ConnectionContext';
import { spacing, useTheme } from '@/theme';

const SIN_ORGANIZACION =
  'Tu usuario no está asociado a ninguna organización, así que no puede iniciar sesión. Crea una ' +
  'organización o pide a su administrador que te invite.';

export default function LoginScreen() {
  const router = useRouter();
  const ep = useEndpoints();
  const t = useTheme();
  const { conn, update, signOut, hasBearer, hasSession } = useConnection();

  const [email, setEmail] = useState(conn.userEmail);
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [rechazo, setRechazo] = useState('');
  // El tenant lo resuelve el backend a partir del email; nunca se pide aquí.
  const { run, loading, error } = useAction(() => ep.login({ email: email.trim(), password }));

  // Restos de una sesión sin organización: se descartan al llegar al login.
  useEffect(() => {
    if (hasBearer && !hasSession) {
      setRechazo(SIN_ORGANIZACION);
      signOut();
    }
  }, [hasBearer, hasSession, signOut]);

  if (hasSession) return <Redirect href="/(tabs)" />;

  const base = normalizeBaseUrl(conn.baseUrl);

  async function submit() {
    setRechazo('');
    const res = await run();
    if (!res) return;
    // Sin organización asociada no hay sesión: no se guarda nada.
    if (!isTenantAssigned(res.user.tenantId)) {
      setRechazo(SIN_ORGANIZACION);
      return;
    }
    update({
      bearerToken: res.token,
      refreshToken: res.refreshToken,
      tenantId: res.user.tenantId,
      userEmail: res.user.email,
      userName: res.user.fullName ?? '',
      userRole: res.user.roleName ?? '',
    });
    router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
          <Title style={{ fontSize: 28 }}>Wapi</Title>
          <Subtle>Inicia sesión para acceder a tu bandeja de agente.</Subtle>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            placeholder="tu@empresa.com"
          />
          <View style={{ gap: spacing.xs }}>
            <Field
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!verClave}
              autoCapitalize="none"
              textContentType="password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Pressable onPress={() => setVerClave((v) => !v)} accessibilityRole="button">
              <Subtle style={{ color: t.primary }}>
                {verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              </Subtle>
            </Pressable>
          </View>

          {error || rechazo ? <ErrorBanner message={rechazo || error || ''} /> : null}

          <Button
            title={loading ? 'Entrando…' : 'Iniciar sesión'}
            onPress={submit}
            loading={loading}
            disabled={!email.trim() || !password}
          />
        </Card>

        <View style={{ gap: spacing.sm, alignItems: 'center' }}>
          <Link href="/register" asChild>
            <Pressable accessibilityRole="link">
              <Body style={{ color: t.primary }}>¿No tienes organización? Crea una</Body>
            </Pressable>
          </Link>
          <Link href="/connection" asChild>
            <Pressable accessibilityRole="link">
              <Subtle>API: {base || 'sin configurar'} · cambiar</Subtle>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
