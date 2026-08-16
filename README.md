# WapiApp

App móvil (React Native 0.81 + Expo SDK 54 + TypeScript) para la API de [Wapi](../Wapi), el
middleware multi-tenant de WhatsApp Cloud API.

Es el port a nativo de la capa de conexión del panel web [WapiWeb](../WapiWeb): mismos tipos,
mismos endpoints y el mismo manejo de sesión, adaptados a un dispositivo.

## Arrancar

```bash
npm install
npm start          # y escanea el QR con Expo Go, o pulsa 'a' / 'i'
```

Apunta por defecto a `https://api.stevengazo.co.cr` (definido en `app.json` → `extra.apiBaseUrl`).
Se puede cambiar en dos sitios:

- **En la app**: Ajustes → Conexión. Es lo que manda, y se guarda en el dispositivo.
- **Al compilar**: `EXPO_PUBLIC_API_URL` en un `.env` (ver `.env.example`), para builds internas
  que apuntan a otro backend.

## Qué hay dentro

| Ruta | Pantalla |
| --- | --- |
| `app/index.tsx` | Puerta de entrada: decide entre conexión, login y panel |
| `app/connection.tsx` | Dirección de la API, con prueba de conectividad |
| `app/login.tsx`, `app/register.tsx` | Identidad (JWT) |
| `app/(tabs)/index.tsx` | Panel: estadísticas, serie diaria, plan y consumo |
| `app/(tabs)/inbox.tsx` | Bandeja del agente: tomar, cerrar y abrir conversaciones |
| `app/(tabs)/contacts.tsx` | CRM de contactos, con búsqueda |
| `app/(tabs)/settings.tsx` | Cuenta activa, clave de tenant, cerrar sesión |
| `app/chat/[waId].tsx` | Conversación: historial paginado y envío de texto |

La capa de conexión, que es lo reutilizable:

| Archivo | Qué es |
| --- | --- |
| `src/api/types.ts` | Los DTOs del backend .NET. Copia literal de WapiWeb |
| `src/api/endpoints.ts` | ~130 endpoints tipados por área funcional |
| `src/api/client.ts` | Cliente HTTP: auth, errores en español, renovación de token, timeouts |
| `src/state/ConnectionContext.tsx` | Sesión: persistencia, caducidad y cierre |
| `src/hooks/useApi.ts` | `useAsync` / `useAction` para pantallas |

## Diferencias con el panel web

Nada de esto es cosmético; son las tres cosas que cambian al salir del navegador.

**No hay proxy.** El panel web llamaba a rutas relativas y dejaba que Vite (en desarrollo) o nginx
(en producción) encontraran el backend. Una app nativa no tiene nada detrás, así que la URL base
absoluta es obligatoria y su ausencia da un error explícito —«configúrala en Ajustes»— en vez de
un fallo de red genérico que culparía al servidor.

**Los tokens van al llavero.** `localStorage` no existe. El JWT, el token de refresco y la clave de
tenant se guardan con `expo-secure-store` (Keychain / EncryptedSharedPreferences); el resto
—URL, cuenta activa, nombre— en AsyncStorage. AsyncStorage es texto plano dentro del sandbox de la
app, y SecureStore en Android tiene un tope de ~2 KB por valor: por eso van separados y no todo
junto en un sitio.

**La app vive en segundo plano.** El aviso de sesión caducada no puede depender solo de un
`setTimeout`: el sistema congela los temporizadores al suspender el móvil. Se revisa también en
cada vuelta a primer plano (`AppState`), que es el equivalente móvil del `visibilitychange` del
navegador.

Y hay tope de tiempo por petición (30 s): en una red móvil que se va, sin él la pantalla se queda
cargando para siempre.

## APK de pruebas

[`.github/workflows/apk.yml`](.github/workflows/apk.yml) compila un APK instalable y lo deja en
los artefactos de la ejecución. Se dispara a mano (permite elegir a qué API apunta), en cada push
a `main` y en cada tag `vX.Y.Z`.

No necesita cuenta de Expo ni secretos: el runner hace `expo prebuild` + Gradle, y la variante
`release` que genera Expo va firmada con la keystore de debug que él mismo crea. Por eso **no
sirve para publicar** —Play rechaza esa firma— pero se instala y arranca sin más, que es lo que
hace falta para probar.

## Estado

Verificado: `npx tsc --noEmit` limpio, `npx expo-doctor` 18/18, bundle de Android exportado, y la
capa de API probada contra `https://api.stevengazo.co.cr` (config anónima, 401 sin credenciales,
login rechazado, y los tres modos de fallo de URL). No se ha probado contra la API una sesión real
con datos: hace falta un usuario.
