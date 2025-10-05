import threading
from pathlib import Path

import cv2
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from vset_utils.vset_select import (
    get_annotation_options,
    get_mediamanager,
    get_timeseries_options,
    get_videosets,
)

app = Flask(__name__)
CORS(app)

class MediaManagerCache:
    def __init__(self,max_len=20):
        self.cache = {}
        self._lock = threading.Lock()

    def get(self, videoset_name, camera):
        key = (videoset_name, camera)
        with self._lock:
            if key not in self.cache:
                self.cache[key] = get_mediamanager(videoset_name, camera)
            if len(self.cache) > 20:
                self.cache.pop(next(iter(self.cache))) # remove oldest entry
            return self.cache[key]

media_manager_cache = MediaManagerCache()
class FrameCache:
    def __init__(self, max_len=100):
        self.cache = {}
        self.max_len = max_len
        self._lock = threading.Lock()

    def get(self, videoset,camera, timestamp: float):
        key = (videoset,camera, timestamp)
        with self._lock:
            if key not in self.cache:
                mm = media_manager_cache.get(videoset,camera)
                frame, _ = mm.get_frame_nearest(timestamp)
                self.cache[key] = frame
            if len(self.cache) > self.max_len:
                self.cache.pop(next(iter(self.cache)))  # remove oldest entry
            return self.cache[key]
frame_cache = FrameCache()

@app.route("/videosets", methods=["GET"])
def videosets():
    videosets = get_videosets()
    data = {name: {"cameras": videosets[name].cameras} for name in videosets.names}
    return jsonify(data)

@app.route("/timestamps", methods=["GET"])
def get_timestamps():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    mm = media_manager_cache.get(videoset_name, camera)
    return jsonify(mm.timestamps)

@app.route("/timeseries_options", methods=["GET"])
def timeseries_options():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    mm = media_manager_cache.get(videoset_name, camera)
    options = get_timeseries_options(mm)
    return jsonify(options)

@app.route("/timeseries_data", methods=["GET"])
def get_timeseries_data():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    timeseries_name = request.args.get("timeseries_name")
    y_column = request.args.get("y_column")
    z_column = request.args.get("z_column")

    mm = media_manager_cache.get(videoset_name, camera)
    df = mm.load(timeseries_name)

    data = {"x": df["timestamp"].tolist()}
    if y_column and y_column in df.columns:
        data["y"] = df[y_column].tolist()
    if z_column and z_column in df.columns:
        data["z"] = df[z_column].tolist()

    return jsonify(data)

@app.route("/column_options", methods=["GET"])
def get_column_options():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    timeseries_name = request.args.get("timeseries_name")
    mm = media_manager_cache.get(videoset_name, camera)
    df = mm.load(timeseries_name)
    return jsonify(df.columns.tolist())

@app.route("/frame/<videoset_name>/<camera>/<timestamp>", methods=["GET"])
def get_frame(videoset_name,camera,timestamp):
    camera = camera.replace("___", "/")
    frame = frame_cache.get(videoset_name,camera, float(timestamp))
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    jpg_bytes = cv2.imencode(".jpg", frame)[1].tobytes()
    return (jpg_bytes, 200, {"Content-Type": "image/jpeg"})

@app.route("/frame_size", methods=["GET"])
def get_frame_size():
    videoset_name = request.args.get("videoset")
    camera = request.args.get("camera")
    timestamp = request.args.get("timestamp")
    assert timestamp is not None, "timestamp parameter is required"
    frame = frame_cache.get(videoset_name,camera, float(timestamp))
    height, width = frame.shape[:2]
    return jsonify({"width": width, "height": height})

@app.route("/annotations", methods=["GET"])
def get_annotations():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    annotation_suffix = request.args.get("annotation_suffix")
    y_column = request.args.get("y_column", "bbox_y")  # Default to bbox_y if not specified
    mm = media_manager_cache.get(videoset_name, camera)
    df = mm.load_annotations(annotation_suffix)

    data = {
        "x": df["timestamp"].tolist(),
        "y": df[y_column].tolist() if y_column in df.columns else [],
    }
    # Add z column if bbox_x exists (for completeness)
    if "bbox_x" in df.columns:
        data["z"] = df["bbox_x"].tolist()

    return jsonify(data)

@app.route("/annotation_at_timestamp", methods=["GET"])
def get_annotation_at_timestamp():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    annotation_suffix = request.args.get("annotation_suffix")
    timestamp = request.args.get("timestamp", type=float)
    y_column = request.args.get("y_column", "bbox_y")

    mm = media_manager_cache.get(videoset_name, camera)
    df = mm.load_annotations(annotation_suffix)

    # Filter by timestamp
    filtered_df = df[df["timestamp"] == timestamp]

    if filtered_df.empty:
        return jsonify([])

    # Convert to records format similar to timeseries_at_timestamp
    data = filtered_df.to_dict("records")
    return jsonify(data)

@app.route("/timeseries_at_timestamp", methods=["GET"])
def get_timeseries_at_timestamp():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    timeseries_name = request.args.get("timeseries_name")
    timestamp = request.args.get("timestamp", type=float)
    mm = media_manager_cache.get(videoset_name, camera)
    df = mm.load(timeseries_name)
    if df is None:
        mm.load(timeseries_name,True)
    assert df is not None, f'{timeseries_name} not found for {videoset_name} {camera}'
    data = df[df["timestamp"] == timestamp].to_dict("records")

    return jsonify(data)

@app.route("/subsets", methods=["GET"])
def get_subsets():
    subset_dir = Path("subsets")
    subsets = [p.stem for p in subset_dir.glob("*.csv")]
    return jsonify(subsets)

@app.route("/subset/<name>", methods=["GET"])
def get_subset(name):
    subset_path = Path("subsets") / f"{name}.csv"
    if subset_path.exists():
        df = pd.read_csv(subset_path)
        return jsonify(df.to_dict("records"))
    return jsonify({"error": "Subset not found"}), 404

@app.route("/subset", methods=["POST"])
def save_subset():
    data = request.get_json()
    name = data.get("name")
    subset_data = data.get("data")
    if not name or not subset_data:
        return jsonify({"error": "Invalid data"}), 400

    df = pd.DataFrame(subset_data)
    subset_path = Path("subsets") / f"{name}.csv"
    df.to_csv(subset_path, index=False)
    return jsonify({"success": True})

@app.route("/annotations/options/<videoset>/<camera>", methods=["GET"])
def annotation_options(videoset, camera):
    camera =camera.replace("___", "/")
    mm = media_manager_cache.get(videoset, camera)
    options = get_annotation_options(mm)
    options = [x.stem for x in options if not 'tmp' in str(x) and not 'old' in str(x)]
    parsed_options = []
    for option in options:
        if len(option.split('_')) > 2:
            suffix= option.split('_')[1]
        else:
            suffix=None
        parsed_options.append(suffix)

    # print(f"Annotation options for {videoset} {camera}: {options}")
    return jsonify(parsed_options)

if __name__ == "__main__":
    app.run(debug=True)
