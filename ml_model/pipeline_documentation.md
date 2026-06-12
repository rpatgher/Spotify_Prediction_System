# Documentación del Pipeline de Entrenamiento
## Modelo de Predicción de Éxito Musical y Engagement con Features de Audio (Essentia)

---

## 1. Objetivo del modelo

El sistema predice, a partir únicamente de las **características de audio** de una canción (extraídas con Essentia), cuatro valores:

1. **success_score** — un porcentaje de éxito esperado (0–100), derivado de los streams de Spotify.
2. **Views** — vistas esperadas del video en YouTube.
3. **Likes** — likes esperados en YouTube.
4. **Comments** — comentarios esperados en YouTube.

El modelo está pensado para alimentar una aplicación: cuando llega una canción nueva, se procesa con Essentia, y esas features se pasan al modelo para obtener las cuatro predicciones. Por eso todo el pipeline se construyó sobre features de Essentia: son las mismas que la app puede generar en tiempo de inferencia.

---

## 2. El dataset de partida

### 2.1 Cómo se generó el dataset

El dataset utilizado **fue generado por nuestro equipo**. No se tomó listo de una fuente única, sino que se construyó en dos etapas:

1. **Base de Kaggle.** Se partió de un dataset público de Kaggle que contenía, por canción, la metadata de Spotify y YouTube (streams, vistas, likes, comentarios, tipo de álbum, si tenía video oficial, etc.).

2. **Extracción de audio con Essentia.** Para esas mismas canciones, se buscó el archivo de audio de cada una y se procesó con **Essentia**, recuperando sus atributos de audio de bajo nivel (espectro, ritmo, tonalidad, dinámica, timbre). Estos descriptores son mucho más detallados que las features de audio que traía la base original de Spotify.

De esta forma, se **transformó** el dataset base de Kaggle en uno enriquecido: las mismas canciones, pero ahora con cientos de features de audio reales extraídas directamente del sonido, unidas a su metadata de streams y engagement.

Esta decisión fue deliberada y central para el proyecto: como la aplicación final procesará canciones nuevas con Essentia en tiempo de inferencia, el modelo debía entrenarse sobre exactamente el mismo tipo de features que recibirá en producción.

### 2.2 Composición del dataset resultante

El dataset final combina dos fuentes por canción:

- **Features de audio de Essentia**: cientos de descriptores numéricos del sonido (espectro, ritmo, tonalidad, dinámica, timbre), extraídos por nuestro equipo.
- **Metadata de Spotify y YouTube** (de la base de Kaggle): streams, vistas, likes, comentarios, tipo de álbum, si hay video oficial, etc.

Tamaño inicial: **11.628 canciones × 671 columnas**.

> **Término sencillo — "feature":** una feature es simplemente una columna de datos que describe algo de la canción. Por ejemplo, "qué tan fuerte suena en promedio" o "cuántos beats por minuto tiene". El modelo aprende mirando muchas features a la vez.

---

## 3. Limpieza y preprocesamiento

Antes de modelar, el dataset necesitaba limpieza. Con 671 columnas era fácil arrastrar columnas inútiles o engañosas, así que se inspeccionó por grupos.

### 3.1 Columnas fantasma: `rhythm.beats_position` (100 columnas eliminadas)

Essentia genera una columna por cada beat individual de la canción (`beats_position.0`, `.1`, ... hasta `.99`). Como cada canción tiene un número distinto de beats, las columnas altas (`.98`, `.99`) solo tenían datos en 3-4 canciones de las 11.628; el resto estaban vacías.

**Decisión:** eliminar las 100 columnas completas.

**Razón:** no son features reales, son un vector de longitud variable que se "desparramó" en columnas. Una columna que solo tiene datos en el 0,03% de las filas no le sirve al modelo.

### 3.2 El namespace `metadata` (16 columnas eliminadas) — y por qué el bitrate era peligroso

