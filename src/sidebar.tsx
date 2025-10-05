import React, { useState, useEffect, useCallback } from 'react';
import { getColumnOptions } from './api';

interface SidebarProps {
  videoset: string;
  camera: string;
  timeseriesName: string;
  yColumn?: string;
  zColumn?: string;
  onYColumnChange: (column: string | undefined) => void;
  onZColumnChange: (column: string | undefined) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  videoset,
  camera,
  timeseriesName,
  yColumn,
  zColumn,
  onYColumnChange,
  onZColumnChange
}) => {
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadColumns = useCallback(async () => {
    if (!videoset || !camera || !timeseriesName) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getColumnOptions(videoset, camera, timeseriesName);

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.data) {
        setColumns(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch column options');
    } finally {
      setLoading(false);
    }
  }, [videoset, camera, timeseriesName]);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  return (
    <div style={{
      width: '250px',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.7)',
      borderRight: '1px solid #ddd',
      padding: '20px',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '16px' }}>Plot Configuration</h3>

      {loading && <div style={{ fontSize: '14px', color: '#666' }}>Loading columns...</div>}
      {error && <div style={{ fontSize: '14px', color: 'red' }}>Error: {error}</div>}

      {!loading && !error && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Y-Axis Column:
            </label>
            <select
              value={yColumn || ''}
              onChange={(e) => onYColumnChange(e.target.value || undefined)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            >
              <option value="">-- Select Column --</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Z-Axis Column (Color):
            </label>
            <select
              value={zColumn || ''}
              onChange={(e) => onZColumnChange(e.target.value || undefined)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px'
              }}
            >
              <option value="">-- Select Column --</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div style={{
            marginTop: '30px',
            padding: '15px',
            backgroundColor: '#000000ff',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>Dataset Info</h4>
            <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>
              <p style={{ margin: '5px 0' }}><strong>Dataset:</strong> {videoset}</p>
              <p style={{ margin: '5px 0' }}><strong>Camera:</strong> {camera}</p>
              <p style={{ margin: '5px 0' }}><strong>Timeseries:</strong> {timeseriesName}</p>
              <p style={{ margin: '10px 0 5px 0', fontSize: '11px', color: '#888' }}>
                Available columns: {columns.length}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;
