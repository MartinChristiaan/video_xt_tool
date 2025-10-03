import os
import subprocess
import time

import pytest
import requests


@pytest.fixture(scope="module")
def api_server():
	yield "http://127.0.0.1:5000"

def test_get_timestamps(api_server):
	# These are example parameters. You might need to adjust them based on your actual data.
	params = {
		'videoset_name': 'leusderheide_20230705',
		'camera': 'visual_halfres/CPFS7_0310'
	}
	response = requests.get(f"{api_server}/timestamps", params=params)
	assert response.status_code == 200
	assert isinstance(response.json(), list)

def test_get_timeseries_options(api_server):
	params = {
		'videoset_name': 'leusderheide_20230705',
		'camera': 'visual_halfres/CPFS7_0310'
	}
	response = requests.get(f"{api_server}/timeseries_options", params=params)
	assert response.status_code == 200
	assert isinstance(response.json(), list)

def test_get_column_options(api_server):
	params = {
		'videoset_name': 'leusderheide_20230705',
		'camera': 'visual_halfres/CPFS7_0310',
		'timeseries_name': 'detections/yolov8x_mscoco.csv'
	}
	response = requests.get(f"{api_server}/column_options", params=params)
	assert response.status_code == 200
	assert isinstance(response.json(), list)

def test_get_timeseries_data(api_server):
	params = {
		'videoset_name': 'leusderheide_20230705',
		'camera': 'visual_halfres/CPFS7_0310',
		'timeseries_name': 'detections/yolov8x_mscoco.csv',
		'y_column': 'bbox_x',
		'z_column': 'confidence',
	}
	response = requests.get(f"{api_server}/timeseries_data", params=params)
	assert response.status_code == 200
	data = response.json()
	assert 'x' in data
	assert 'y' in data
	assert 'z' in data

def test_get_subsets(api_server):
	response = requests.get(f"{api_server}/subsets")
	assert response.status_code == 200
	assert isinstance(response.json(), list)

def test_get_subset(api_server):
	# Assuming 'my_subset' exists from the example
	response = requests.get(f"{api_server}/subset/my_subset")
	assert response.status_code == 200
	assert isinstance(response.json(), list)

def test_save_subset(api_server):
	data = {
		"name": "test_subset",
		"data": [
			{"videoset": "a", "camera": "b", "annotation_suffix": "c"}
		]
	}
	response = requests.post(f"{api_server}/subset", json=data)
	assert response.status_code == 200
	assert response.json() == {"success": True}

	# check if the file was created
	response = requests.get(f"{api_server}/subset/test_subset")
	assert response.status_code == 200
	assert response.json() == data['data']

