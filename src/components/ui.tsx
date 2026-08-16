import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, useTheme, type Palette } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children, style, ...rest }: TextProps) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ color: t.text, fontSize: 20, fontWeight: '700' }, style]}>
      {children}
    </Text>
  );
}

export function Subtle({ children, style, ...rest }: TextProps) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ color: t.textMuted, fontSize: 13 }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...rest }: TextProps) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ color: t.text, fontSize: 15 }, style]}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const inactivo = disabled || loading;
  const fondo =
    variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : 'transparent';
  const color =
    variant === 'primary' ? t.primaryText : variant === 'danger' ? '#ffffff' : t.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: loading }}
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        {
          backgroundColor: fondo,
          borderColor: variant === 'secondary' ? t.border : fondo,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: inactivo ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : null}
      <Text style={{ color, fontSize: 15, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label?: string; hint?: string }>(
  function Field({ label, hint, style, ...props }, ref) {
    const t = useTheme();
    return (
      <View style={{ gap: spacing.xs }}>
        {label ? (
          <Text style={{ color: t.textMuted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={t.textMuted}
          {...props}
          style={[
            {
              backgroundColor: t.surfaceAlt,
              borderColor: t.border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: t.text,
              fontSize: 15,
            },
            style,
          ]}
        />
        {hint ? <Subtle>{hint}</Subtle> : null}
      </View>
    );
  },
);

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: t.dark ? '#3d1a1a' : '#fdeaea',
        borderColor: t.danger,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text style={{ color: t.dark ? '#ffb3b3' : '#7d1a1a', fontSize: 14 }}>{message}</Text>
      {onRetry ? <Button title="Reintentar" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
      <ActivityIndicator color={t.primary} />
      <Subtle>{label}</Subtle>
    </View>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
      <Body style={{ fontWeight: '600' }}>{title}</Body>
      {hint ? <Subtle style={{ textAlign: 'center' }}>{hint}</Subtle> : null}
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: keyof typeof TONES }) {
  const t = useTheme();
  const color = TONES[tone](t);
  return (
    <View
      style={{
        borderColor: color,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const TONES = {
  neutral: (t: Palette) => t.textMuted,
  success: (t: Palette) => t.success,
  danger: (t: Palette) => t.danger,
  warning: (t: Palette) => t.warning,
  primary: (t: Palette) => t.primary,
};

/** Fila pulsable de un listado, con separador inferior. */
export function ListRow({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  const t = useTheme();
  const contenido = (
    <View
      style={{
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomColor: t.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: spacing.xs,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return contenido;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? t.surfaceAlt : t.surface })}
    >
      {contenido}
    </Pressable>
  );
}
