"""Audio feature extraction — SEAM for the user's own function.

The real implementation (download audio from YouTube / fetch the mp3 URL and
compute audio features with Essentia, as prototyped in the notebook) lives
OUTSIDE this file and will be wired in here later.

For now this returns a hard-coded feature vector so the full request flow works
end to end. The 10 keys match the audio features used to train the model
(see DOCUMENTATION.md §4.6).
"""

# The 10 audio features the model expects, in the notebook's order.
AUDIO_FEATURE_KEYS = [
    "danceability",
    "energy",
    "key",
    "loudness",
    "mode",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
]


def extract_features(url: str, source: str) -> dict[str, float]:
    """Return audio features for the given input.

    Args:
        url: YouTube link or mp3 file URL.
        source: "youtube" or "mp3".

    Returns:
        Mapping of audio-feature name -> value.

    TODO(integration): replace the hard-coded return below with a call to the
    real extractor, e.g.:

        from my_audio_pipeline import compute_features  # your function
        return compute_features(url)            # download + Essentia features

    Its exact signature is still TBD; this seam isolates the rest of the app
    from it, so only this function needs to change.
    """
    # --- HARD-CODED PLACEHOLDER (no real audio processing) ---
    return {
        "danceability": 0.72,
        "energy": 0.65,
        "key": 5.0,
        "loudness": -6.3,
        "mode": 1.0,
        "speechiness": 0.08,
        "acousticness": 0.12,
        "instrumentalness": 0.0,
        "liveness": 0.11,
        "valence": 0.58,
    }
