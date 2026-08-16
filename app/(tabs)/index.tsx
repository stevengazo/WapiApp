import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import type { DailyStat } from '@/api/types';
import { Badge, Body, Card, Empty, ErrorBanner, Loading, Subtle, Title } from '@/components/ui';
import { useAsync, useEndpoints } from '@/hooks/useApi';
import { useAccountOptions, useEnsureActiveAccount } from '@/hooks/useAccounts';
import { useConnection } from '@/state/ConnectionContext';
import { radius, spacing, useTheme } from '@/theme';

const PERIODOS = [7, 30, 90] as const;

export default function PanelScreen() {
  const ep = useEndpoints();
  const t = useTheme();
  const { conn } = useConnection();
  const [dias, setDias] = useState<number>(7);

  const cuentas = useAccountOptions();
  useEnsureActiveAccount(cuentas.data);

  const stats = useAsync(() => ep.stats(dias), [dias, conn.tenantId]);
  const plan = useAsync(() => ep.plan(), [conn.tenantId]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      refreshControl={
        <RefreshControl
          refreshing={stats.refreshing}
          onRefresh={() => {
            stats.refresh();
            plan.reload();
            cuentas.reload();
          }}
          tintColor={t.primary}
        />
      }
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {PERIODOS.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityState={{ selected: dias === d }}
            onPress={() => setDias(d)}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.sm,
              backgroundColor: dias === d ? t.primary : t.surface,
              borderColor: dias === d ? t.primary : t.border,
              borderWidth: 1,
            }}
          >
            <Body style={{ color: dias === d ? t.primaryText : t.text, fontWeight: '600' }}>
              {d} días
            </Body>
          </Pressable>
        ))}
      </View>

      {stats.loading && !stats.data ? <Loading /> : null}
      {stats.error ? <ErrorBanner message={stats.error} onRetry={stats.reload} /> : null}

      {stats.data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <Metrica label="Mensajes" valor={stats.data.totalMessages} />
            <Metrica label="Entrantes" valor={stats.data.inbound} />
            <Metrica label="Salientes" valor={stats.data.outbound} />
            <Metrica label="Contactos" valor={stats.data.contacts} />
          </View>

          <Card>
            <Title>Actividad diaria</Title>
            <Serie datos={stats.data.daily} />
          </Card>

          <Card>
            <Title>Por cuenta</Title>
            {stats.data.accounts_Breakdown.length === 0 ? (
              <Empty
                title="Todavía no hay tráfico"
                hint="En cuanto un contacto escriba, aparecerá aquí el reparto por número."
              />
            ) : (
              stats.data.accounts_Breakdown.map((a) => (
                <View
                  key={a.accountId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.sm,
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body numberOfLines={1}>{a.displayName}</Body>
                    <Subtle>
                      {a.inbound} entrantes · {a.outbound} salientes
                    </Subtle>
                  </View>
                  {a.accountId === conn.accountId ? <Badge text="ACTIVA" tone="primary" /> : null}
                  <Body style={{ fontWeight: '700' }}>{a.messages}</Body>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      {plan.data ? (
        <Card>
          <Title>Plan {plan.data.plan.name}</Title>
          <Subtle>Periodo {plan.data.usage.period}</Subtle>
          <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <Body>{plan.data.usage.messagesSent} mensajes enviados</Body>
            <Subtle>
              {plan.data.usage.accounts} cuentas · {plan.data.usage.users} usuarios ·{' '}
              {plan.data.usage.knowledgeDocuments} documentos
            </Subtle>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Metrica({ label, valor }: { label: string; valor: number }) {
  const t = useTheme();
  return (
    <Card style={{ flexGrow: 1, flexBasis: '45%', gap: 2 }}>
      <Subtle>{label}</Subtle>
      <Body style={{ fontSize: 26, fontWeight: '700', color: t.text }}>
        {valor.toLocaleString('es-CR')}
      </Body>
    </Card>
  );
}

/**
 * Barras apiladas por día, dibujadas con Views.
 *
 * Sin librería de gráficos a propósito: son ~14 barras de dos colores y una dependencia de
 * charts en React Native trae SVG nativo y su propio ciclo de versiones por algo que aquí se
 * resuelve con dos rectángulos y una regla de tres.
 */
function Serie({ datos }: { datos: DailyStat[] }) {
  const t = useTheme();
  const visibles = datos.slice(-14);
  const max = Math.max(1, ...visibles.map((d) => d.total));

  if (visibles.length === 0) return <Empty title="Sin datos en el periodo" />;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 3 }}>
        {visibles.map((d) => (
          <View key={d.date} style={{ flex: 1, justifyContent: 'flex-end', gap: 1 }}>
            <View
              style={{
                height: (d.outbound / max) * 100,
                backgroundColor: t.primary,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
            <View style={{ height: (d.inbound / max) * 100, backgroundColor: t.textMuted }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Subtle>{visibles[0]?.date.slice(5)}</Subtle>
        <Subtle>
          <Body style={{ color: t.primary, fontSize: 13 }}>■</Body> salientes ·{' '}
          <Body style={{ color: t.textMuted, fontSize: 13 }}>■</Body> entrantes
        </Subtle>
        <Subtle>{visibles[visibles.length - 1]?.date.slice(5)}</Subtle>
      </View>
    </View>
  );
}
