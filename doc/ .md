# TrackWise — Spotify Prediction System

Documentación general del repositorio: contexto del proyecto, estructura de carpetas, arquitectura del frontend, modelo de Machine Learning y estado actual de cada componente.

---

## 1. Contexto general

**TrackWise** es un sistema que busca predecir el potencial de éxito de una canción combinando:

- **Datos de audio de Spotify** (danceability, energy, valence, tempo, etc.)
- **Datos de rendimiento en YouTube** (vistas, interacción)
- **Un modelo de Machine Learning** entrenado para clasificar si una canción tiene potencial de llegar al Top 200 de Spotify.

El proyecto está dividido en tres grandes bloques:

| Carpeta | Contenido | Estado |
|---|---|---|
| `app/` | Frontend web (React vía CDN, sin build) — UI completa con datos simulados (mock) | Funcional, pendiente de conectar a backend real |
| `ml_model/` | Notebook de Jupyter con el desarrollo del modelo predictivo | Modelo entrenado y evaluado (XGBoost) |
| `infra/` | Diagrama de infraestructura (Cisco Packet Tracer) | Diseño de red/infraestructura |

Actualmente **no existe backend** (API) implementado: el frontend usa un servicio simulado (`mockService.jsx`) que persiste todo en `localStorage`, dejando puntos de extensión claramente marcados con comentarios `// BACKEND:` para conectar el modelo real más adelante.

---

## 2. Estructura del repositorio

```
Spotify_Prediction_System/
├── .gitignore
├── app/                          # Frontend (React + Tailwind, sin bundler)
│   ├── index.html                # Punto de entrada único; carga React/Babel/Tailwind por CDN
│   ├── screenshots/               # Capturas de pantalla de la UI (flujos, checks, prod)
│   └── src/
│       ├── constants.jsx          # Branding, claves de localStorage, textos por defecto
│       ├── mockService.jsx        # Capa de "API" simulada (auth, análisis, historial)
│       ├── components.jsx         # Átomos/moléculas reutilizables (Icon, Card, RatingBadge…)
│       ├── layout.jsx             # Sidebar, Navbar, AppLayout, inputs (YouTube, MP3 dropzone)
│       ├── pages-welcome.jsx      # Landing page
│       ├── pages-auth.jsx         # Login / Registro
│       ├── pages-dashboard.jsx    # Dashboards de Usuario y Productor
│       ├── pages-results.jsx      # Página de resultados del análisis
│       ├── pages-history.jsx      # Historial de análisis
│       └── app.jsx                # Router (hash-based) + guard de sesión
├── ml_model/
│   └── Spotify_Success_Prediction.ipynb   # EDA, preparación de datos y entrenamiento del modelo
└── infra/
    └── Infra.pkt                  # Diagrama de infraestructura (Cisco Packet Tracer)
```

---

## 3. Frontend (`app/`)

### 3.1 Stack tecnológico

- **React 18** y **ReactDOM** cargados vía CDN (UMD, `react.development.js`)
- **Babel Standalone** para transpilar JSX directamente en el navegador (no hay paso de build/bundling)
- **Tailwind CSS** vía CDN (`cdn.tailwindcss.com`) + estilos custom embebidos en `index.html` (variables `oklch`, tarjetas, botones, inputs, animaciones)
- Tipografías: *Space Grotesk* (display) y *Plus Jakarta Sans* (texto), desde Google Fonts
- Sin `package.json` — el proyecto se ejecuta abriendo `index.html` directamente o sirviéndolo con cualquier servidor estático

### 3.2 Carga de scripts

`index.html` carga los módulos en orden de dependencia (todos como `type="text/babel"`):

```
constants.jsx → mockService.jsx → components.jsx → layout.jsx
→ pages-welcome.jsx → pages-auth.jsx → pages-dashboard.jsx
→ pages-results.jsx → pages-history.jsx → app.jsx
```

Cada archivo expone sus funciones/componentes globalmente vía `Object.assign(window, {...})`, ya que no hay sistema de módulos (ES Modules / bundler).

### 3.3 Enrutamiento y sesión (`app.jsx`)

