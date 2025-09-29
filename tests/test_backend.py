import pytest
import requests


def test_returns_vieosets():
	response = requests.get("http://localhost:5000/videosets")
	assert response.status_code == 200
	data = response.json()
	assert len(data) > 0
	assert len(data[list(data.keys())[0]]) > 0

def test_can_set_videoset():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	assert response.status_code == 200

def test_can_set_videoset_and_return_timestamp():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	assert response.status_code == 200
	response = requests.get("http://localhost:5000/timestamps")
	assert response.status_code == 200
	data = response.json()
	timestamps = data["timestamps"]
	assert len(timestamps) > 0

def test_can_get_timeseries_options():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	response = requests.get("http://localhost:5000/timeseries_options")
	assert response.status_code == 200
	data = response.json()
	assert "options" in data
	assert len(data["options"]) > 0


if __name__ == "__main__":
	pytest.main()

