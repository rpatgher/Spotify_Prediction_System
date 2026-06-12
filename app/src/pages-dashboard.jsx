// ============================================================
// Dashboard pages — UserDashboard + ProducerDashboard
// ============================================================
import React, { useState as useStateD } from "react";
import { mockAnalysisService, withDummyFiller } from "./mockService.jsx";
import { apiService } from "./apiService.jsx";
import { Icon, Card, InfoBlock, LoadingAnalysis } from "./components.jsx";
import { PageHeader, YouTubeInput, FileUploadDropzone } from "./layout.jsx";

export function isValidYouTube(url) {
  return /youtube\.com|youtu\.be/i.test(url.trim());
}

// Shared: run an analysis, persist it, route to results.
// Returns a function that accepts (promise, setError).
// On failure: clears loading and surfaces error.message via setError.
function useRunAnalysis({ navigate, setLoading, onResult }) {
  return async (promise, setError) => {
    setLoading(true);
    try {
      const rawResult = await promise;
      // Mezcla el resultado real con relleno dummy para campos aún no
      // implementados en el backend (features, summary, recommendations).
      // TEMPORAL: eliminar withDummyFiller cuando el backend los devuelva.
      const result = withDummyFiller(rawResult);
      // 1. current analysis  2. redirect
      // (saveToHistory eliminado: el backend persiste el análisis automáticamente)
      mockAnalysisService.setCurrentAnalysis(result);
      onResult();
      navigate("/results");
    } catch (err) {
      setError(err.message || "Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };
}

// ---- USER DASHBOARD --------------------------------------------------
export function UserDashboardPage({ navigate, setLoading, loading, onResult }) {
  const [url, setUrl] = useStateD("");
  const [error, setError] = useStateD("");
  const run = useRunAnalysis({ navigate, setLoading, onResult });

  const analyze = () => {
    if (!isValidYouTube(url)) { setError("Ingresa un link válido de YouTube."); return; }
    setError("");
    run(apiService.analyzeYouTubeLink(url.trim()), setError);
  };

  const blocks = [
    { icon: "youtube", title: "Detectamos señales del video", text: "Vistas, duración, interacción y comportamiento general." },
    { icon: "wave", title: "Simulamos datos musicales", text: "Energía, ritmo, popularidad y potencial de audiencia." },
    { icon: "sparkle", title: "Generamos una predicción", text: "Rating, fecha sugerida y recomendaciones." },
  ];

  return (
    <>
      {loading && <LoadingAnalysis />}
      <PageHeader
        title="Analiza una canción desde YouTube"
        subtitle="Pega el link de una canción o video musical y simularemos una predicción basada en señales de rendimiento, audiencia y comportamiento musical."
      />

      <Card className="p-6 sm:p-7">
        <YouTubeInput
          value={url}
          onChange={(v) => { setUrl(v); error && setError(""); }}
          onSubmit={analyze}
          placeholder="Pega aquí tu link de YouTube…"
          buttonLabel="Analizar canción"
          error={error}
        />
      </Card>

      <Card className="p-6 sm:p-7">
        <h3 className="font-display text-lg font-bold text-white mb-2">¿Qué hace esta pantalla?</h3>
        <p className="text-[14px] text-white/55 leading-relaxed max-w-3xl">
          Esta herramienta toma un link de YouTube como referencia y simula el análisis de información relevante como vistas, interacción, posibles reproducciones, engagement y señales de popularidad. Con estos datos, el sistema genera una predicción del desempeño potencial de la canción.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 mt-7 pt-7" style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
          {blocks.map((b, i) => <InfoBlock key={i} {...b} accent={[162, 178, 150][i]} />)}
        </div>
      </Card>
    </>
  );
}

// ---- PRODUCER DASHBOARD ----------------------------------------------
export function ProducerDashboardPage({ navigate, setLoading, loading, onResult }) {
  const [file, setFile] = useStateD(null);
  const [fileError, setFileError] = useStateD("");
  const [url, setUrl] = useStateD("");
  const [urlError, setUrlError] = useStateD("");
  const run = useRunAnalysis({ navigate, setLoading, onResult });

  const analyzeMp3 = () => {
    if (!file) { setFileError("Selecciona un archivo .mp3 para analizar."); return; }
    run(apiService.analyzeMp3File(file), setFileError);
  };
  const analyzeUrl = () => {
    if (!isValidYouTube(url)) { setUrlError("Ingresa un link válido de YouTube."); return; }
    setUrlError("");
    run(apiService.analyzeYouTubeLink(url.trim()), setUrlError);
  };

  const blocks = [
    { icon: "file", title: "Análisis de archivo", text: "Simulación de características de audio como energía, ritmo y estructura." },
    { icon: "youtube", title: "Análisis de video", text: "Simulación de datos de YouTube como vistas, alcance e interacción." },
    { icon: "target", title: "Recomendaciones", text: "Sugerencias para mejorar lanzamiento, engagement y estrategia." },
  ];

  return (
    <>
      {loading && <LoadingAnalysis label="Analizando producción…" />}
      <PageHeader
        title="Panel para productores"
        subtitle="Sube un archivo MP3 o pega un link de YouTube para analizar el potencial de lanzamiento de una canción."
      />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Option 1: MP3 */}
        <Card className="p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "oklch(0.66 0.18 162 / 0.16)", color: "oklch(0.76 0.15 162)" }}><Icon name="upload" className="w-4 h-4" /></span>
            <h3 className="font-display font-bold text-white">Subir archivo MP3</h3>
          </div>
          <FileUploadDropzone file={file} setFile={setFile} error={fileError} setError={setFileError} />
          <button onClick={analyzeMp3} className="btn-primary justify-center mt-4">
            <Icon name="sparkle" className="w-4 h-4" /> Analizar MP3
          </button>
        </Card>

        {/* Option 2: YouTube */}
        <Card className="p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: "oklch(0.72 0.2 25 / 0.16)", color: "oklch(0.74 0.18 25)" }}><Icon name="youtube" className="w-4 h-4" /></span>
            <h3 className="font-display font-bold text-white">Analizar desde YouTube</h3>
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed mb-4">
            Pega el enlace del video musical y simularemos el análisis de su rendimiento en la plataforma.
          </p>
          <div className="flex-1 flex flex-col justify-center">
            <YouTubeInput
              large
              value={url}
              onChange={(v) => { setUrl(v); urlError && setUrlError(""); }}
              onSubmit={analyzeUrl}
              placeholder="Pega aquí el link de YouTube de tu canción…"
              buttonLabel="Analizar link"
              error={urlError}
            />
          </div>
        </Card>
      </div>

      <Card className="p-6 sm:p-7">
        <h3 className="font-display text-lg font-bold text-white mb-2">¿Qué puede analizar un productor?</h3>
        <p className="text-[14px] text-white/55 leading-relaxed max-w-3xl">
          Esta interfaz está pensada para productores que quieren evaluar el potencial de una canción antes de lanzarla. El sistema permite simular el análisis de un archivo MP3 o de un video de YouTube, generando una predicción de desempeño y recomendaciones para mejorar el lanzamiento.
        </p>
        <div className="grid sm:grid-cols-3 gap-6 mt-7 pt-7" style={{ borderTop: "1px solid oklch(1 0 0 / 0.06)" }}>
          {blocks.map((b, i) => <InfoBlock key={i} {...b} accent={[162, 25, 150][i]} />)}
        </div>
      </Card>
    </>
  );
}

Object.assign(window, { isValidYouTube });