- Router basado en `window.location.hash` (`useHashRoute`), con rutas válidas:
  `/welcome`, `/login`, `/user`, `/producer`, `/results`, `/history`
- Sesión simulada guardada en `localStorage` (`mockAnalysisService.getSession/setSession/clearSession`)
- **Guards de sesión**:
  - Sin sesión → solo permite `/welcome` y `/login`
  - Con sesión → redirige `/login` y `/welcome` al dashboard según rol (`user` o `producer`)
  - Cada rol solo puede acceder a su propio dashboard (`/user` o `/producer`)

### 3.4 Páginas

| Página | Archivo | Descripción |
|---|---|---|
| **Welcome** | `pages-welcome.jsx` | Landing pública con branding y CTA "Empezar" → `/login` |
| **Login/Registro** | `pages-auth.jsx` | Formulario con tabs (login/registro). En registro se elige rol (`user` o `producer`). Sesión simulada sin validación real, persistida en `localStorage` |
| **Dashboard Usuario** | `pages-dashboard.jsx` (`UserDashboardPage`) | Permite analizar una canción a partir de un link de YouTube |
| **Dashboard Productor** | `pages-dashboard.jsx` (`ProducerDashboardPage`) | Permite analizar subiendo un `.mp3` o pegando un link de YouTube |
| **Resultados** | `pages-results.jsx` | Muestra el resultado del análisis: rating (A–F), score 0–100, fecha sugerida de lanzamiento, resumen, recomendaciones y features relevantes |
| **Historial** | `pages-history.jsx` | Lista de análisis previos con filtro (Todos/YouTube/MP3) y orden (recientes/mejor rating); permite ver de nuevo o eliminar |

### 3.5 Componentes y layout reutilizables

- **`components.jsx`**: `Icon` (set de íconos SVG inline), `Logo`/`Wordmark`, `GradientOrbs` (fondo decorativo), `SourceChip`, `RatingBadge`, `Card`, `FeatureCard`, `RecommendationCard`, `InfoBlock`, `LoadingAnalysis` (overlay con pasos animados), `EmptyState`.
- **`layout.jsx`**: `Sidebar` (navegación según rol), `Navbar`, `AppLayout` (shell con sidebar + contenido scrollable), `PageHeader`, `YouTubeInput` (input de link, variante `large`), `FileUploadDropzone` (drag & drop de `.mp3`).

### 3.6 Constantes y branding (`constants.jsx`)

Centraliza todo lo que debería poder cambiarse fácilmente al conectar el backend real:

- `PROJECT_NAME` = `"TrackWise"`, `PROJECT_TAGLINE`
- `STORAGE_KEYS`: claves de `localStorage` (`session`, `current`, `history`, `users`) — todas con prefijo `trackvision_*` (heredado del nombre anterior del proyecto)
- `RATING_TEXT` / `RATING_HUE`: mapeo de rating (A–F) a texto de veredicto y color (oklch hue)
- `DEFAULT_FEATURES`, `DEFAULT_RECOMMENDATIONS`, `DEFAULT_SUMMARY`, `RELEASE_DATE_NOTE`: contenido mock que el backend real debería poder sobrescribir 1:1

### 3.7 Servicio simulado (`mockService.jsx`)

Actúa como capa de "API" simulada. Forma del resultado de análisis (`AnalysisResult`):

```ts
{
  id, source: "youtube" | "mp3", inputName, inputValue, createdAt,
  rating: "A".."F", score: 0-100, bestReleaseDate,
  features: [{ name, value, recommendation }],
  summary, recommendations: [{ title, description }]
}
```

Funciones expuestas en `mockAnalysisService`, cada una marcada con el endpoint real que la reemplazaría:

| Función | Backend equivalente sugerido |
|---|---|
| `analyzeYouTubeLink(url)` | `POST /api/analyze/youtube { url }` |
| `analyzeMp3File(file)` | `POST /api/analyze/mp3` (multipart) |
| `getHistory()` | `GET /api/history` |
| `saveToHistory(result)` | persistencia server-side |
| `deleteFromHistory(id)` | `DELETE /api/history/:id` |
| `setCurrentAnalysis` / `getCurrentAnalysis` | estado local del análisis activo |
| `getSession` / `setSession` / `clearSession` | autenticación real (tokens) |
| `registerUser` / `findUserRole` | lookup de usuarios reales |

