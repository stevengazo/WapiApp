import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import type { QueueEntry, QueueEntryStatusName } from '@/api/types';
import { Badge, Body, Button, Empty, ErrorBanner, Loading, Subtle } from '@/components/ui';
import { useAction, useAsync, useEndpoints } from '@/hooks/useApi';
import { radius, spacing, useTheme } from '@/theme';

const FILTROS: { key: QueueEntryStatusName; label: string }[] = [
  { key: 'waiting', label: 'En espera' },
  { key: 'assigned', label: 'Asignadas' },
  { key: 'closed', label: 'Cerradas' },
];

export default function InboxScreen() {
  const ep = useEndpoints();
  const router = useRouter();
  const t = useTheme();
  const [filtro, setFiltro] = useState<QueueEntryStatusName>('waiting');

  const colas = useAsync(() => ep.agentQueues(), []);
  const entradas = useAsync(() => ep.agentEntries(filtro), [filtro]);

  const nombreCola = useMemo(() => {
    const mapa = new Map((colas.data ?? []).map((c) => [c.id, c.name]));
    return (id: string) => mapa.get(id) ?? 'Cola';
  }, [colas.data]);

  const tomar = useAction((id: string) => ep.agentClaim(id));
  const cerrar = useAction((id: string) => ep.agentClose(id));

  async function alTomar(entrada: QueueEntry) {
    const res = await tomar.run(entrada.id);
    if (res) entradas.reload();
  }

  async function alCerrar(entrada: QueueEntry) {
    const res = await cerrar.run(entrada.id);
    if (res) entradas.reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg }}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filtro === f.key }}
            onPress={() => setFiltro(f.key)}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: filtro === f.key ? t.primary : t.surface,
              borderColor: filtro === f.key ? t.primary : t.border,
              borderWidth: 1,
            }}
          >
            <Body style={{ color: filtro === f.key ? t.primaryText : t.text, fontWeight: '600' }}>
              {f.label}
            </Body>
          </Pressable>
        ))}
      </View>

      {tomar.error ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <ErrorBanner message={tomar.error} />
        </View>
      ) : null}
      {cerrar.error ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <ErrorBanner message={cerrar.error} />
        </View>
      ) : null}

      {entradas.loading && !entradas.data ? <Loading /> : null}
      {entradas.error ? <ErrorBanner message={entradas.error} onRetry={entradas.reload} /> : null}

      <FlatList
        data={entradas.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={entradas.refreshing}
            onRefresh={entradas.refresh}
            tintColor={t.primary}
          />
        }
        ListEmptyComponent={
          entradas.loading || entradas.error ? null : (
            <Empty
              title="Nada por aquí"
              hint={
                filtro === 'waiting'
                  ? 'Cuando un contacto pida hablar con una persona, su conversación aparecerá en esta lista.'
                  : 'No hay conversaciones en este estado.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: t.surface,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              borderRadius: radius.md,
              borderColor: t.border,
              borderWidth: 1,
              padding: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <Body style={{ fontWeight: '700' }}>+{item.waId}</Body>
              <Badge
                text={item.status.toUpperCase()}
                tone={
                  item.status === 'waiting'
                    ? 'warning'
                    : item.status === 'assigned'
                      ? 'primary'
                      : 'neutral'
                }
              />
            </View>
            <Subtle>
              {nombreCola(item.queueId)} · {formatoRelativo(item.createdAt)}
            </Subtle>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              {item.status === 'waiting' ? (
                <Button
                  title="Tomar"
                  style={{ flex: 1 }}
                  loading={tomar.loading}
                  onPress={() => void alTomar(item)}
                />
              ) : null}
              <Button
                title="Abrir chat"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[waId]',
                    params: { waId: item.waId, accountId: item.accountId, entryId: item.id },
                  })
                }
              />
              {item.status === 'assigned' ? (
                <Button
                  title="Cerrar"
                  variant="secondary"
                  style={{ flex: 1 }}
                  loading={cerrar.loading}
                  onPress={() => void alCerrar(item)}
                />
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

/** «hace 5 min» en vez de una fecha ISO: en una bandeja lo que importa es cuánto lleva esperando. */
export function formatoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}
