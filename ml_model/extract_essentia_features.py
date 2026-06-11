#!/usr/bin/env python3
"""
extract_essentia_features.py
=============================
Extrae el conjunto COMPLETO de descriptores clasicos de Essentia (via
MusicExtractor) de una carpeta de MP3 y los empareja con Spotify_Youtube.csv
usando el track ID de Spotify: el valor que sigue a 'spotify:track:' en la
columna `Uri` (p. ej. spotify:track:0d28khcov6AiegSCpG5TuT -> 0d28khcov6AiegSCpG5TuT).

Se asume que cada MP3 se llama por su track ID (p. ej. 0d28khcov6AiegSCpG5TuT.mp3).
Si el nombre trae texto extra, el script intenta detectar el ID de 22 caracteres
dentro del nombre.

Caracteristicas:
  * Resumible: guarda cada resultado en un checkpoint .jsonl; si se corta, al
    re-ejecutar continua donde quedo.
  * Tolerante a fallos: un MP3 corrupto NO detiene el proceso; se registra en
    <out>.failed.txt y se sigue.
  * Barra de progreso (tqdm) y procesamiento paralelo opcional (--jobs).
  * Salida 1: CSV con una fila por track (cientos de columnas de features).
  * Salida 2 (--merge): CSV unido al dataset original, listo para modelar
    'alcance' (incluye Views, Likes, Comments, Stream).

Uso minimo:
    python extract_essentia_features.py --audio-dir /ruta/a/mp3s

Uso tipico:
    python extract_essentia_features.py \
        --audio-dir /ruta/a/mp3s \
        --csv Spotify_Youtube.csv \
        --out essentia_features.csv \
        --jobs 4 --merge

Requisitos:
    pip install essentia pandas tqdm numpy
    (Windows: usar WSL. Ver README.md)
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

import numpy as np
import pandas as pd

try:
    from tqdm import tqdm
except ImportError:  # tqdm es opcional
    def tqdm(it, **kwargs):
        return it

# ID de Spotify = 22 caracteres base62
ID_RE = re.compile(r'[A-Za-z0-9]{22}')


# --------------------------------------------------------------------------- #
# Emparejamiento de IDs
# --------------------------------------------------------------------------- #
def track_id_from_uri(uri):
    """spotify:track:<id> -> <id>"""
    if not isinstance(uri, str):
        return None
    parts = uri.strip().split(':')
    if len(parts) >= 3 and parts[-2] == 'track':
        return parts[-1]
    m = ID_RE.search(uri)
    return m.group(0) if m else None


def track_id_from_filename(path, needed):
    """Deriva el track ID del nombre del archivo. Primero prueba el nombre tal
    cual; si no esta en el set 'needed', busca un ID de 22 chars dentro."""
    stem = path.stem
    if stem in needed:
        return stem
    m = ID_RE.search(stem)
    if m and m.group(0) in needed:
        return m.group(0)
    return stem  # se filtrara despues si no esta en 'needed'


# --------------------------------------------------------------------------- #
# Aplanado del Pool de Essentia a un dict plano de columnas
# --------------------------------------------------------------------------- #
def flatten_pool(pool, include_matrices=False, max_array_len=100,
                 skip_prefixes=('metadata.tags',)):
    """Convierte el Pool de Essentia en {columna: valor}.

    - Escalares (float/int/str): se guardan tal cual.
    - Vectores 1-D cortos (<= max_array_len, p. ej. mfcc.mean=13): se expanden a
      columnas name.0, name.1, ...
    - Vectores 1-D largos de longitud variable (beats_position, onset_times...):
      se OMITEN (no se alinean entre canciones).
    - Matrices 2-D (covarianzas): se omiten salvo --include-matrices.
    - Listas de strings (secuencias de acordes...): se omiten.
    """
    out = {}
    for name in pool.descriptorNames():
        if any(name.startswith(p) for p in skip_prefixes):
            continue
        val = pool[name]
        if isinstance(val, str):
            out[name] = val
        elif isinstance(val, (bool, int, float, np.floating, np.integer)):
            out[name] = float(val)
        elif isinstance(val, np.ndarray):
            arr = np.asarray(val)
            if arr.ndim == 0:
                out[name] = float(arr)
            elif arr.ndim == 1:
                if arr.size <= max_array_len:
                    for i, v in enumerate(arr):
                        out[f'{name}.{i}'] = float(v)
            elif arr.ndim == 2 and include_matrices:
                for i in range(arr.shape[0]):
                    for j in range(arr.shape[1]):
                        out[f'{name}.{i}.{j}'] = float(arr[i, j])
        # otros tipos -> se omiten
    return out


# --------------------------------------------------------------------------- #
# Worker (debe ser picklable: definido a nivel de modulo)
# --------------------------------------------------------------------------- #
def extract_one(task):
    """Corre MusicExtractor sobre un archivo. Devuelve (track_id, feats|None, err|None)."""
    track_id, path, include_matrices, max_array_len = task
    try:
        from essentia.standard import MusicExtractor
        extractor = MusicExtractor(
            lowlevelStats=['mean', 'stdev'],
            rhythmStats=['mean', 'stdev'],
            tonalStats=['mean', 'stdev'],
        )
        features, _frames = extractor(path)
        feats = flatten_pool(features, include_matrices, max_array_len)
        feats['track_id'] = track_id
        feats['__source_file'] = os.path.basename(path)
        return track_id, feats, None
    except Exception as e:  # noqa: BLE001  (queremos no abortar el batch)
        return track_id, None, f'{type(e).__name__}: {e}'


# --------------------------------------------------------------------------- #
# Checkpoint helpers
# --------------------------------------------------------------------------- #
def load_done(jsonl_path):
    done = {}
    if jsonl_path.exists():
        with open(jsonl_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                tid = rec.get('track_id')
                if tid:
                    done[tid] = rec
    return done


def load_failed(path):
    failed = set()
    if path.exists():
        with open(path, encoding='utf-8') as f:
            for line in f:
                tid = line.split('\t', 1)[0].strip()
                if tid:
                    failed.add(tid)
    return failed


def write_result(jf, ff, track_id, feats, err):
    if err is None and feats is not None:
        jf.write(json.dumps(feats, ensure_ascii=False) + '\n')
        jf.flush()
    else:
        ff.write(f'{track_id}\t{str(err).replace(chr(10), " ")}\n')
        ff.flush()


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(
        description='Extrae features de Essentia (MusicExtractor) y los empareja con el CSV.')
    ap.add_argument('--audio-dir', required=True, help='Carpeta con los MP3.')
    ap.add_argument('--csv', default='Spotify_Youtube.csv', help='Dataset de entrada.')
    ap.add_argument('--out', default='essentia_features.csv', help='CSV de features de salida.')
    ap.add_argument('--ext', default='mp3', help='Extension(es) de audio, separadas por coma.')
    ap.add_argument('--jobs', type=int, default=1, help='Procesos en paralelo.')
    ap.add_argument('--max-array-len', type=int, default=100,
                    help='Longitud maxima de vector 1-D que se expande a columnas.')
    ap.add_argument('--include-matrices', action='store_true',
                    help='Tambien aplanar matrices 2-D (covarianzas).')
    ap.add_argument('--limit', type=int, default=None, help='Procesar solo N (debug).')
    ap.add_argument('--retry-failed', action='store_true',
                    help='Reintentar los que fallaron en corridas previas.')
    ap.add_argument('--no-resume', action='store_true', help='Ignorar checkpoint y empezar de cero.')
    ap.add_argument('--merge', action='store_true', help='Generar tambien el CSV unido al dataset.')
    ap.add_argument('--merged-out', default='dataset_modeling.csv', help='CSV unido de salida.')
    args = ap.parse_args()

    audio_dir = Path(args.audio_dir)
    if not audio_dir.is_dir():
        sys.exit(f'ERROR: no existe la carpeta de audio: {audio_dir}')
    if not Path(args.csv).is_file():
        sys.exit(f'ERROR: no existe el CSV: {args.csv}')

    # 1) IDs que necesitamos (del CSV)
    df = pd.read_csv(args.csv)
    if 'Uri' not in df.columns:
        sys.exit("ERROR: el CSV no tiene columna 'Uri'.")
    df['track_id'] = df['Uri'].map(track_id_from_uri)
    needed = set(df['track_id'].dropna().unique())
    print(f'[CSV] {len(df)} filas, {len(needed)} track IDs unicos.')

    # 2) Escanear audio y emparejar
    exts = {e.strip().lower().lstrip('.') for e in args.ext.split(',')}
    files = [p for p in audio_dir.rglob('*') if p.suffix.lower().lstrip('.') in exts]
    id_to_path = {}
    for p in files:
        tid = track_id_from_filename(p, needed)
        if tid in needed and tid not in id_to_path:
            id_to_path[tid] = str(p)
    matched = set(id_to_path)
    print(f'[AUDIO] {len(files)} archivos encontrados | {len(matched)} emparejados | '
          f'{len(needed - matched)} IDs sin audio | {len(files) - len(matched)} archivos sin fila en CSV.')
    if not matched:
        sys.exit('ERROR: ningun archivo se emparejo. Revisa que los MP3 se llamen por el track ID '
                 'o usa --ext correcto.')

    # 3) Checkpoints
    jsonl = Path(str(args.out) + '.jsonl')
    failed_path = Path(str(args.out) + '.failed.txt')
    done = {} if args.no_resume else load_done(jsonl)
    failed = set() if (args.no_resume or args.retry_failed) else load_failed(failed_path)

    to_do = [tid for tid in matched if tid not in done and tid not in failed]
    if args.limit:
        to_do = to_do[:args.limit]
    print(f'[PLAN] {len(done)} ya hechos, {len(failed)} fallados antes, {len(to_do)} por procesar.')

    # 4) Procesar
    tasks = [(tid, id_to_path[tid], args.include_matrices, args.max_array_len) for tid in to_do]
    if tasks:
        with open(jsonl, 'a', encoding='utf-8') as jf, open(failed_path, 'a', encoding='utf-8') as ff:
            if args.jobs > 1:
                with ProcessPoolExecutor(max_workers=args.jobs) as ex:
                    futs = {ex.submit(extract_one, t): t[0] for t in tasks}
                    for fut in tqdm(as_completed(futs), total=len(futs), desc='Extrayendo'):
                        tid, feats, err = fut.result()
                        write_result(jf, ff, tid, feats, err)
            else:
                for t in tqdm(tasks, desc='Extrayendo'):
                    tid, feats, err = extract_one(t)
                    write_result(jf, ff, tid, feats, err)

    # 5) Consolidar jsonl -> CSV
    done_all = load_done(jsonl)
    if not done_all:
        sys.exit('No se extrajo ningun feature.')
    feat_df = pd.DataFrame(list(done_all.values()))
    front = [c for c in ('track_id', '__source_file') if c in feat_df.columns]
    feat_df = feat_df[front + [c for c in feat_df.columns if c not in front]]
    feat_df.to_csv(args.out, index=False)
    print(f'[OK] {args.out}: {feat_df.shape[0]} filas x {feat_df.shape[1]} columnas.')

    n_failed = len(load_failed(failed_path))
    if n_failed:
        print(f'[AVISO] {n_failed} archivos fallaron (ver {failed_path}). '
              f'Reintenta con --retry-failed.')

    # 6) Merge opcional con el dataset original
    if args.merge:
        merged = df.merge(feat_df.drop(columns=['__source_file'], errors='ignore'),
                          on='track_id', how='left', suffixes=('', '_essentia'))
        merged.to_csv(args.merged_out, index=False)
        with_feats = merged['track_id'].isin(set(feat_df['track_id'])).sum()
        print(f'[OK] {args.merged_out}: {merged.shape[0]} filas x {merged.shape[1]} columnas '
              f'({with_feats} filas con features de audio).')


if __name__ == '__main__':
    main()
