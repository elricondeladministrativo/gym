# GymApp

Aplicación Android de seguimiento de entrenamiento y composición corporal. Funciona **100% sin conexión** con SQLite local y está pensada para usarse en el gimnasio.

## Funcionalidades

- [x] **Inicio / Hoy** con la lógica real del ciclo leída desde SQLite.
- [x] **Entrenamiento en curso**: ejercicios del día, series editables (peso + reps), agregar/quitar series, guardar sesión.
- [x] **Lógica central del ciclo**: avanza solo al completar; el descanso no mueve el puntero.
- [x] **Esquema SQLite completo** (perfil, catálogo, ciclo, sesiones, series, medidas) con datos de ejemplo.
- [x] **Tema oscuro profesional** con la paleta solicitada y tipografías Barlow Condensed + Inter.
- [x] **Logo SVG** (mancuerna + hamburguesa) e íconos/splash generados en PNG.
- [x] **Catálogo de ejercicios** con búsqueda, detalle con instrucciones y alta de ejercicios.
- [x] **Fotos de ejercicios**: cámara o galería, guardadas en el almacenamiento privado de la app.
- [x] **Editor de ciclo**: renombrar, crear, borrar y reordenar días, y administrar los ejercicios de cada día.
- [x] **Progreso corporal** con peso, IMC, gráfico por semana/mes/año y variación de medidas.
- [x] **Nueva medición**: fecha, peso, estatura, grasa y medidas configurables.
- [x] **Historial** con calendario mensual, resumen de volumen y detalle de series por sesión.
- [x] **Workflow de GitHub Actions** que compila el APK en cada tag `v*` y lo adjunta a un Release.

Pendiente para próximas iteraciones: respaldo/exportación de datos, múltiples ciclos simultáneos, edición del perfil (objetivo) y notificaciones de recordatorio.

## Stack

| Pieza | Tecnología |
| --- | --- |
| Framework | Expo SDK 58 + React Native 0.88 |
| Navegación | Expo Router (file-based, `src/app`) |
| Base de datos | `expo-sqlite` (API async, WAL) |
| UI | Componentes propios sobre el tema oscuro (sin librería de UI) |
| Gráficos | `react-native-chart-kit` sobre `react-native-svg` |
| Imágenes | `expo-image-picker` + `expo-file-system` (almacenamiento privado) |
| Tipografías | Barlow Condensed (números/títulos) + Inter (texto) |
| Build | GitHub Actions + Gradle (`assembleRelease`) |

## Cómo correrlo

```bash
npm install
npx expo start
```

Escaneá el QR con **Expo Go** (Android/iOS). Todas las dependencias nativas usadas (`expo-sqlite`, `react-native-svg`, `expo-font`, `expo-image-picker`, `expo-file-system`) están incluidas en Expo Go.

Comandos útiles:

```bash
npm run lint            # ESLint (eslint-config-expo)
npm run doctor          # expo-doctor
npm run export:android  # valida el bundle de producción
npm run assets          # regenera los PNG del logo desde los SVG
```

## Lógica del ciclo

El puntero vive en `cycle.posicion_actual` y apunta al `orden` de un `day_template`.

- **Completar** una sesión (`estado = 'completada'`) busca el día actual en la lista ordenada y, dentro de una transacción, mueve `posicion_actual` al `orden` del día siguiente (vuelve al primero al terminar la vuelta).
- **Descanso** (`estado = 'descanso'`) inserta la sesión pero **no** toca `posicion_actual`.
- Al reordenar o borrar días desde el editor, el puntero se recalcula para conservar el día actual.

Ejemplo: `Empuje → descanso → Empuje → Jalón → Piernas → Full Body → Empuje…`

La pantalla de inicio vuelve a leer el estado cada vez que recupera el foco (`useFocusEffect`), por lo que refleja el avance inmediatamente después de finalizar.

## Estructura

