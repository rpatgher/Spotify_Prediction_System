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
    assert 0 <= body["score"] <= 100
    assert body["rating"] in {"A", "B", "C", "D", "E", "F"}
    assert "bestReleaseDate" in body
    # features/recommendations are empty until the UI uses the layer-2 outputs.
    assert body["features"] == []
    assert body["recommendations"] == []
    # Layer-2 YouTube outputs are present (int when the model is available,
    # null when it isn't — e.g. CI without the .pkl / scikit-learn).
    for key in ("expectedViews", "expectedLikes", "expectedComments"):
        assert key in body
        assert body[key] is None or isinstance(body[key], int)


def test_mp3_input_name_from_filename(client):
    import io
    r = client.post(
        "/api/predictions/mp3",
        files={"file": ("track.mp3", io.BytesIO(b"fake audio"), "audio/mpeg")},
    )
    pred_id = r.json()["id"]
    detail = client.get(f"/api/predictions/{pred_id}").json()
    assert detail["source"] == "mp3"
    assert detail["inputName"] == "track.mp3"


def test_history_list_and_filter(client):
    import io
    client.post("/api/predictions/youtube", json={"url": "https://youtu.be/a"})
    client.post(
        "/api/predictions/mp3",
        files={"file": ("y.mp3", io.BytesIO(b"fake audio"), "audio/mpeg")},
    )

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


def test_mp3_upload_requires_productor_role(client):
    """POST /mp3 with only rol 'usuario' (no 'productor') must return 403."""
    from app.main import app
    from app.security.auth import get_current_user_roles

    # Re-override roles to just "usuario" for this test.
    original = app.dependency_overrides.get(get_current_user_roles)
    app.dependency_overrides[get_current_user_roles] = lambda: {"usuario"}
    try:
        import io
        fake_file = io.BytesIO(b"fake audio content")
        r = client.post(
            "/api/predictions/mp3",
            files={"file": ("track.mp3", fake_file, "audio/mpeg")},
        )
        assert r.status_code == 403
    finally:
        if original is not None:
            app.dependency_overrides[get_current_user_roles] = original
        else:
            app.dependency_overrides.pop(get_current_user_roles, None)
