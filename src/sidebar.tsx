import React, { useState, useEffect, useCallback } from 'react';
import { getColumnOptions, type Sequence } from './api';

interface SidebarProps {
  videoset: string;
  camera: string;
  timeseriesName: string;
  yColumn?: string;
  zColumn?: string;
  onYColumnChange: (column: string | undefined) => void;
  onZColumnChange: (column: string | undefined) => void;
  // Subset-related props
  subsetName: string;
  availableSubsets: string[];
  onSubsetChange: (subsetName: string) => void;
  subsetIndex: number;
  subsetCount: number;
  onSubsetIndexChange: (index: number) => void;
  currentSequence: Sequence;
}

const Sidebar: React.FC<SidebarProps> = ({
  videoset,
  camera,
  timeseriesName,
  yColumn,
  zColumn,
  onYColumnChange,
  onZColumnChange,
  subsetName,
  availableSubsets,
  onSubsetChange,
  subsetIndex,
  subsetCount,
  onSubsetIndexChange,
  currentSequence
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
      {/* Subset Selection */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '16px' }}>Subset Selection</h3>

        <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#fff'
          }}>
            Current Subset:
          </label>
          <select
            value={subsetName}
            onChange={(e) => onSubsetChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px'
            }}
          >
            {availableSubsets.map((subset) => (
              <option key={subset} value={subset}>
                {subset}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#fff'
          }}>
            Sequence ({subsetIndex + 1} of {subsetCount}):
          </label>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button
              onClick={() => onSubsetIndexChange(subsetIndex - 1)}
              disabled={subsetIndex <= 0}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: subsetIndex <= 0 ? '#f5f5f5' : '#fff',
                cursor: subsetIndex <= 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              ←
            </button>
            <input
              type="number"
              min="1"
              max={subsetCount}
              value={subsetIndex + 1}
              onChange={(e) => {
                const newIndex = parseInt(e.target.value) - 1;
                if (!isNaN(newIndex)) {
                  onSubsetIndexChange(newIndex);
                }
              }}
              style={{
                width: '60px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                textAlign: 'center',
                fontSize: '12px'
              }}
            />
            <button
              onClick={() => onSubsetIndexChange(subsetIndex + 1)}
              disabled={subsetIndex >= subsetCount - 1}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                background: subsetIndex >= subsetCount - 1 ? '#f5f5f5' : '#fff',
                cursor: subsetIndex >= subsetCount - 1 ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              →
            </button>
          </div>
        </div>

        <div style={{
          padding: '10px',
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          border: '1px solid #333'
        }}>
          <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
            <p style={{ margin: '2px 0' }}>
              <strong style={{ color: '#fff' }}>Videoset:</strong> {currentSequence.videoset}
            </p>
            <p style={{ margin: '2px 0' }}>
              <strong style={{ color: '#fff' }}>Camera:</strong> {currentSequence.camera}
            </p>
            <p style={{ margin: '2px 0' }}>
              <strong style={{ color: '#fff' }}>Annotation:</strong> {currentSequence.annotation_suffix}
            </p>
          </div>
        </div>
      </div>

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