```
src/
  app/                     # Rutas de Expo Router
    _layout.js             # Stack + SQLiteProvider + fuentes + tema
    (tabs)/
      _layout.js           # Tabs inferiores (4)
      index.js             # Inicio / Hoy
      exercises.js         # Catálogo + alta + fotos
      progress.js          # Progreso corporal
      history.js           # Historial con calendario
    workout.js             # Entrenamiento en curso
    cycle.js               # Editor de días del ciclo
    cycle-day.js           # Ejercicios de un día
    measurement-new.js     # Formulario de nueva medición
  components/              # Logo, botones, tarjetas, modales
  db/
    migrate.js             # Esquema, índices y seed inicial
    queries.js             # Ciclo, sesiones, medidas e historial
  utils/
    date.js                # Fechas locales (sin corrimiento UTC)
    body.js                # IMC, formato y variaciones
    images.js              # Cámara/galería y copia a almacenamiento privado
  theme.js                 # Paleta y tipografías
assets/                    # Logo SVG, íconos y splash PNG
scripts/                   # Generación de assets con sharp
.github/workflows/         # Build de APK + Release
```

### Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Hoy: ciclo actual, sesiones del día y acceso al editor |
| `/workout` | Entrenamiento en curso |
| `/exercises` | Catálogo y alta de ejercicios |
| `/progress` | Progreso corporal y gráfico de peso |
| `/history` | Historial mensual con calendario y series |
| `/cycle` | Editor de días del ciclo |
| `/cycle-day?dayId=…` | Ejercicios asignados a un día |
| `/measurement-new` | Nueva medición corporal |

## Modelo de datos

`user_profile`, `exercise`, `cycle`, `day_template`, `day_exercise`, `workout_session`, `workout_set`, `metric_type`, `body_measurement`, `body_metric_value`.

- Fechas en formato local `YYYY-MM-DD` (sin corrimiento UTC).
- `workout_session.estado` restringido por `CHECK` a `completada | descanso`.
- Borrados en cascada para series y valores de medidas.
- `PRAGMA user_version` habilita migraciones futuras.
- Datos de ejemplo: ciclo PPL + Full Body, 14 ejercicios con instrucciones y 5 mediciones corporales.

## Diseño

- Fondo: `#0D0D0D` / `#121212`; tarjetas `#1E1E1E` con borde `#2A2A2A`.
- Acento principal: naranja eléctrico `#FF6B35`.
- Acento secundario: azul técnico `#457B9D` / `#1D3557`.
- Texto: `#FFFFFF` principal, `#B0B0B0` secundario.
- Números y títulos en Barlow Condensed; cuerpo en Inter.

## Generar el APK

### GitHub Actions (recomendado)

1. Subí el repo a GitHub.
2. Creá un tag: `git tag v0.1.0 && git push origin v0.1.0`.
3. El workflow **Android APK** compila y publica `gymapp-v0.1.0.apk` en Releases.
4. También podés ejecutarlo manualmente desde *Actions → Android APK → Run workflow* (en ese caso queda como artifact, sin Release).

El APK del CI se firma con el keystore de debug: **es instalable**, pero no apto para Play Store. Para producción, configurá un keystore propio (secretos de GitHub + `android/app/build.gradle` generado por prebuild) o usá EAS Build con `eas.json`.

### EAS Build (alternativa)

```bash
npx eas-cli@latest build --platform android --profile preview
```

## Permisos y almacenamiento de fotos

- La app pide permiso de **cámara** solo al sacar una foto y abre la **galería** con el selector del sistema (sin acceso amplio a la fototeca).
- Cada foto elegida se copia a `document/exercise-images`, dentro del almacenamiento privado de la app, porque la URI temporal del selector puede borrarse.
- Al reemplazar o quitar una foto, el archivo anterior se elimina. Desinstalar la app borra también las imágenes.
- No se sube ninguna foto ni dato a Internet.

## Privacidad

No hay backend ni telemetría. Todos los datos (entrenamientos, medidas, rutas de imágenes) quedan en el dispositivo.
