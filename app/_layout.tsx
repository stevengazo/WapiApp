import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionEndedNotice } from '@/components/SessionEndedNotice';
import { ConnectionProvider } from '@/state/ConnectionContext';
import { useTheme } from '@/theme';

function Rutas() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.surface },
        headerTintColor: t.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Crear organización' }} />
      <Stack.Screen name="connection" options={{ title: 'Conexión' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <ConnectionProvider>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Rutas />
        {/* Fuera del Stack: el aviso tiene que poder salir encima de cualquier pantalla. */}
        <SessionEndedNotice />
      </ConnectionProvider>
    </SafeAreaProvider>
  );
}