Las columnas de `metadata` describen el **archivo** MP3, no la **música**: bitrate, codec, sample rate, hash del archivo, versión de Essentia, etc.

**Decisión:** eliminar todo el namespace `metadata`.

**Razón — y este es un punto crítico:** la columna `bit_rate` (calidad de compresión del MP3) tenía 2.577 valores distintos. Si se hubiera dejado, el modelo podría haber aprendido a asociar cierta calidad de archivo con el éxito.

> **Término sencillo — "data leakage" (fuga de datos):** ocurre cuando el modelo aprende a predecir usando una pista que en realidad no es una causa legítima, sino un accidente de cómo se armó el dataset. Ejemplo: si por casualidad las canciones famosas de tu dataset las descargaste en alta calidad (bitrate alto) y las desconocidas en baja calidad, el modelo "aprendería" que bitrate alto = éxito. Pero eso es trampa: en producción, ese patrón no se sostiene, y el modelo fallaría. Por eso se elimina cualquier feature que sea un artefacto del archivo y no una propiedad de la música.

### 3.3 Columnas constantes (6 eliminadas)

Algunas columnas tenían el mismo valor en todas las canciones (configuraciones fijas del análisis de Essentia, como `equal_loudness` o `sample_rate`).

**Decisión:** eliminar las columnas constantes.

**Razón:** una feature que vale lo mismo para todas las canciones no puede ayudar a distinguir unas de otras. Es información cero.

### 3.4 Manejo de valores nulos y filtrado de targets

Tras la limpieza estructural, solo quedaban nulos en columnas del dataset original (no de Essentia, que estaba completo). El caso importante: **134 canciones** tenían algún target nulo (sin streams, o sin datos de YouTube por no tener video enlazado).

**Decisión:** descartar esas 134 filas y trabajar con las **11.494 canciones** que tenían los cuatro targets completos.

**Razón:** no se puede entrenar un modelo de regresión sobre un objetivo vacío (sería pedirle que aprenda a predecir algo que no sabemos). Y como 134 de 11.628 es apenas el 1,15%, descartarlas no sesga el dataset y es más simple que mantener subconjuntos distintos por target.

> **Nota sobre imputar vs descartar:** para una *feature* faltante, lo normal es rellenar el hueco con la mediana (imputar). Para un *target* faltante, imputar sería inventar la respuesta correcta, lo que contamina el entrenamiento y las métricas. Por eso los targets nulos se descartan, no se imputan.

### 3.5 Algoritmos de tonalidad redundantes (4 columnas eliminadas)

Essentia estima la tonalidad de la canción con tres algoritmos distintos (`key_edma`, `key_krumhansl`, `key_temperley`). Los tres daban casi siempre el mismo resultado.

**Decisión:** conservar solo `key_edma` (el más robusto) y descartar los `.key`/`.scale` de los otros dos. Sus valores de confianza (`.strength`) sí se conservaron como features numéricas.

**Razón:** usar los tres sería repetir la misma información tres veces, gastando espacio de features sin aportar nada nuevo.

### 3.6 Identificadores y texto libre (eliminados)

Columnas como `Track`, `Artist`, `Album`, `Url_spotify`, `Title`, `Description`, etc., son identificadores o texto libre, no descripciones del sonido. Se descartaron.

### 3.7 Features viejas de audio de Spotify (eliminadas)

El dataset original traía las features de audio de Spotify (`Danceability`, `Energy`, etc.). Se descartaron porque Essentia cubre lo mismo con mucho más detalle, y conservar ambas habría metido redundancia.

**Estado tras la limpieza:** 11.494 canciones, ~521 features de audio de Essentia + 7 categóricas + 4 targets.

---

## 4. Definición del target principal (success_score)

El éxito en Spotify se mide por `Stream` (número de reproducciones). Pero ese número no se puede usar crudo como objetivo: va de unos miles a más de **3.000 millones**, con una distribución muy desbalanceada.

