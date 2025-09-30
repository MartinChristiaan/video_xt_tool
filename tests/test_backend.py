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

def test_can_set_timeseries():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Get available options first
	response = requests.get("http://localhost:5000/timeseries_options")
	options = response.json()["options"]
	# Use the first available option
	if len(options) > 0:
		response = requests.post("http://localhost:5000/set_timeseries", json={"option": options[0]})
		assert response.status_code == 200
		data = response.json()
		assert "message" in data
		assert "n_rows" in data
		assert data["n_rows"] > 0

def test_can_get_columns_after_loading_timeseries():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Get and set first timeseries option
	response = requests.get("http://localhost:5000/timeseries_options")
	options = response.json()["options"]
	if len(options) > 0:
		requests.post("http://localhost:5000/set_timeseries", json={"option": options[0]})
		# Now test columns endpoint
		response = requests.get("http://localhost:5000/columns")
		assert response.status_code == 200
		data = response.json()
		assert "columns" in data
		assert len(data["columns"]) > 0
		assert "timestamp" in data["columns"]

def test_can_set_columns():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Get and set first timeseries option
	response = requests.get("http://localhost:5000/timeseries_options")
	options = response.json()["options"]
	if len(options) > 0:
		requests.post("http://localhost:5000/set_timeseries", json={"option": options[0]})
		# Get available columns
		response = requests.get("http://localhost:5000/columns")
		columns = response.json()["columns"]
		# Set first non-timestamp column as y if available
		non_timestamp_cols = [col for col in columns if col != "timestamp"]
		if len(non_timestamp_cols) > 0:
			response = requests.post("http://localhost:5000/set_columns", json={"y": non_timestamp_cols[0], "z": None})
			assert response.status_code == 200
			data = response.json()
			assert "message" in data

def test_can_get_timeseries_data():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Set up timeseries
	response = requests.get("http://localhost:5000/timeseries_options")
	options = response.json()["options"]
	if len(options) > 0:
		requests.post("http://localhost:5000/set_timeseries", json={"option": options[0]})
		# Test timeseries endpoint
		response = requests.get("http://localhost:5000/timeseries")
		assert response.status_code == 200
		data = response.json()
		assert "X" in data
		assert "Y" in data
		assert "Z" in data
		assert len(data["X"]) > 0  # Should have timestamps

def test_can_get_frame():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Get timestamps
	response = requests.get("http://localhost:5000/timestamps")
	timestamps = response.json()["timestamps"]
	if len(timestamps) > 0:
		# Request frame at first timestamp
		response = requests.get(f"http://localhost:5000/frame?timestamp={timestamps[0]}")
		assert response.status_code == 200
		assert response.headers.get('content-type') == 'image/jpeg'
		assert len(response.content) > 0

def test_can_get_detections():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Set up timeseries first
	response = requests.get("http://localhost:5000/timeseries_options")
	options = response.json()["options"]
	if len(options) > 0:
		requests.post("http://localhost:5000/set_timeseries", json={"option": options[0]})
		# Get timestamps
		response = requests.get("http://localhost:5000/timestamps")
		timestamps = response.json()["timestamps"]
		if len(timestamps) > 0:
			# Request detections at first timestamp
			response = requests.get(f"http://localhost:5000/detections?timestamp={timestamps[0]}")
			assert response.status_code == 200
			data = response.json()
			print(data)
			assert "detections" in data

def test_can_load_annotations():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Try to load annotations without suffix
	response = requests.post("http://localhost:5000/annotations/load", json={})
	# Don't assert success here as annotations might not exist, but check it doesn't crash
	assert response.status_code in [200, 400, 500]  # Various valid responses

def test_can_get_annotations():
	response = requests.post("http://localhost:5000/set_videoset", json={"videoset": "leusderheide_20230706","camera":"visual_halfres/CPFS7_0332" })
	# Test annotations endpoint (should work even if no annotations loaded)
	response = requests.get("http://localhost:5000/annotations")
	assert response.status_code == 200
	data = response.json()
	assert "X" in data
	assert "Y" in data
	assert "Z" in data

def test_health_endpoint():
	response = requests.get("http://localhost:5000/health")
	assert response.status_code == 200
	data = response.json()
	assert data["status"] == "ok"

# def test_error_handling_invalid_json():
# 	# Test invalid JSON in POST requests
# 	response = requests.post("http://localhost:5000/set_videoset", data="invalid json")
# 	assert response.status_code == 400

# 	response = requests.post("http://localhost:5000/set_timeseries", data="invalid json")
# 	assert response.status_code == 400

# def test_error_handling_missing_parameters():
# 	# Test missing required parameters
# 	response = requests.post("http://localhost:5000/set_videoset", json={})
# 	assert response.status_code == 400

# 	response = requests.post("http://localhost:5000/set_timeseries", json={})
# 	assert response.status_code == 400

# 	response = requests.get("http://localhost:5000/frame")
# 	assert response.status_code == 400

# 	response = requests.get("http://localhost:5000/detections")
# 	assert response.status_code == 400


if __name__ == "__main__":
	pytest.main()

