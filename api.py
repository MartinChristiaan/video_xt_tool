import threading
from abc import ABC, abstractmethod
from collections import OrderedDict
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


class BaseCache(ABC):
    """Base class for thread-safe LRU caches with configurable size limits."""

    def __init__(self, max_len=100):
        self.cache = OrderedDict()
        self.max_len = max_len
        self._lock = threading.Lock()

    def _evict_if_needed(self):
        """Remove oldest entries if cache exceeds max_len."""
        while len(self.cache) > self.max_len:
            self.cache.popitem(last=False)  # Remove oldest (FIFO/LRU)

    def _get_from_cache(self, key):
        """Get item from cache and mark as recently used."""
        if key in self.cache:
            # Move to end (most recently used)
            value = self.cache.pop(key)
            self.cache[key] = value
            return value
        return None

    def _put_in_cache(self, key, value):
        """Put item in cache and handle eviction."""
        self.cache[key] = value
        self._evict_if_needed()

    @abstractmethod
    def _compute_value(self, *args, **kwargs):
        """Compute the value for a cache miss. Must be implemented by subclasses."""
        pass

    def get(self, *args, **kwargs):
        """Get item from cache or compute it if not present."""
        key = self._make_key(*args, **kwargs)

        with self._lock:
            cached_value = self._get_from_cache(key)
            if cached_value is not None:
                return cached_value

            # Cache miss - compute value
            value = self._compute_value(*args, **kwargs)
            self._put_in_cache(key, value)
            return value

    @abstractmethod
    def _make_key(self, *args, **kwargs):
        """Create cache key from arguments. Must be implemented by subclasses."""
        pass


class MediaManagerCache(BaseCache):
    """Cache for media manager instances."""

    def __init__(self, max_len=20):
        super().__init__(max_len)

    def _make_key(self, videoset_name, camera):
        return (videoset_name, camera)

    def _compute_value(self, videoset_name, camera):
        return get_mediamanager(videoset_name, camera)


media_manager_cache = MediaManagerCache()


class FrameCache(BaseCache):
    """Cache for video frames."""

    def __init__(self, max_len=100):
        super().__init__(max_len)

    def _make_key(self, videoset, camera, timestamp):
        return (videoset, camera, timestamp)

    def _compute_value(self, videoset, camera, timestamp):
        mm = media_manager_cache.get(videoset, camera)
        frame, _ = mm.get_frame_nearest(float(timestamp))
        return frame


frame_cache = FrameCache()


class TimeSeriesCache(BaseCache):
    """Cache for time series data."""

    def __init__(self, max_len=20):
        super().__init__(max_len)

    def _make_key(self, videoset_name, camera, timeseries_name):
        return (videoset_name, camera, timeseries_name)

    def _compute_value(self, videoset_name, camera, timeseries_name):
        mm = media_manager_cache.get(videoset_name, camera)
        return mm.load(timeseries_name)


timeseries_cache = TimeSeriesCache()


class FrameSizeCache(BaseCache):
    """Cache for frame dimensions."""

    def __init__(self, max_len=100):
        super().__init__(max_len)

    def _make_key(self, videoset, camera):
        return (videoset, camera)

    def _compute_value(self, videoset, camera):
        frame = frame_cache.get(videoset, camera, 0)  # get first frame
        height, width = frame.shape[:2]
        return (width, height)


frame_size_cache = FrameSizeCache()


class AnnotationCache(BaseCache):
    """Cache for annotations."""

    def __init__(self, max_len=20):
        super().__init__(max_len)

    def _make_key(self, videoset_name, camera, annotation_suffix):
        return (videoset_name, camera, annotation_suffix)

    def _compute_value(self, videoset_name, camera, annotation_suffix):
        mm = media_manager_cache.get(videoset_name, camera)
        return mm.load_annotations(annotation_suffix)


annotation_cache = AnnotationCache()


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
    options = [x for x in options if 'temp' not in x]
    return jsonify(options)


@app.route("/timeseries_data", methods=["GET"])
def get_timeseries_data():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    timeseries_name = request.args.get("timeseries_name")
    y_column = request.args.get("y_column")
    z_column = request.args.get("z_column")

    df = timeseries_cache.get(videoset_name, camera, timeseries_name)
    if df is None:
        return jsonify({"error": "Timeseries not found"}), 404

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
    if df is None:
        return jsonify({"error": "Timeseries not found"}), 404
    return jsonify(df.columns.tolist())


@app.route("/frame/<videoset_name>/<camera>/<timestamp>", methods=["GET"])
def get_frame(videoset_name, camera, timestamp):
    camera = camera.replace("___", "/")
    frame = frame_cache.get(videoset_name, camera, float(timestamp))
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    jpg_bytes = cv2.imencode(".jpg", frame)[1].tobytes()
    return (jpg_bytes, 200, {"Content-Type": "image/jpeg"})


