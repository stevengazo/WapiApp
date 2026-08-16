import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Card, ErrorBanner, Field, Subtle, Title } from '@/components/ui';
import { useAction, useEndpoints } from '@/hooks/useApi';
import { useConnection } from '@/state/ConnectionContext';
import { spacing, useTheme } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const ep = useEndpoints();
  const t = useTheme();
  const { update } = useConnection();

  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { run, loading, error } = useAction(() =>
    ep.register({
      organizationName: orgName.trim(),
      email: email.trim(),
      password,
      fullName: fullName.trim() || undefined,
    }),
  );

  const emailValido = EMAIL_RE.test(email.trim());
  const puedeEnviar = !!orgName.trim() && emailValido && password.length >= 8;

  async function submit() {
    const res = await run();
    if (!res) return;
    // El alta devuelve además la clave de tenant por defecto: se guarda porque es la que usan
    // los endpoints de tenant, y volver a generarla desde la app obligaría a un rodeo por el
    // panel web nada más entrar.
    update({
      tenantId: res.tenant.id,
      tenantApiKey: res.defaultApiKey.key,
      bearerToken: res.token,
      refreshToken: res.refreshToken,
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
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
          <Title>Crea tu organización</Title>
          <Subtle>
            Serás su administrador. Después podrás conectar el número de WhatsApp e invitar al
            equipo.
          </Subtle>
        </View>

        <Card style={{ gap: spacing.md }}>
          <Field
            label="Nombre de la organización"
            value={orgName}
            onChangeText={setOrgName}
            placeholder="Mi Empresa S.A."
          />
          <Field label="Tu nombre (opcional)" value={fullName} onChangeText={setFullName} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            hint={email.length > 0 && !emailValido ? 'Ese email no parece válido.' : undefined}
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            hint="Mínimo 8 caracteres."
          />

          {error ? <ErrorBanner message={error} /> : null}

          <Button
            title={loading ? 'Creando…' : 'Crear organización'}
            onPress={submit}
            loading={loading}
            disabled={!puedeEnviar}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