### 4.1 El problema de la escala

La mayoría de las canciones tienen relativamente pocos streams, y un puñado de hits acumulan cantidades enormes.

> **Término sencillo — "distribución sesgada a la derecha":** imagina que ordenas a todas las canciones por streams. Casi todas se amontonan en la parte baja, y unas pocas se disparan muy lejos hacia arriba. Esa "cola larga" hacia la derecha es el sesgo. Es un problema porque el modelo, al entrenar, se obsesiona con los pocos valores gigantes y aprende mal el comportamiento de la mayoría.

### 4.2 La solución: transformación logarítmica + escalado por percentiles

El `success_score` se construyó en dos pasos:

**Paso 1 — Logaritmo.** Se aplicó `log(Stream)`.

> **Término sencillo — "logaritmo":** es una operación matemática que "comprime" los números grandes y "expande" los pequeños. Una canción con 1.000 millones de streams y otra con 1.000 millones × 10 quedan, en escala log, mucho más cerca. Esto convierte la cola larga en una curva mucho más pareja, en forma de campana. Sin el log, el 75% de las canciones puntuaban por debajo de 11 sobre 100; con el log, la mediana subió a ~57, repartiendo el score de forma utilizable.

**Paso 2 — Escalado de 0 a 100 entre el percentil 1 y el 99.** Se tomó el valor de streams (en log) del percentil 1 (P1) y del 99 (P99), y se escaló todo el rango a 0–100.

> **Término sencillo — "percentil":** el percentil 1 es el valor por debajo del cual está el 1% de las canciones con menos streams; el percentil 99, el valor por encima del cual está el 1% con más streams. Usarlos como topes evita que un único mega-hit defina la escala.

> **Término sencillo — "clip" (recorte):** a las canciones por debajo de P1 se les asigna el score mínimo (0), y a las de arriba de P99 el máximo (100). No se inventan datos: se "topan" los extremos. Conceptualmente, un hit de 3.000 millones y otro de 1.300 millones son *ambos* éxito máximo; la diferencia entre ellos no aporta información útil.

**Resultado:** un `success_score` con media 56,2 y mediana 56,9 — una campana bien centrada y casi simétrica, ideal para que un modelo de regresión aprenda.

> **Decisión importante — recortar vs descartar los extremos:** se eligió recortar (clip) en lugar de descartar las canciones extremas. Razón: una canción con streams extremos sigue teniendo features de audio perfectamente válidas; descartar la fila tiraría esa información útil. El clip conserva la fila y solo neutraliza el valor extremo del target.

---

## 5. Los targets de YouTube (Views, Likes, Comments)

Estos tres ya venían en el dataset, pero con el mismo problema de sesgo extremo (la canción mediana tenía 14M de views; la máxima, 8.000M).

**Decisión:** aplicar `log1p` a los tres antes de entrenar, y revertir con `expm1` al reportar errores.

> **Término sencillo — "log1p" y "expm1":** `log1p(x)` es `log(1+x)`; se usa el "+1" para poder aplicar logaritmo incluso a valores de 0 (el log de 0 no existe). `expm1` es la operación inversa, que devuelve el número a su escala real. Así, el modelo entrena en una escala "comprimida" y manejable, pero los resultados se presentan en vistas/likes/comentarios reales.

**Observación del análisis:** los tres targets están altamente correlacionados entre sí (0,88–0,97). Es decir, miden casi lo mismo: una canción con muchas vistas tiende a tener muchos likes y comentarios. Esto anticipó que los tres modelos rendirían parecido.

---

## 6. La arquitectura: modelo jerárquico de dos capas

En lugar de un solo modelo que prediga las cuatro cosas, se usó una estructura en dos capas:

- **Capa 1** predice el `success_score` a partir de las features de audio.
- **Capa 2** predice Views/Likes/Comments usando las features de audio **más la predicción de éxito de la Capa 1** como una feature adicional.

