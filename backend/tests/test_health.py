def test_health_endpoint_reports_ok(app):
    client = app.test_client()
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert "time" in data
