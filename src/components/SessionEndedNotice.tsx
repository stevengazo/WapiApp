import { Modal, View } from 'react-native';
import { Body, Button, Title } from '@/components/ui';
import { useConnection, type SessionEndReason } from '@/state/ConnectionContext';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Cada motivo lleva a una explicación distinta. «Tu sesión se cerró» a secas hace que la gente
 * sospeche de un fallo de la app y lo reintente en bucle, cuando lo único que hay que hacer es
 * volver a entrar.
 */
const TEXTOS: Record<SessionEndReason, { titulo: string; cuerpo: string }> = {
  caducada: {
    titulo: 'La sesión caducó',
    cuerpo:
      'Pasó el tiempo máximo desde que iniciaste sesión. Vuelve a entrar para seguir donde estabas.',
  },
  rechazada: {
    titulo: 'La sesión ya no vale',
    cuerpo:
      'El servidor rechazó tus credenciales. Puede que se cambiara la contraseña o que se cerrara ' +
      'la sesión desde otro dispositivo.',
  },
};

export function SessionEndedNotice() {
  const { sessionEnded, dismissSessionEnded } = useConnection();
  const t = useTheme();
  if (!sessionEnded) return null;
  const { titulo, cuerpo } = TEXTOS[sessionEnded];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissSessionEnded}>
      <View
        style={{
          flex: 1,
          backgroundColor: '#00000099',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <View
          style={{
            backgroundColor: t.surface,
            borderRadius: radius.lg,
            padding: spacing.xl,
            gap: spacing.md,
          }}
        >
          <Title>{titulo}</Title>
          <Body>{cuerpo}</Body>
          <Button title="Iniciar sesión" onPress={dismissSessionEnded} />
        </View>
      </View>
    </Modal>
  );
}
