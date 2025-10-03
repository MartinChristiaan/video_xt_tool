const API_BASE_URL = 'http://localhost:5000';

export interface TimeseriesData {
  x: number[];
  y?: number[];
  z?: number[];
}

export interface VideosetResponse {
  [name: string]: {
    cameras: string[];
  };
}

export interface AnnotationsResponse {
  x: number[];
  y: number[];
  z: number[];
}

export interface FrameSizeResponse {
  height: number;
  width: number;
}

export interface SubsetData {
  [key: string]: unknown;
}

export interface SaveSubsetRequest {
  name: string;
  data: SubsetData[];
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

  // Videosets
  async getVideosets(): Promise<ApiResponse<VideosetResponse>> {
    return this.request<VideosetResponse>('/videosets');
  }

  // Timestamps
  async getTimestamps(videosetName: string, camera: string): Promise<ApiResponse<number[]>> {
    const params = new URLSearchParams({
      videoset_name: videosetName,
      camera
    });
    return this.request<number[]>(`/timestamps?${params}`);
  }

  // Timeseries options
  async getTimeseriesOptions(videosetName: string, camera: string): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams({
      videoset_name: videosetName,
      camera
    });
    return this.request<string[]>(`/timeseries_options?${params}`);
  }

  // Timeseries data
  async getTimeseriesData(
    videosetName: string,
    camera: string,
    timeseriesName: string,
    yColumn?: string,
    zColumn?: string
  ): Promise<ApiResponse<TimeseriesData>> {
    const params = new URLSearchParams({
      videoset_name: videosetName,
      camera,
      timeseries_name: timeseriesName
    });
    if (yColumn) params.append('y_column', yColumn);
    if (zColumn) params.append('z_column', zColumn);
    return this.request<TimeseriesData>(`/timeseries_data?${params}`);
  }

  // Column options
  async getColumnOptions(videosetName: string, camera: string, timeseriesName: string): Promise<ApiResponse<string[]>> {
    const params = new URLSearchParams({
      videoset_name: videosetName,
      camera,
      timeseries_name: timeseriesName
    });
    return this.request<string[]>(`/column_options?${params}`);
  }

  // Frame
  getFrameUrl(videosetName: string, camera: string, timestamp: number): string {
    const cameraEncoded = camera.replace(/\//g, '___');
    return `${this.baseUrl}/frame/${videosetName}/${cameraEncoded}/${timestamp}`;
  }

  async getFrameSize(videoset: string, camera: string, timestamp: number): Promise<ApiResponse<FrameSizeResponse>> {
    const params = new URLSearchParams({
      videoset,
      camera,
      timestamp: timestamp.toString()
    });
    return this.request<FrameSizeResponse>(`/frame_size?${params}`);
  }

  // Annotations
  async getAnnotations(videosetName: string, camera: string, annotationSuffix: string): Promise<ApiResponse<AnnotationsResponse>> {
    const params = new URLSearchParams({
      videoset_name: videosetName,
      camera,
      annotation_suffix: annotationSuffix
    });
    return this.request<AnnotationsResponse>(`/annotations?${params}`);
  }

  // Timeseries at timestamp
  async getTimeseriesAtTimestamp(
    videosetName: string,
    camera: string,
    timeseriesName: string,
    timestamp: number
  ): Promise<ApiResponse<Record<string, unknown>[]>> {
    const params = new URLSearchParams({
      videoset_name: videosetName,
      camera,
      timeseries_name: timeseriesName,
      timestamp: timestamp.toString()
    });
    return this.request<Record<string, unknown>[]>(`/timeseries_at_timestamp?${params}`);
  }

  // Subsets
  async getSubsets(): Promise<ApiResponse<string[]>> {
    return this.request<string[]>('/subsets');
  }

  async getSubset(name: string): Promise<ApiResponse<SubsetData[]>> {
    return this.request<SubsetData[]>(`/subset/${name}`);
  }

  async saveSubset(name: string, data: SubsetData[]): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>('/subset', {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export individual functions for convenience (properly bound)
export const getVideosets = () => apiClient.getVideosets();
export const getTimestamps = (videosetName: string, camera: string) => apiClient.getTimestamps(videosetName, camera);
export const getTimeseriesOptions = (videosetName: string, camera: string) => apiClient.getTimeseriesOptions(videosetName, camera);
export const getTimeseriesData = (videosetName: string, camera: string, timeseriesName: string, yColumn?: string, zColumn?: string) =>
  apiClient.getTimeseriesData(videosetName, camera, timeseriesName, yColumn, zColumn);
export const getColumnOptions = (videosetName: string, camera: string, timeseriesName: string) =>
  apiClient.getColumnOptions(videosetName, camera, timeseriesName);
export const getFrameUrl = (videosetName: string, camera: string, timestamp: number) =>
  apiClient.getFrameUrl(videosetName, camera, timestamp);
export const fetchFrameSize = (videoset: string, camera: string, timestamp: number) =>
  apiClient.getFrameSize(videoset, camera, timestamp);
export const getAnnotations = (videosetName: string, camera: string, annotationSuffix: string) =>
  apiClient.getAnnotations(videosetName, camera, annotationSuffix);
export const getTimeseriesAtTimestamp = (videosetName: string, camera: string, timeseriesName: string, timestamp: number) =>
  apiClient.getTimeseriesAtTimestamp(videosetName, camera, timeseriesName, timestamp);
export const getSubsets = () => apiClient.getSubsets();
export const getSubset = (name: string) => apiClient.getSubset(name);
export const saveSubset = (name: string, data: SubsetData[]) => apiClient.saveSubset(name, data);
