const API_BASE_URL = 'http://localhost:5000';

export interface ApiData {
  X: number[];
  Y: number[];
  Z: number[];
}

export interface VideosetResponse {
  videosets: Record<string, string[]>;
}

export interface TimestampsResponse {
  timestamps: number[];
}

export interface TimeseriesOptionsResponse {
  options: string[];
}

export interface ColumnsResponse {
  columns: string[];
}

export interface DetectionsResponse {
  detections: Record<string, unknown> | Record<string, unknown>[];
}

export interface AnnotationsResponse {
  X: number[];
  Y: number[];
  Z: number[];
}

export interface SetVideosetResponse {
  message: string;
  videoset: string;
  camera: string;
  n_timestamps: number;
}

export interface SetTimeseriesResponse {
  message: string;
  option: string;
  n_rows: number;
}

export interface SetColumnsResponse {
  message: string;
  y: string | null;
  z: string | null;
}

export interface LoadAnnotationsResponse {
  message: string;
  n_rows: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { error: errorMessage };
    }
  }

  // Health check
  async health(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>('/health');
  }

  // Videosets
  async getVideosets(): Promise<ApiResponse<VideosetResponse>> {
    return this.request<VideosetResponse>('/videosets');
  }

  async setVideoset(videoset: string, camera: string): Promise<ApiResponse<SetVideosetResponse>> {
    return this.request<SetVideosetResponse>('/set_videoset', {
      method: 'POST',
      body: JSON.stringify({ videoset, camera }),
    });
  }

  // Timestamps
  async getTimestamps(): Promise<ApiResponse<TimestampsResponse>> {
    return this.request<TimestampsResponse>('/timestamps');
  }

  // Timeseries
  async getTimeseriesOptions(): Promise<ApiResponse<TimeseriesOptionsResponse>> {
    return this.request<TimeseriesOptionsResponse>('/timeseries_options');
  }

  async setTimeseries(option: string): Promise<ApiResponse<SetTimeseriesResponse>> {
    return this.request<SetTimeseriesResponse>('/set_timeseries', {
      method: 'POST',
      body: JSON.stringify({ option }),
    });
  }

  async getTimeseries(): Promise<ApiResponse<ApiData>> {
    return this.request<ApiData>('/timeseries');
  }

  // Columns
  async getColumns(): Promise<ApiResponse<ColumnsResponse>> {
    return this.request<ColumnsResponse>('/columns');
  }

  async setColumns(y?: string, z?: string): Promise<ApiResponse<SetColumnsResponse>> {
    return this.request<SetColumnsResponse>('/set_columns', {
      method: 'POST',
      body: JSON.stringify({ y, z }),
    });
  }

  // Frame
  async getFrame(timestamp: number): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(`${this.baseUrl}/frame?timestamp=${timestamp}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      return { data: blob };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return { error: errorMessage };
    }
  }

  // Detections
  async getDetections(timestamp: number): Promise<ApiResponse<DetectionsResponse>> {
    return this.request<DetectionsResponse>(`/detections?timestamp=${timestamp}`);
  }

  // Annotations
  async loadAnnotations(suffix?: string): Promise<ApiResponse<LoadAnnotationsResponse>> {
    return this.request<LoadAnnotationsResponse>('/annotations/load', {
      method: 'POST',
      body: JSON.stringify({ suffix }),
    });
  }

  async getAnnotations(): Promise<ApiResponse<AnnotationsResponse>> {
    return this.request<AnnotationsResponse>('/annotations');
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export individual functions for convenience (properly bound)
export const health = () => apiClient.health();
export const getVideosets = () => apiClient.getVideosets();
export const setVideoset = (videoset: string, camera: string) => apiClient.setVideoset(videoset, camera);
export const getTimestamps = () => apiClient.getTimestamps();
export const getTimeseriesOptions = () => apiClient.getTimeseriesOptions();
export const setTimeseries = (option: string) => apiClient.setTimeseries(option);
export const getTimeseries = () => apiClient.getTimeseries();
export const getColumns = () => apiClient.getColumns();
export const setColumns = (y?: string, z?: string) => apiClient.setColumns(y, z);
export const getFrame = (timestamp: number) => apiClient.getFrame(timestamp);
export const getDetections = (timestamp: number) => apiClient.getDetections(timestamp);
export const loadAnnotations = (suffix?: string) => apiClient.loadAnnotations(suffix);
export const getAnnotations = () => apiClient.getAnnotations();