La generación del análisis (`generateAnalysis`) actualmente:
- Genera un score aleatorio (38–97) y deriva el rating (A–F)
- Sugiere una fecha de lanzamiento (próximo viernes, +14 a +45 días)
- Re-randomiza valores de features alrededor de los `DEFAULT_FEATURES`
- Usa `summary` y `recommendations` fijos de `constants.jsx`

### 3.8 Cómo correr el frontend

No requiere instalación de dependencias (no hay `node_modules` ni `package.json`). Basta con:

```bash
cd app
python3 -m http.server 8080
# abrir http://localhost:8080
```

(o cualquier servidor estático / extensión "Live Server").

---

## 4. Modelo de Machine Learning (`ml_model/Spotify_Success_Prediction.ipynb`)

### 4.1 Objetivo

Clasificación binaria: predecir si una canción llegará al **Top 200 de Spotify** (`successful` vs `not_successful`) usando únicamente sus **propiedades de audio** y **género**.

### 4.2 Datasets

- **Dataset 1 — 30,000 Spotify Songs** (Kaggle: `joebeachcapital/30000-spotify-songs`): features de audio (danceability, energy, key, loudness, mode, speechiness, acousticness, instrumentalness, liveness, valence, tempo, duración, género/subgénero, fecha de lanzamiento, etc.)
- **Dataset 2 — Spotify Charts** (Kaggle: `dhruvildave/spotify-charts`): ~26M registros de entradas en charts (Top 200 / Viral 50) en 69 regiones, 2017–2021.

### 4.3 Pipeline de datos

1. **Filtrado temporal**: canciones de Dataset 1 filtradas a 2016–2021 (alineación con charts) → de ~32,000 a 15,602 registros.
2. **Deduplicación**: una canción puede aparecer en múltiples playlists; se conserva un registro único por `track_id` → 13,096 canciones únicas.
3. **Charts**: se filtra solo `top200` (se excluye `Viral 50`); se extrae `track_id` desde la URL de Spotify con regex.
4. **Agregación de charts** por `track_id`: `n_in_top200`, `total_streams`, `avg_streams`, `best_rank`, regiones alcanzadas, etc.
5. **Join** (left join) entre canciones y charts agregados → dataset base de 13,096 canciones (sin nulos; canciones sin apariciones reciben 0 en métricas de chart).

### 4.4 Definición de la clase objetivo

- De 13,096 canciones, 3,561 (27.2%) aparecieron al menos una vez en el Top 200; 9,535 (72.8%) no.
- Se exploró un esquema **multiclase** (`not_successful` / `moderately_successful` / `successful`, con corte en la mediana de apariciones P50=177), pero generó fronteras ambiguas y mayor desbalance (~5.3:1).
- **Esquema final — binario**: `successful` si `n_in_top200 > 0`, `not_successful` en caso contrario (desbalance ~2.7:1).

### 4.5 EDA (análisis exploratorio)

- Distribución de clases: 72.8% / 27.2% (desbalanceado).
- Boxplots de features de audio por clase: canciones exitosas tienden a mayor *danceability* y *valence*.
- Matriz de correlación: `energy`–`loudness` (r=0.72, redundantes), `energy`–`acousticness` (r=-0.57).
- Distribución por género: **Rap, Latin y Pop** muestran mayores tasas de éxito relativo.

### 4.6 Preparación de datos

