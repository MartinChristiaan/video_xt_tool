import io
import traceback
from threading import Lock

import numpy as np
import pandas as pd
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from PIL import Image

# Import your vset utilities (from your CodeContext)
from vset_utils.vset_select import (
    get_mediamanager,
    get_timeseries_options,
    get_videosets,
)

app = Flask(__name__)

CORS(app)  # Enable CORS for all routes

class VideoXTManager:
    """
    Holds the current mediamanager, currently loaded timeseries dataframe, selected columns, and annotations.
    Thread-safe where needed.
    """

    def __init__(self):
        self._lock = Lock()
        self.videoset_name = 'leusderheide_20230705'
        self.camera = "visual_halfres/CPFS7_0310"
        self.mm = get_mediamanager('leusderheide_20230705',"visual_halfres/CPFS7_0305")

        # currently loaded timeseries (pandas.DataFrame) - must contain a 'timestamp' column (unix ts)
        self.current_df = self.mm.load("detections/yolov8x_mscoco.csv",False)
        self.current_timeseries_option = "detections/yolov8x_mscoco.csv"

        # column names selected for y and z
        self.y_col = 'bbox_x'
        self.z_col = "confidence"

        # annotations (pandas.DataFrame expected) - optional
        self.annotations_df = self.mm.load_annotations("smallObjectsCorrected")

    # Videoset / camera
    def set_videoset_camera(self, videoset_name: str, camera: str):
        with self._lock:
            self.mm = get_mediamanager(videoset_name, camera)
            self.videoset_name = videoset_name
            self.camera = camera

            # Reset timeseries & selections
            self.current_df = None
            self.current_timeseries_option = None
            self.y_col = None
            self.z_col = None
            self.annotations_df = None

    def get_timestamps(self):
        """Return timestamps list from mm.timestamps; assume mm.timestamps is an array-like of unix timestamps."""
        if self.mm is None:
            raise RuntimeError("No mediamanager set")
        # mm.timestamps may be list-like or numpy
        return list(self.mm.timestamps)

    # Timeseries options
    def list_timeseries_options(self):
        if self.mm is None:
            raise RuntimeError("No mediamanager set")
        return get_timeseries_options(self.mm)

    def load_timeseries_option(self, option):
        """Load timeseries from mm.load(option) and store dataframe. Returns number of rows loaded."""
        if self.mm is None:
            raise RuntimeError("No mediamanager set")
        df = self.mm.load(option)
        if not isinstance(df, pd.DataFrame):
            # If mm.load returns something else, try to coerce
            df = pd.DataFrame(df)
        if "timestamp" not in df.columns:
            raise ValueError("Loaded timeseries does not contain 'timestamp' column")
        # Ensure timestamp is numeric (unix)
        df = df.copy()
        df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"]).reset_index(drop=True)

        with self._lock:
            self.current_df = df
            self.current_timeseries_option = option
            # reset selected cols if they no longer exist
            if self.y_col not in df.columns:
                self.y_col = None
            if self.z_col not in df.columns:
                self.z_col = None

        return len(df)

    def get_columns(self):
        if self.current_df is None:
            return []
        return list(self.current_df.columns)

    def set_yz_columns(self, y_col: str = None, z_col: str = None):
        if self.current_df is None:
            raise RuntimeError("No timeseries loaded")
        cols = set(self.current_df.columns)
        if y_col is not None and y_col not in cols:
            raise ValueError(f"y_col '{y_col}' not in dataframe columns")
        if z_col is not None and z_col not in cols:
            raise ValueError(f"z_col '{z_col}' not in dataframe columns")
        with self._lock:
            self.y_col = y_col
            self.z_col = z_col

    def get_timeseries_xyz(self):
        """
        Return dict with keys 'X', 'Y', 'Z' where values are lists (JSON-serializable).
        Efficient conversion using numpy arrays -> lists.
        If column not set, the corresponding array is empty list.
        """
        if self.current_df is None:
            raise RuntimeError("No timeseries loaded")
        df = self.current_df
        # X: timestamp array
        x_vals = df["timestamp"].values
        # Y
        y_vals = np.array([]) if (self.y_col is None) else df[self.y_col].values
        # Z
        z_vals = np.array([]) if (self.z_col is None) else df[self.z_col].values

        # Convert numeric types to native Python types for JSON via .tolist()
        # Using .tolist() is efficient for large arrays (100k+).
        return {"X": x_vals.tolist(), "Y": y_vals.tolist(), "Z": z_vals.tolist()}

    # Annotations
    def load_annotations(self, annotation_suffix=None):
        """Load annotations via mm.load_annotations(suffix). Store as dataframe."""
        if self.mm is None:
            raise RuntimeError("No mediamanager set")
        df = self.mm.load_annotations(annotation_suffix)
        if df is None:
            return len(0)
        if "timestamp" not in df.columns:
            raise ValueError("Annotations must contain 'timestamp' column")
        df = df.copy()
        df["timestamp"] = pd.to_numeric(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"]).reset_index(drop=True)
        with self._lock:
            self.annotations_df = df
        return len(df)

    def get_annotations_xyz(self):
        """Return annotations in X/Y/Z format. For columns X -> timestamp, Y -> chosen y_col (or 'y'), Z -> 'z' if present."""
        if self.annotations_df is None:
            return {"X": [], "Y": [], "Z": []}
        df = self.annotations_df
        # Try to find columns for coordinates; common names: 'x','y','z' or using current y_col/z_col mapping if consistent
        x_vals = df["timestamp"].values
        # For annotations, prefer explicit columns 'y' and 'z' if present, else attempt to use current selections
        if "y" in df.columns:
            y_vals = df["y"].values
        elif self.y_col and self.y_col in df.columns:
            y_vals = df[self.y_col].values
        else:
            # no annotations y column -> empty
            y_vals = np.array([])

        if "z" in df.columns:
            z_vals = df["z"].values
        elif self.z_col and self.z_col in df.columns:
            z_vals = df[self.z_col].values
        else:
            z_vals = np.array([])

        return {"X": x_vals.tolist(), "Y": y_vals.tolist(), "Z": z_vals.tolist()}

    # Detections at timestamp
    def get_detections_at(self, timestamp):
        """
        Return detections (as dict or list of dict) for the row(s) nearest to the given timestamp.
        If exact matches exist (timestamp equality), return all matching rows.
        Otherwise return the single nearest row (all properties).
        """
        if self.current_df is None:
            raise RuntimeError("No timeseries loaded")

        ts = float(timestamp)
        df = self.current_df

        # Try to find exact matches
        matches = df[df["timestamp"] == ts]
        if len(matches) > 0:
            return matches.to_dict(orient="records")

        # Otherwise find nearest index
        idx = (np.abs(df["timestamp"].values - ts)).argmin()
        row = df.iloc[idx]
        return row.to_dict()

    # Frame retrieval
    def get_frame_at_timestamp(self, timestamp):
        """
        Return (frame (numpy array or PIL Image), actual_timestamp).
        Prefer using mm.get_frame_nearest(timestamp). If mediamanager expects an index, try mapping.
        """
        if self.mm is None:
            raise RuntimeError("No mediamanager set")
        ts = float(timestamp)

        # Try direct call
        try:
            # Many implementations accept a timestamp or index; try timestamp first
            frame, actual_ts = self.mm.get_frame_nearest(ts)
            return frame, actual_ts
        except Exception:
            # If mm.get_frame_nearest expects index or call signature differs:
            try:
                # find nearest index based on mm.timestamps
                timestamps = np.array(self.mm.timestamps)
                idx = int(np.abs(timestamps - ts).argmin())
                # Try mm.get_frame(idx) or mm.get_frame_nearest(idx)
                try:
                    frame, actual_ts = self.mm.get_frame(idx)
                except Exception:
                    frame, actual_ts = self.mm.get_frame_nearest(idx)
                return frame, actual_ts
            except Exception as e:
                raise RuntimeError(
                    f"Unable to retrieve frame for timestamp {timestamp}: {e}"
                )


# Global manager instance
video_xt = VideoXTManager()


# Utility: return error JSON
def error_response(message, status=400):
    return jsonify({"error": message}), status


# -----------------------
# Routes
# -----------------------


@app.route("/videosets", methods=["GET"])
def route_videosets():
    """Return available videosets and their cameras."""
    try:
        vs = get_videosets()
        names = list(vs.names)
        # produce mapping name -> cameras list
        mapping = {name: list(vs[name].cameras) for name in names}
        return jsonify({"videosets": mapping})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/set_videoset", methods=["POST"])
def route_set_videoset():
    """
    Set the current videoset and camera.
    JSON body: { "videoset": "<name>", "camera": "<cam_name>" }
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return error_response("Expected JSON body", 400)
    videoset = data.get("videoset")
    camera = data.get("camera")
    if not videoset or not camera:
        return error_response("Missing 'videoset' or 'camera' in request", 400)
    try:
        video_xt.set_videoset_camera(videoset, camera)
        # return timestamps count maybe
        timestamps = video_xt.get_timestamps()
        return jsonify(
            {
                "message": "videoset set",
                "videoset": videoset,
                "camera": camera,
                "n_timestamps": len(timestamps),
            }
        )
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/timestamps", methods=["GET"])
def route_timestamps():
    """Return all timestamps for the current mediamanager."""
    try:
        ts = video_xt.get_timestamps()
        return jsonify({"timestamps": ts})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/timeseries_options", methods=["GET"])
def route_timeseries_options():
    """Return options from get_timeseries_options(mm)"""
    try:
        opts = video_xt.list_timeseries_options()
        # options may be objects; attempt to jsonify names or repr
        try:
            return jsonify({"options": [str(o) for o in opts]})
        except Exception:
            return jsonify({"options": opts})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/set_timeseries", methods=["POST"])
def route_set_timeseries():
    """
    POST JSON { "option": "<option_identifier>" }
    Loads that timeseries into the server (video_xt.current_df).
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return error_response("Expected JSON body", 400)
    option = data.get("option")
    if option is None:
        return error_response("Missing 'option' in request", 400)
    try:
        n = video_xt.load_timeseries_option(option)
        return jsonify({"message": "timeseries loaded", "option": option, "n_rows": n})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/columns", methods=["GET"])
def route_columns():
    """Return columns of current dataframe (timeseries)."""
    try:
        cols = video_xt.get_columns()
        return jsonify({"columns": cols})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/set_columns", methods=["POST"])
def route_set_columns():
    """
    Set which columns map to y and z.
    JSON: { "y": "<colname_or_null>", "z": "<colname_or_null>" }
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return error_response("Expected JSON body", 400)
    y = data.get("y")
    z = data.get("z")
    try:
        video_xt.set_yz_columns(y_col=y, z_col=z)
        return jsonify({"message": "columns set", "y": y, "z": z})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/timeseries", methods=["GET"])
def route_timeseries():
    """
    Return timeseries in format:
      { "X": [...timestamps...], "Y": [...], "Z": [...] }
    This endpoint is read-only.
    """
    try:

        ts = video_xt.get_timeseries_xyz()
        # Use jsonify for safe JSON conversion
        return jsonify(ts)
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/frame", methods=["GET"])
def route_frame():
    """
    Return a JPEG image for a frame nearest to the given timestamp.
    Query param: ?timestamp=<unix_timestamp>
    """
    ts_param = request.args.get("timestamp", None)
    if ts_param is None:
        return error_response("Missing 'timestamp' query parameter", 400)
    try:
        frame, actual_ts = video_xt.get_frame_at_timestamp(float(ts_param))
        # frame is expected as numpy array (H,W,3) or a PIL Image
        if isinstance(frame, Image.Image):
            img = frame
        else:
            # assume numpy array
            img = Image.fromarray(frame)

        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        return send_file(
            buf,
            mimetype="image/jpeg",
            as_attachment=False,
            download_name=f"frame_{int(actual_ts)}.jpg",
        )
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/annotations/load", methods=["POST"])
def route_load_annotations():
    """
    Load annotations from mediamanager.
    JSON: { "suffix": "<optional_suffix_or_null>" }
    """
    data = request.get_json(force=True, silent=True) or {}
    suffix = data.get("suffix", None)
    try:
        n = video_xt.load_annotations(suffix)
        return jsonify({"message": "annotations loaded", "n_rows": n})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/annotations", methods=["GET"])
def route_annotations():
    """Return annotations in X/Y/Z format similar to timeseries."""
    try:
        ann = video_xt.get_annotations_xyz()
        return jsonify(ann)
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


@app.route("/detections", methods=["GET"])
def route_detections():
    """
    Return detection(s) at given timestamp.
    Query param: ?timestamp=<unix_timestamp>
    Returns full dict of properties for matching detection(s).
    """
    ts_param = request.args.get("timestamp", None)
    if ts_param is None:
        return error_response("Missing 'timestamp' query parameter", 400)
    try:
        res = video_xt.get_detections_at(float(ts_param))
        return jsonify({"detections": res})
    except Exception as e:
        traceback.print_exc()
        return error_response(str(e), 500)


# Basic health
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# Run app
if __name__ == "__main__":
    # For production use, run with gunicorn/uwsgi; this is for development/demo only.
    app.run(host="0.0.0.0", port=5000, debug=True)
