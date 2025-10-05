import fnmatch
from collections import defaultdict

import requests
import streamlit as st


def get_available_videosets():
	response = requests.get("http://localhost:5000/videosets")
	return response.json()


def get_annotation_options(videoset, camera):
	response = requests.get(
		f"http://localhost:5000/annotations/options/{videoset}/{camera}"
	)
	return response.json()


if "videosets" not in st.session_state:
	st.session_state["videosets"] = get_available_videosets()

if "subset_list" not in st.session_state:
	st.session_state["subset_list"] = []

if "current_subset_list" not in st.session_state:
	st.session_state["current_subset_list"] = []

if "all_annotation_options" not in st.session_state:
	st.session_state["all_annotation_options"] = []
if "selected_annotation_suffix" not in st.session_state:
	st.session_state["selected_annotation_suffix"] = None
if "annotation_suffixes_per_sequence" not in st.session_state:
	st.session_state["annotation_suffixes_per_sequence"] = {}

if "sequences_per_suffix" not in st.session_state:
	st.session_state["sequences_per_suffix"] = defaultdict(list)


videosets = get_available_videosets()
# videoset_glob_pattern =  "*leusderheide*"
# camera_glob_pattern = "*halfres*"
videoset_glob_pattern = st.text_input("Videoset glob pattern", "*leusderheide*")
camera_glob_pattern = st.text_input("Camera glob pattern", "*halfres*")


if st.button("Get matching sequences"):
	st.session_state["current_subset_list"] = []
	available_videosets = fnmatch.filter(videosets.keys(), videoset_glob_pattern)
	# all_camera_options = []
	for vs in available_videosets:
		cameras = videosets[vs]["cameras"]
		available_cameras = fnmatch.filter(cameras, camera_glob_pattern)
		for cam in available_cameras:
			st.session_state.current_subset_list.append(
				{"videoset": vs, "camera": cam, "annotation_suffix": "Undefined"}
			)
if st.button("Get annotation options for matching sequences"):
	all_annotation_options = []
	for entry in st.session_state["current_subset_list"]:
		options = get_annotation_options(
			entry["videoset"], entry["camera"].replace("/", "___")
		)
		for option in options:
			st.session_state.sequences_per_suffix[option].append(
				f"{entry['videoset']}_{entry['camera']}"
			)

if len(st.session_state["current_subset_list"]) > 0:
	if st.button("Clear current subset list"):
		st.session_state["current_subset_list"] = []
		st.session_state["sequences_per_suffix"] = defaultdict(list)
		st.session_state["selected_annotation_suffix"] = None
		st.session_state["annotation_suffixes_per_sequence"] = {}
		st.rerun()
	if st.button("Remove sequences with annotation undefined"):
		st.session_state["current_subset_list"] = [
			entry
			for entry in st.session_state["current_subset_list"]
			if entry["annotation_suffix"] != "Undefined"
		]
		st.rerun()

	st.write(f"Found {len(st.session_state['current_subset_list'])} matching sequences")
	st.dataframe(st.session_state["current_subset_list"])

for suffix, sequences in st.session_state["sequences_per_suffix"].items():
	st.write(f"### Suffix: {suffix} ({len(sequences)} sequences)")
	if st.button(f"Apply annotation suffix '{suffix}' to {len(sequences)} sequences"):
		for entry in st.session_state["current_subset_list"]:
			if f"{entry['videoset']}_{entry['camera']}" in sequences:
				entry["annotation_suffix"] = suffix
		st.rerun()
	with st.expander(f"Show sequences for suffix '{suffix}'"):
		st.dataframe(sequences)