- **Features de entrada**: 10 audio features (danceability, energy, key, loudness, mode, speechiness, acousticness, instrumentalness, liveness, valence) + `playlist_genre` + `playlist_subgenre`.
- **Encoding**: One-hot encoding sobre género/subgénero (6 + 24 columnas) → 42 features totales. `key` y `mode` se mantienen numéricos. Target codificado con `LabelEncoder` (`not_successful`→0, `successful`→1).
- **Split**: 80% train (10,476) / 20% test (2,620), estratificado.
- **Normalización**: `StandardScaler` ajustado solo en train.
- **Balanceo de clases** (solo en train):
  1. **RandomUnderSampler**: `not_successful` reducido de 7,627 a 4,000.
  2. **SMOTE**: `successful` oversampleado a 4,000.
  - Resultado: 8,000 muestras de entrenamiento balanceadas (4,000 / 4,000).

### 4.7 Modelos entrenados y resultados

| Modelo | Accuracy | F1 (weighted) | AUC-ROC | F1 (successful) |
|---|---|---|---|---|
| Logistic Regression (baseline) | 72% | 0.73 | 0.8036 | — |
| Random Forest (200 estimators, depth 15) | 72% | 0.74 | 0.8161 | 0.61 |
| **XGBoost** (300 estimators, depth 6, lr 0.1) — **mejor modelo** | 74% | 0.75 | 0.8154 | 0.61 |

- **Feature importance (Random Forest)**: `instrumentalness` (0.14) es la feature más predictiva, seguida de `loudness` (0.086), `acousticness` (0.083), `energy` (0.076) y `danceability` (0.069).
- Error más frecuente: falsos positivos (canciones `not_successful` clasificadas como `successful`), atribuible a similitud de audio entre canciones charteadas y no charteadas, y a factores no-audio (marketing, popularidad del artista, redes sociales).

### 4.8 Inferencia desde YouTube (extracción de audio)

Al final del notebook se incluye un prototipo para alimentar el modelo con audio real:
- `download_audio_youtube(track_name, artist_name)`: descarga audio vía `yt_dlp` buscando "`{track} {artist} official audio`".
- Extracción de features de audio con `essentia-tensorflow` (Essentia), para luego alimentarlas al modelo entrenado (XGBoost) y obtener una predicción real — este es el punto de integración natural con el botón "Analizar canción desde YouTube" del frontend.

### 4.9 Limitaciones conocidas

- Solo canciones desde 2017 (alineación con datos de charts).
- `not_successful` es una aproximación: puede haber canciones exitosas en otras plataformas o con problemas de matching de URL.
- Las audio features son estáticas (no capturan evolución de percepción en el tiempo).
- No se consideran factores externos (marketing, popularidad del artista, tendencias en redes sociales).
- Resultados acotados al período 2017–2021; pueden no generalizar a otros mercados/épocas.

---

## 5. Infraestructura (`infra/Infra.pkt`)

Archivo de **Cisco Packet Tracer** con el diseño de la infraestructura de red/sistema propuesta para el despliegue del proyecto. Requiere Cisco Packet Tracer para visualizarlo/editarlo (no es un formato de texto plano).

---

## 6. Estado actual y próximos pasos sugeridos

**Implementado:**
- UI completa (landing, auth, dashboards por rol, resultados, historial) con datos simulados persistidos en `localStorage`.
- Notebook con pipeline completo de datos, EDA, entrenamiento y evaluación del modelo (XGBoost como mejor modelo, AUC-ROC ~0.815).
- Prototipo de extracción de audio desde YouTube + features con Essentia.

**Pendiente / puntos de integración:**
1. Construir un **backend** (API) que exponga los endpoints listados en la sección 3.7 (`/api/analyze/youtube`, `/api/analyze/mp3`, `/api/history`, autenticación real).
2. Servir el modelo entrenado (XGBoost + scaler + encoders) desde ese backend, conectando el pipeline de extracción de audio (YouTube/MP3 → Essentia → features → modelo → `AnalysisResult`).
3. Reemplazar `mockService.jsx` por llamadas `fetch()` reales, manteniendo el mismo shape de `AnalysisResult` para no tener que tocar la UI.
4. Reemplazar la autenticación simulada (`localStorage`) por un sistema de auth real (tokens/sesiones).
5. Posible migración del frontend a un setup con bundler (Vite/CRA) si el proyecto crece, ya que actualmente depende de CDNs y Babel en el navegador (no apto para producción a gran escala).
