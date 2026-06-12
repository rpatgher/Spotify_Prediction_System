"""Métricas Prometheus custom para el pipeline de inferencia."""
from prometheus_client import Counter, Histogram

inference_latency = Histogram(
    "inference_duration_seconds",
    "Latencia de inferencia del modelo ML (extracción de features + predict)",
    buckets=[0.5, 1, 2.5, 5, 10, 20, 30, 60, 120],
)
inference_total = Counter(
    "inference_requests_total",
    "Total de inferencias",
    ["result_class", "status"],
)
input_validation_errors = Counter(
    "model_input_validation_errors_total",
    "Inputs rechazados por validación",
)