**Razón:** el análisis mostró que el éxito en Spotify y el engagement en YouTube están relacionados (correlación ~0,60) pero no son lo mismo. Ese nivel de relación es justo el ideal para que la predicción de éxito aporte información útil a la Capa 2 sin ser redundante. Pasarle a la Capa 2 "qué tan exitosa se espera que sea la canción" la ayuda a predecir su engagement.

---

## 7. Selección de features: la decisión más importante del pipeline

Con ~521 features de audio, no se podían usar todas: meterlas crudas habría introducido ruido y redundancia. Hubo que elegir un subconjunto. Aquí ocurrió el aprendizaje técnico central del proyecto.

### 7.1 Primer intento (fallido): selección por correlación de Pearson

Se eligieron las 50 features con mayor **correlación de Pearson** con el target.

> **Término sencillo — "correlación de Pearson":** mide si dos cosas suben y bajan juntas **en línea recta**. Si al aumentar una feature el target aumenta de forma proporcional, la correlación es alta. Pero solo detecta relaciones *lineales* (de línea recta).

**Resultado:** R² de apenas **0,091**. Decepcionante.

### 7.2 El diagnóstico: la señal era no-lineal

Al revisar, el modelo lineal (Ridge) sacó un R² de prácticamente 0 (0,0022), mientras que los modelos de árbol (Random Forest, XGBoost) sí captaban algo. Esto reveló el problema:

> **Término sencillo — "relación no-lineal":** a veces el efecto de una feature sobre el resultado no es una línea recta. Por ejemplo: una canción puede beneficiarse de tener energía media, pero perjudicarse si tiene energía muy alta O muy baja. O el efecto de una feature puede depender del valor de otra. La correlación de Pearson es **ciega** a estos patrones. Los modelos de árbol (Random Forest, XGBoost) sí los capturan.

El error fue elegir features con un criterio lineal (Pearson) para un problema que era no-lineal. Se estaban seleccionando las features equivocadas.

### 7.3 La solución: selección por importancia de Random Forest

Se entrenó un Random Forest sobre **todas** las features y se le pidió su ranking de **importancia**.

> **Término sencillo — "feature importance" (importancia de features):** cuando un Random Forest entrena, puede medir cuánto usó cada feature para acertar. Las que más usó son las "más importantes". A diferencia de Pearson, esta medida sí captura relaciones no-lineales y combinaciones entre features.

**Resultado:** con las mismas 50 features (pero elegidas por importancia en vez de por Pearson), el R² saltó de **0,091 a 0,221** — más del doble, sin cambiar nada más. Esto confirmó el diagnóstico: el problema no era la cantidad de features, sino *cuáles* se elegían.

### 7.4 Cuántas features usar: el barrido de K

Se probaron distintos tamaños (K = 50, 100, 150, 250, 400, 552 features). El R² tocó techo en ~150 features (0,2230) y **bajaba** al agregar más.

**Decisión:** usar **50 features**.

**Razón:** 50 features daban 0,221 y 150 daban 0,223 — una diferencia invisible. Para una aplicación, menos features es mejor: inferencia más rápida, menos cosas que pueden fallar, modelo más simple de mantener. No vale la pena duplicar las features por una mejora de 0,002.

> **Hallazgo clave:** agregar más de 150 features *empeoraba* el modelo. Eso significa que la mayoría de las ~521 features son ruido para este problema; solo un grupo capta señal real. La señal del éxito en el audio es difusa, no concentrada en unas pocas features estrella.

### 7.5 Evitar redundancia en la selección

Antes de seleccionar, se verificó cuántas features eran casi-copias unas de otras. De 517 features, 139 eran redundantes (correlación >0,95 con otra). Por ejemplo, los seis `spectral_contrast_valleys.stdev` medían esencialmente lo mismo.

