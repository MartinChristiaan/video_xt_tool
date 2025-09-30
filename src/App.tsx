import React, { useState, useEffect } from 'react';
import TimeseriesPlot from './timeseries_plot';
import { getTimeseries } from './api';

export default function App() {
  const [data, setData] = useState<{ x: number[], y: number[], z: number[] }>({ x: [], y: [], z: [] });
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeseriesData = async () => {
    setLoading(true);
    setError(null);

    const result = await getTimeseries();

    if (result.error) {
      setError(result.error);
      console.error('Error loading timeseries data:', result.error);
    } else if (result.data) {
      // Convert API format (X, Y, Z) to component format (x, y, z)
      setData({
        x: result.data.X,
        y: result.data.Y,
        z: result.data.Z
      });
    }

    setLoading(false);
  };

  const handleLoadData = () => {
    loadTimeseriesData();
  };

  // Load data on component mount
  useEffect(() => {
    loadTimeseriesData();
  }, []);

  return (
    <div className="App">
      <div style={{ padding: '20px' }}>
        <button onClick={handleLoadData} disabled={loading}>
          {loading ? 'Loading...' : 'Reload Timeseries Data'}
        </button>
        {error && (
          <div style={{ color: 'red', marginTop: '10px' }}>
            Error: {error}
          </div>
        )}
        {data.x.length === 0 && !loading && !error && (
          <div style={{ marginTop: '10px' }}>
            No timeseries data available. Make sure the backend is running and a videoset/timeseries is loaded.
          </div>
        )}
        {selectedTimestamp && (
          <div style={{ marginTop: '10px' }}>
            Selected timestamp: {selectedTimestamp}
          </div>
        )}
      </div>
      {data.x.length > 0 && (
        <TimeseriesPlot data={data} setSelectedTimestamp={setSelectedTimestamp}/>
      )}
    </div>
  );
}
