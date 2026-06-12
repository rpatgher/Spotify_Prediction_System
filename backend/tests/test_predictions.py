def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_youtube_prediction_flow(client):
    # 1. Create a prediction -> only the id comes back.
    r = client.post("/api/predictions/youtube", json={"url": "https://youtu.be/abc123"})
    assert r.status_code == 201
    pred_id = r.json()["id"]
    assert pred_id

    # 2. Fetch the full detail (frontend AnalysisResult shape, camelCase).
    r = client.get(f"/api/predictions/{pred_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == pred_id
    assert body["source"] == "youtube"
    assert body["inputValue"] == "https://youtu.be/abc123"
    assert body["rating"] == "B"
    assert body["score"] == 82
    assert "bestReleaseDate" in body
    assert len(body["features"]) == 3
    assert len(body["recommendations"]) == 3


def test_mp3_input_name_from_url(client):
    r = client.post("/api/predictions/mp3", json={"url": "https://cdn.example.com/songs/track.mp3"})
    pred_id = r.json()["id"]
    detail = client.get(f"/api/predictions/{pred_id}").json()
    assert detail["source"] == "mp3"
    assert detail["inputName"] == "track.mp3"


def test_history_list_and_filter(client):
    client.post("/api/predictions/youtube", json={"url": "https://youtu.be/a"})
    client.post("/api/predictions/mp3", json={"url": "https://x/y.mp3"})

    all_items = client.get("/api/predictions").json()
    assert len(all_items) == 2

    only_yt = client.get("/api/predictions?source=youtube").json()
    assert len(only_yt) == 1
    assert only_yt[0]["source"] == "youtube"


def test_get_missing_returns_404(client):
    r = client.get("/api/predictions/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_delete_prediction(client):
    pred_id = client.post("/api/predictions/youtube", json={"url": "https://youtu.be/z"}).json()["id"]
    assert client.delete(f"/api/predictions/{pred_id}").status_code == 204
    assert client.get(f"/api/predictions/{pred_id}").status_code == 404
