import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Badge, Body, Empty, ErrorBanner, Field, ListRow, Loading, Subtle } from '@/components/ui';
import { useAsync, useEndpoints } from '@/hooks/useApi';
import { useAccountOptions, useEnsureActiveAccount } from '@/hooks/useAccounts';
import { useConnection } from '@/state/ConnectionContext';
import { spacing, useTheme } from '@/theme';
import { formatoRelativo } from './inbox';

export default function ContactsScreen() {
  const ep = useEndpoints();
  const router = useRouter();
  const t = useTheme();
  const { conn } = useConnection();

  const cuentas = useAccountOptions();
  useEnsureActiveAccount(cuentas.data);
  const accountId = conn.accountId;

  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Se espera a que deje de teclear: sin esto cada letra lanza una petición y las respuestas
  // llegan desordenadas, que es como se ve una lista que «salta» sola.
  useEffect(() => {
    const id = setTimeout(() => setBusqueda(texto.trim()), 350);
    return () => clearTimeout(id);
  }, [texto]);

  const contactos = useAsync(
    () => ep.listContacts(accountId, { search: busqueda || undefined, take: 50 }),
    [accountId, busqueda],
    { enabled: !!accountId },
  );

  if (!accountId) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center' }}>
        {cuentas.loading ? (
          <Loading />
        ) : (
          <Empty
            title="No hay cuenta seleccionada"
            hint="Elige una cuenta de WhatsApp en Ajustes para ver sus contactos."
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: spacing.lg }}>
        <Field
          value={texto}
          onChangeText={setTexto}
          placeholder="Buscar por nombre, número o email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {contactos.loading && !contactos.data ? <Loading /> : null}
      {contactos.error ? <ErrorBanner message={contactos.error} onRetry={contactos.reload} /> : null}

      <FlatList
        data={contactos.data?.items ?? []}
        keyExtractor={(c) => c.waId}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={contactos.refreshing}
            onRefresh={contactos.refresh}
            tintColor={t.primary}
          />
        }
        ListHeaderComponent={
          contactos.data ? (
            <Subtle style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              {contactos.data.total} contactos
              {contactos.data.total > contactos.data.items.length
                ? ` · mostrando ${contactos.data.items.length}`
                : ''}
            </Subtle>
          ) : null
        }
        ListEmptyComponent={
          contactos.loading || contactos.error ? null : (
            <Empty
              title={busqueda ? 'Sin resultados' : 'Todavía no hay contactos'}
              hint={
                busqueda
                  ? 'Prueba con parte del número, sin el prefijo.'
                  : 'Los contactos se crean solos en cuanto alguien escribe al número.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            onPress={() =>
              router.push({ pathname: '/chat/[waId]', params: { waId: item.waId, accountId } })
            }
          >
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <Body style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                {item.name?.trim() || `+${item.waId}`}
              </Body>
              {item.windowOpen ? <Badge text="24 H" tone="success" /> : null}
              {item.optedOut ? <Badge text="BAJA" tone="danger" /> : null}
              {item.blocked ? <Badge text="BLOQ." tone="danger" /> : null}
            </View>
            <Subtle numberOfLines={1}>
              +{item.waId}
              {item.lastInboundAt ? ` · escribió ${formatoRelativo(item.lastInboundAt)}` : ''}
              {item.tags.length ? ` · ${item.tags.join(', ')}` : ''}
            </Subtle>
          </ListRow>
        )}
      />
    </View>
  );
}
