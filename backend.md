# Backend API Reference

This document provides a reference for the API endpoints implemented in `backend.py`.

## General

The backend is a Flask application that provides data for the video analysis tool.

## Endpoints

### `GET /videosets`

*   **Description:** Get available videosets and their cameras.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "videosets": {
        "<videoset_name>": ["<camera_name_1>", "<camera_name_2>"]
      }
    }
    ```

### `POST /set_videoset`

*   **Description:** Set the current videoset and camera.
*   **Method:** `POST`
*   **Body:**
    ```json
    {
      "videoset": "<videoset_name>",
      "camera": "<camera_name>"
    }
    ```
*   **Response:**
    ```json
    {
      "message": "videoset set",
      "videoset": "<videoset_name>",
      "camera": "<camera_name>",
      "n_timestamps": 12345
    }
    ```

### `GET /timestamps`

*   **Description:** Get all timestamps for the current mediamanager.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "timestamps": [1672531200.0, 1672531201.0, ...]
    }
    ```

### `GET /timeseries_options`

*   **Description:** Get available timeseries options for the current videoset.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "options": ["option1", "option2", ...]
    }
    ```

### `POST /set_timeseries`

*   **Description:** Load a specific timeseries into the server.
*   **Method:** `POST`
*   **Body:**
    ```json
    {
      "option": "<option_identifier>"
    }
    ```
*   **Response:**
    ```json
    {
      "message": "timeseries loaded",
      "option": "<option_identifier>",
      "n_rows": 54321
    }
    ```

### `GET /columns`

*   **Description:** Get the columns of the current timeseries dataframe.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "columns": ["timestamp", "col1", "col2", ...]
    }
    ```

### `POST /set_columns`

*   **Description:** Set which columns map to the Y and Z axes.
*   **Method:** `POST`
*   **Body:**
    ```json
    {
      "y": "<colname_or_null>",
      "z": "<colname_or_null>"
    }
    ```
*   **Response:**
    ```json
    {
      "message": "columns set",
      "y": "<colname_or_null>",
      "z": "<colname_or_null>"
    }
    ```

### `GET /timeseries`

*   **Description:** Get the timeseries data in X, Y, Z format.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "X": [...timestamps...],
      "Y": [...y_values...],
      "Z": [...z_values...]
    }
    ```

### `GET /frame`

*   **Description:** Get a JPEG image for a frame nearest to the given timestamp.
*   **Method:** `GET`
*   **Query Parameters:**
    *   `timestamp`: The unix timestamp for the desired frame.
*   **Response:** An image in `image/jpeg` format.

### `POST /annotations/load`

*   **Description:** Load annotations from the mediamanager.
*   **Method:** `POST`
*   **Body:**
    ```json
    {
      "suffix": "<optional_suffix_or_null>"
    }
    ```
*   **Response:**
    ```json
    {
      "message": "annotations loaded",
      "n_rows": 123
    }
    ```

### `GET /annotations`

*   **Description:** Get annotations in X/Y/Z format.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "X": [...timestamps...],
      "Y": [...y_values...],
      "Z": [...z_values...]
    }
    ```

### `GET /detections`

*   **Description:** Get detection(s) at a given timestamp.
*   - **Method:** `GET`
*   **Query Parameters:**
    *   `timestamp`: The unix timestamp for the desired detection.
*   **Response:**
    ```json
    {
      "detections": [
        {
          "timestamp": 1672531200.0,
          "col1": "value1",
          "col2": "value2"
        }
      ]
    }
    ```

### `GET /health`

*   **Description:** Health check endpoint.
*   **Method:** `GET`
*   **Response:**
    ```json
    {
      "status": "ok"
    }
    ```
