# Frontend Testing — TrackWise (`app/`)

Documentación del suite de pruebas con **Playwright** para el frontend estático de TrackWise (`app/`). Cubre pruebas **unitarias** (lógica pura expuesta en `window`) y **de integración** (flujos completos de UI en navegador).

---

## 1. Stack y configuración

- **Framework**: [`@playwright/test`](https://playwright.dev/) (única dependencia, ver [package.json](../package.json))
- **Navegador**: Chromium (proyecto único definido en [playwright.config.js](../playwright.config.js))
- **Servidor**: la app no tiene build step, así que Playwright levanta un servidor estático con `python3 -m http.server 4173` y corre las pruebas contra `http://127.0.0.1:4173`
- **Reporter**: HTML (`npm run test:report` para abrirlo)

### Por qué Playwright (y no Jest/RTL)

`app/src/*.jsx` no usa módulos ES ni bundler: cada archivo se transpila en el navegador con Babel Standalone (`type="text/babel"`) y expone su API mediante `Object.assign(window, {...})`. No hay forma de importar estos archivos en un entorno Node/JSDOM sin reescribir el proyecto. Playwright permite:

- Probar la **lógica pura** (`mockAnalysisService`, `isValidYouTube`) ejecutándola dentro del navegador real vía `page.evaluate`, tal como corre en producción — esto cumple el rol de "pruebas unitarias".
- Probar los **flujos de usuario** (login, análisis, historial, guards de rutas) de extremo a extremo.

### Cómo correr las pruebas

```bash
cd app
npm install
npx playwright install chromium   # solo la primera vez

npm test                 # toda la suite
npm run test:unit        # solo tests/unit
npm run test:integration # solo tests/integration
npm run test:ui          # modo UI interactivo de Playwright
npm run test:report      # abre el último reporte HTML
```

---

## 2. Estructura

```
app/
├── package.json
├── playwright.config.js
└── tests/
    ├── unit/
    │   └── mock-service.spec.js        # 18 tests
    └── integration/
        ├── auth.spec.js                # 7 tests
        ├── navigation-guards.spec.js   # 9 tests
        ├── analysis-flow.spec.js       # 8 tests
        └── history.spec.js             # 6 tests
```

**Total: 44 tests**, todos en verde (`44 passed`), validados también con `--repeat-each=2` (88/88) para descartar flakiness.

---

## 3. Pruebas unitarias — `tests/unit/mock-service.spec.js`

Cargan `index.html` (para que Babel transpile y exponga las funciones globales), limpian `localStorage` antes de cada test, y luego llaman directamente a las funciones vía `page.evaluate()` — sin tocar la UI.

> **Nota técnica**: los scripts `type="text/babel"` se ejecutan *después* del evento `load` de la página. Por eso existe un helper `waitForApp(page)` que hace `page.goto('/')` + `page.waitForFunction(() => window.mockAnalysisService && window.isValidYouTube)` antes de cada test, evitando errores tipo `ReferenceError: mockAnalysisService is not defined`.

### `isValidYouTube` (src/pages-dashboard.jsx)

| Test | Qué valida |
|---|---|
| `accepts youtube.com and youtu.be links` | `youtube.com/watch?v=...`, `youtu.be/...` y links con espacios alrededor son válidos |
| `rejects non-youtube input` | string vacío, otro dominio (vimeo) y texto plano son inválidos |

### `mockAnalysisService.analyze*` (src/mockService.jsx)

| Test | Qué valida |
|---|---|
| `analyzeYouTubeLink returns a well-formed AnalysisResult` | shape completo del resultado: `source="youtube"`, `inputName`, `inputValue=url`, `id` con prefijo `tv_`, `score` en rango 38–97, `rating` ∈ {A..F}, `features` con 3 elementos, `recommendations` no vacío, `summary` string, `bestReleaseDate` empieza con "Viernes" |
| `analyzeMp3File uses the file name as inputName/inputValue and source mp3` | `source="mp3"`, `inputName`/`inputValue` = nombre del archivo |
| `score-to-rating mapping is consistent across multiple analyses` | corre 10 análisis y verifica que el `rating` corresponda al `score` según los umbrales (≥90→A, ≥80→B, ≥65→C, ≥50→D, ≥35→E, si no→F) |
| `suggested release date always falls on a Friday` | corre 5 análisis y verifica que `bestReleaseDate` siempre empiece con "Viernes" |

### Sesión (`getSession` / `setSession` / `clearSession`)

| Test | Qué valida |
|---|---|
| `set/get/clear session round-trip` | guardar `{name, role}`, recuperarlo igual, limpiarlo y que vuelva `null` |
| `getSession returns null when nothing is stored` | estado inicial sin sesión devuelve `null` |

### Usuarios registrados (`registerUser` / `findUserRole`)

| Test | Qué valida |
|---|---|
| `registerUser stores a role that findUserRole recalls case-insensitively` | el rol se recupera con el mismo nombre, en minúsculas, con espacios extra (`trim`), y devuelve `null` para un usuario no registrado |

### Historial y análisis actual

| Test | Qué valida |
|---|---|
| `saveToHistory de-dupes by id and orders newest first` | guardar el mismo resultado dos veces no duplica la entrada; el más reciente queda primero |
| `deleteFromHistory removes only the targeted entry` | borrar por `id` solo elimina esa entrada, deja el resto intacto |
| `setCurrentAnalysis / getCurrentAnalysis round-trip` | el análisis "actual" persiste y se recupera con el mismo `id` |
| `getCurrentAnalysis returns null when nothing was analyzed yet` | estado inicial sin análisis devuelve `null` |

---

## 4. Pruebas de integración (E2E)

Simulan al usuario en un navegador real: clicks, formularios, drag&drop de archivos, navegación por hash-router. Cada test arranca con `localStorage` limpio (`page.addInitScript(() => window.localStorage.clear())`), y cuando se necesita una sesión activa se inyecta directamente en `localStorage` antes de cargar la página (`trackvision_session`), evitando repetir el flujo de login en cada test.

### `auth.spec.js` — Welcome / Login / Registro

| Test | Qué valida |
|---|---|
| `shows branding and navigates to login on "Empezar"` | landing muestra el heading "Bienvenido a..." y el botón "Empezar" navega a `#/login` |
| `shows validation errors when submitting an empty login form` | enviar el form de login vacío muestra "Ingresa tu nombre o correo." e "Ingresa tu contraseña." |
| `register requires selecting a user type` | en modo registro, sin elegir tipo de usuario, muestra "Selecciona un tipo de usuario." |
| `registering as a regular user lands on the user dashboard` | registro con rol "Usuario normal" → redirige a `#/user` y muestra el dashboard de usuario |
| `registering as a producer lands on the producer dashboard` | registro con rol "Productor" → redirige a `#/producer` y muestra "Panel para productores" |
| `login with an unknown user defaults to the "user" role` | login con un nombre no registrado → rol por defecto `user`, redirige a `#/user` |
| `logging in again recalls the role chosen at registration` | flujo completo: registrar como productor → logout (cae en `#/welcome`) → "Empezar" → login con el mismo nombre → vuelve a `#/producer` sin re-elegir rol |

### `navigation-guards.spec.js` — Router por hash + guards de sesión (`app.jsx`)

| Test | Qué valida |
|---|---|
| `without a session, any route redirects to /welcome` | navegar a `#/producer` sin sesión → redirige a `#/welcome` |
| `without a session, /history redirects to /welcome` | igual que arriba para `#/history` |
| `a "user" session cannot access /producer` | sesión `role: "user"` en `#/producer` → redirige a `#/user` |
| `a "producer" session cannot access /user` | sesión `role: "producer"` en `#/user` → redirige a `#/producer` |
| `an active session redirects /login and /welcome to its dashboard` | con sesión activa, `#/login` y `#/welcome` redirigen al dashboard del rol |
| `an unknown hash falls back to the role dashboard` | una ruta inexistente (`#/something-unknown`) cae en el dashboard del rol |
| `logout clears the session and returns to a public page` | "Cerrar sesión" limpia `localStorage.trackvision_session` y deja al usuario en `#/welcome` |

### `Sidebar navigation`

| Test | Qué valida |
|---|---|
| `user can navigate between dashboard and history via the sidebar` | desde `#/user`, click en "Historial" → `#/history`, click en "Analizar canción" → vuelve a `#/user` |
| `producer sidebar shows the producer-specific label` | el sidebar de productor muestra "Analizar producción" (en vez de "Analizar canción") |

### `analysis-flow.spec.js` — Dashboards de Usuario y Productor → Resultados

**User dashboard — analyze from YouTube**

| Test | Qué valida |
|---|---|
| `shows an error for a non-YouTube link` | un link no-YouTube muestra "Ingresa un link válido de YouTube." y se queda en `#/user` |
| `clears the error once the user edits the input` | el mensaje de error desaparece al editar el campo |
| `a valid link runs the analysis and lands on /results` | un link válido muestra el overlay "Analizando canción…", luego navega a `#/results` y se ven "Rating ML", "Score predictivo", "Mejor fecha sugerida para lanzar la canción" y "Recomendaciones principales" |

**Producer dashboard — MP3 upload**

| Test | Qué valida |
|---|---|
| `requires a file before analyzing` | click en "Analizar MP3" sin archivo → "Selecciona un archivo .mp3 para analizar." |
| `rejects non-mp3 files` | subir un `.wav` → "Solo se permiten archivos .mp3" |
| `accepts an mp3 file and runs the analysis` | subir un `.mp3` válido → nombre visible en el dropzone, "Analizar MP3" lleva a `#/results` mostrando el nombre del archivo y "Rating ML" |

**Producer dashboard — analyze from YouTube**

| Test | Qué valida |
|---|---|
| `shows an error for a non-YouTube link` | input inválido en el panel de productor muestra el mismo error de validación |
| `a valid link runs the analysis and lands on /results` | link válido → `#/results` con "Rating ML" visible |

**Results page sin análisis activo**

| Test | Qué valida |
|---|---|
| `shows the empty state and can navigate back to analyze` | sin análisis guardado, `#/results` muestra "No hay ningún análisis todavía" y "Volver a analizar" regresa a `#/user` |

### `history.spec.js` — Historial de análisis

**Estado vacío**

| Test | Qué valida |
|---|---|
| `shows empty state when no analyses were saved` | `#/history` sin datos muestra "Aún no tienes análisis guardados" y "Crear primer análisis" lleva a `#/user` |

**Con análisis guardados**

| Test | Qué valida |
|---|---|
| `a completed analysis is saved and listed` | tras analizar un link, aparece en `#/history` como "Análisis desde YouTube" con botón "Eliminar" |
| `deleting the only entry restores the empty state` | borrar la única entrada vuelve a mostrar el empty state |
| `source filter (YouTube / MP3) narrows the list` | con 2 análisis de YouTube: filtro "MP3" → "No hay análisis de este tipo."; filtro "YouTube"/"Todos" → muestra ambos |
| `"Ver resultado" reopens the analysis on the results page` | click en "Ver resultado" navega a `#/results` mostrando "Rating ML" |
| `sort order can be switched between recent and best rating` | el `<select>` de orden cambia entre `recent` y `rating`, manteniendo ambas entradas visibles |

---

## 5. Particularidades / decisiones de diseño detectadas durante el testing

- **Carga asíncrona de Babel**: `index.html` carga React/Babel/Tailwind por CDN y transpila los `.jsx` con `type="text/babel"` *después* del evento `load`. Las pruebas unitarias esperan explícitamente (`waitForFunction`) a que `window.mockAnalysisService` exista antes de usarlo.
- **Router por hash sin sincronización inicial**: al cargar `/` sin hash, el estado interno de React arranca en `"/welcome"` pero `window.location.hash` queda vacío hasta la primera navegación (`navigate()`). Por eso no se afirma `toHaveURL(/#\/welcome$/)` justo después de `page.goto('/')`.
- **"Analizar canción" es ambiguo en el DOM**: tanto el ítem del sidebar (rol "user") como el botón de submit del dashboard tienen el texto accesible "Analizar canción". Las pruebas que interactúan con el botón de submit lo escopean con `page.getByRole('main').getByRole('button', { name: 'Analizar canción' })`.
- **Logout no aterriza en `/login`**: por el orden de efectos en `app.jsx` (el guard de sesión corre antes de que `hashchange` propague el nuevo hash), `handleLogout` termina dejando al usuario en `#/welcome` en lugar de `#/login`. Las pruebas reflejan este comportamiento real; si se corrige en la app, actualizar `auth.spec.js` (`logging in again recalls the role chosen at registration`) y `navigation-guards.spec.js` (`logout clears the session and returns to a public page`).

---

## 6. Próximos pasos sugeridos

- Agregar un proyecto Playwright para **mobile viewport** (la UI tiene clases `lg:`/`sm:` específicas para sidebar/menú móvil).
- Cuando exista backend real, agregar pruebas de integración que mockeen las respuestas HTTP (`page.route`) en lugar de `mockAnalysisService`.
- Considerar tests de accesibilidad básicos (`@axe-core/playwright`) sobre las páginas principales.