Esto importó porque seleccionar a ciegas habría llenado los 50 espacios con clones de la misma información. La selección por importancia de Random Forest mitiga esto naturalmente, al repartir la importancia entre features redundantes.

---

## 8. Entrenamiento y evaluación sin trampas

### 8.1 Separación train/test

Los datos se dividieron en 80% para entrenar y 20% para evaluar (test).

> **Término sencillo — "train/test split":** se aparta una porción de los datos (el test) que el modelo nunca ve durante el entrenamiento. Es como un examen con preguntas nuevas: si el modelo acierta sobre datos que nunca vio, sabemos que de verdad aprendió y no solo memorizó.

### 8.2 Validación cruzada

Para medir el rendimiento de forma robusta se usó **validación cruzada de 5 particiones (5-fold)**.

> **Término sencillo — "validación cruzada":** en vez de confiar en una sola división train/test (que podría salir buena o mala por suerte), se divide el entrenamiento en 5 partes. Se entrena 5 veces, cada vez usando 4 partes para aprender y 1 para evaluar, rotando. El resultado es el promedio de las 5. Así el número es estable y no depende del azar de una sola división. En el proyecto, las desviaciones bajísimas (~0,01) confirmaron que los resultados eran sólidos y reproducibles.

### 8.3 La selección de features se hizo solo sobre el train

Punto metodológico importante: el Random Forest que eligió las features aprendió **solo del train**, nunca del test.

**Razón:** si las features se eligieran mirando todos los datos (incluyendo el test), el modelo tendría una ventaja injusta sobre el test, y las métricas saldrían infladas. Es otra forma de data leakage, llamada "leakage de selección".

### 8.4 La feature jerárquica se generó de forma honesta (out-of-fold)

Para la Capa 2, se necesitaba el `success_score` *predicho* por la Capa 1 como feature. Para las filas de train, esa predicción se generó con `cross_val_predict` (predicciones "out-of-fold").

> **Término sencillo — "out-of-fold":** si usáramos el mismo modelo de Capa 1 para predecir sobre las filas con las que se entrenó, esas predicciones serían "demasiado buenas" (el modelo ya vio las respuestas). En su lugar, se predice cada fila usando un modelo que NO la vio durante su entrenamiento. Así, la feature `predicted_success` tiene en train la misma calidad realista que tendrá en producción, y la Capa 2 no aprende a confiar de más en ella.

---

## 9. Resultados finales

Todos medidos sobre el conjunto de test apartado (datos que los modelos nunca vieron):

| Capa | Target | R² (test) | MAE |
|---|---|---|---|
| Capa 1 | success_score | 0,229 | 13,98 puntos (sobre 100) |
| Capa 2 | Views | 0,356 | 75,3 M (escala real) |
| Capa 2 | Likes | 0,368 | 533,8 K (escala real) |
| Capa 2 | Comments | 0,339 | 20,9 K (escala real) |

> **Término sencillo — "R²" (coeficiente de determinación):** indica qué porcentaje de la variación del resultado logra explicar el modelo, de 0 a 1. Un R² de 0,229 significa que el modelo explica el ~23% de lo que hace que una canción tenga más o menos éxito; el 77% restante depende de factores que no están en el audio. Un R² de 0 sería no explicar nada; un 1, predicción perfecta.

> **Término sencillo — "MAE" (error absoluto medio):** es, en promedio, cuánto se equivoca el modelo. Un MAE de 13,98 en el success_score significa que, en promedio, la predicción se desvía ~14 puntos del valor real (en la escala 0–100).

**Sobre el MAE gigante de Views (75 millones):** parece alarmante, pero está dominado por los videos virales. Cuando el modelo le erra a un video de 2.000 millones de vistas, ese error enorme infla el promedio. El R² en escala log es la métrica fiel para la canción típica; el MAE real es una cota pesimista.

### Lectura de los resultados