@app.route("/frame_size", methods=["GET"])
def get_frame_size():
    videoset_name = request.args.get("videoset")
    camera = request.args.get("camera")
    frame_size = frame_size_cache.get(videoset_name, camera)

    return jsonify({"width": frame_size[0], "height": frame_size[1]})


@app.route("/annotations", methods=["GET"])
def get_annotations():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    annotation_suffix = request.args.get("annotation_suffix")
    y_column = request.args.get(
        "y_column", "bbox_y"
    )  # Default to bbox_y if not specified
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
    camera = str(request.args.get("camera"))
    annotation_suffix = request.args.get("annotation_suffix")
    timestamp = request.args.get("timestamp", type=float)
    
    # check if there are tmp annotations
    tmp_filename = f"./data/tmp_annotations/{videoset_name}/{camera.replace('/', '___')}_{annotation_suffix}/{timestamp}.csv"
    if Path(tmp_filename).exists():
        df = pd.read_csv(tmp_filename)
        data = df.to_dict("records")
        return jsonify(data)

    mm = media_manager_cache.get(videoset_name, camera)
    assert mm is not None, f"MediaManager not found for {videoset_name} {camera}"
    df = mm.load_annotations(annotation_suffix)

    # Filter by timestamp
    filtered_df = df[df["timestamp"] == timestamp]

    if filtered_df.empty:
        return jsonify([])

    # Convert to records format similar to timeseries_at_timestamp
    data = filtered_df.to_dict("records")
    return jsonify(data)


@app.route("/save_annotations_at_timestamp", methods=["POST"])
def save_annotations_at_timestamp():
    data = request.get_json()
    videoset_name = data.get("videoset_name")
    camera = data.get("camera")
    annotation_suffix = data.get("annotation_suffix")
    timestamp = float(data.get("timestamp"))
    annotations = data.get("annotations", [])
    filename = f"./data/tmp_annotations/{videoset_name}/{camera.replace('/', '___')}_{annotation_suffix}/{timestamp}.csv"
    Path(filename).parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(annotations)
    df.to_csv(filename, index=False)
    return jsonify({"success": True})


@app.route("/save_annotations", methods=["POST"])
def save_annotations():
    data = request.get_json()
    videoset_name = data.get("videoset_name")
    camera = data.get("camera")
    annotation_suffix = data.get("annotation_suffix")
    # read tmp annotations
    tmp_dir = Path(
        f"./data/tmp_annotations/{videoset_name}/{camera.replace('/', '___')}_{annotation_suffix}"
    )
    all_dfs = []
    for csv_file in tmp_dir.glob("*.csv"):
        df = pd.read_csv(csv_file)
        all_dfs.append(df)
    if all_dfs:
        new_annotations = pd.concat(all_dfs, ignore_index=True)
        old_annotations = annotation_cache.get(videoset_name, camera, annotation_suffix)
        if old_annotations is None:
            print(new_annotations)
        else:
            old_annotations_to_keep = old_annotations[
                ~old_annotations["timestamp"].isin(new_annotations["timestamp"])
            ]
            new_annotations = pd.concat(
                [old_annotations_to_keep, new_annotations], ignore_index=True
            )
            print(new_annotations)
        annotations_path = Path(
            f"./data/annotations/{videoset_name}/{camera.replace('/', '___')}_{annotation_suffix}.csv"
        )
        annotations_path.parent.mkdir(parents=True, exist_ok=True)
        new_annotations.to_csv(annotations_path, index=False)
        # remove tmp annotations
        for csv_file in tmp_dir.glob("*.csv"):
            csv_file.unlink()
        if old_annotations is not None:
            return jsonify(
                {"success": True, "num_kept": 0, "num_created": len(new_annotations)}
            )
        else:
            return jsonify(
                {
                    "success": True,
                    "num_kept": len(old_annotations_to_keep),
                    "num_created": len(new_annotations),
                }
            )
    else:
        return jsonify({"error": "No temporary annotations found"}), 400


@app.route("/timeseries_at_timestamp", methods=["GET"])
def get_timeseries_at_timestamp():
    videoset_name = request.args.get("videoset_name")
    camera = request.args.get("camera")
    timeseries_name = request.args.get("timeseries_name")
    timestamp = request.args.get("timestamp", type=float)
    assert timeseries_name is not None, "timeseries_name is required"
    df = timeseries_cache.get(videoset_name, camera, timeseries_name)
    assert df is not None, f"{timeseries_name} not found for {videoset_name} {camera}"
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
    camera = camera.replace("___", "/")
    mm = media_manager_cache.get(videoset, camera)
    options = get_annotation_options(mm)
    options = [x.stem for x in options if "tmp" not in str(x) and "old" not in str(x)]
    parsed_options = []
    for option in options:
        if len(option.split("_")) > 2:
            suffix = option.split("_")[1]
        else:
            suffix = None
        parsed_options.append(suffix)

    # print(f"Annotation options for {videoset} {camera}: {options}")
    return jsonify(parsed_options)


if __name__ == "__main__":
    app.run(debug=True)