1. **La Capa 2 (YouTube) predice mejor que la Capa 1 (Spotify).** Las features de audio dicen más sobre cómo le irá a un video en YouTube que sobre cuántos streams tendrá en Spotify. Esto fue consistente con el análisis exploratorio previo.

2. **El orden de dificultad fue el esperado:** Likes ≥ Views > Comments. Los comentarios son los más difíciles de predecir porque son los más ruidosos (muchas canciones tienen cero comentarios, y comentar depende de factores como la controversia, no solo del audio).

3. **El predictor más fuerte del engagement de YouTube fue `official_video`** (tener video oficial), no una feature de audio. Las canciones con video oficial tenían ~11× las vistas de las que no (en mediana).

---

## 10. Limitaciones y conclusión honesta

El R² de la Capa 1 (~0,23) puede parecer bajo, pero **no es un fallo del modelo: es el techo del problema**.

El éxito de una canción depende mayormente de factores **extra-sonoros** que el audio no captura: la popularidad del artista, el respaldo del sello, la presencia en playlists editoriales, el marketing, el timing del lanzamiento y la viralidad. Ningún modelo, por sofisticado que sea, puede predecir desde el audio lo que no está en el audio.

Esto está documentado en la literatura: los modelos basados solo en audio rara vez superan AUC 0,70–0,75 para predicción de éxito. El resultado obtenido es, por tanto, coherente con el estado del arte y constituye un hallazgo legítimo: **las características sonoras explican una porción modesta pero real del éxito (~23%) y del engagement (~35%), siendo el resto atribuible a factores fuera del audio.**

Para una aplicación de **orientación relativa** —comparar canciones entre sí, ubicar una en un rango de potencial, dar diagnóstico sobre su perfil sonoro— este modelo es utilizable. Para predicción de cifras exactas, el audio por sí solo no alcanza, y la vía de mejora con mayor impacto no sería ajustar el modelo, sino **enriquecer el dataset con features extra-sonoras**.

---

## Anexo: glosario rápido de términos

| Término | En palabras sencillas |
|---|---|
| **Feature** | Una columna de datos que describe algo de la canción. |
| **Target** | Lo que el modelo intenta predecir (aquí: éxito, vistas, likes, comentarios). |
| **Regresión** | Predecir un número continuo (vs. clasificación, que predice categorías). |
| **Data leakage** | Cuando el modelo aprende de una pista tramposa que no estará disponible o no es legítima en producción. |
| **Distribución sesgada** | Datos donde la mayoría se amontona en un extremo y unos pocos se disparan muy lejos. |
| **Logaritmo (log)** | Operación que comprime los números grandes para emparejar la distribución. |
| **Percentil** | El valor por debajo del cual cae un cierto porcentaje de los datos (P99 = el 99% está por debajo). |
| **Correlación de Pearson** | Mide si dos variables suben/bajan juntas en línea recta. Ciega a relaciones no-lineales. |
| **Relación no-lineal** | Cuando el efecto de una feature no es una línea recta (depende del valor o de otras features). |
| **Random Forest** | Modelo que combina muchos árboles de decisión; capta relaciones no-lineales. |
| **Feature importance** | Cuánto usó el modelo cada feature para acertar. |
| **R²** | Porcentaje de la variación del resultado que el modelo logra explicar (0 a 1). |
| **MAE** | Error promedio del modelo, en las unidades del target. |
| **Train/test split** | Apartar datos que el modelo no ve, para evaluarlo de forma justa. |
| **Validación cruzada** | Entrenar y evaluar varias veces rotando las particiones, para un resultado estable. |
| **Out-of-fold** | Predecir cada fila con un modelo que no la usó para entrenar; evita predicciones infladas. |
| **One-hot encoding** | Convertir una categoría (ej. tonalidad C, D, E...) en columnas de 0 y 1. |
| **Overfitting (sobreajuste)** | Cuando el modelo memoriza el train en vez de aprender, y falla con datos nuevos. |
