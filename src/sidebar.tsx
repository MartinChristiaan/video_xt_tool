import React, { useState, useEffect, useCallback } from 'react';
import { getColumnOptions, type Sequence } from './api';
import './sidebar.css';

interface SidebarProps {
  videoset: string;
  camera: string;
  timeseriesName: string;
  availableTimeseries: string[];
  onTimeseriesChange: (timeseriesName: string) => void;
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
  allSequences: Sequence[];
}

const Sidebar: React.FC<SidebarProps> = ({
  videoset,
  camera,
  timeseriesName,
  availableTimeseries,
  onTimeseriesChange,
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
  currentSequence,
  allSequences
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

  // Add keyboard shortcuts for sequence navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (event.shiftKey) {
          // Shift+S: Previous sequence
          if (subsetIndex > 0) {
            onSubsetIndexChange(subsetIndex - 1);
          }
        } else {
          // S: Next sequence
          if (subsetIndex < subsetCount - 1) {
            onSubsetIndexChange(subsetIndex + 1);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [subsetIndex, subsetCount, onSubsetIndexChange]);

  return (
    <div className="sidebar">
      {/* Subset Selection */}
      <div className="subset-section">
        <h3>Subset Selection</h3>

        <div className="form-group">
          <label className="form-label">
            Current Subset:
          </label>
          <select
            value={subsetName}
            onChange={(e) => onSubsetChange(e.target.value)}
            className="form-select"
          >
            {availableSubsets.map((subset) => (
              <option key={subset} value={subset}>
                {subset}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            Sequence ({subsetIndex + 1} of {subsetCount}):
          </label>
          <div className="nav-controls">
            <button
              onClick={() => onSubsetIndexChange(subsetIndex - 1)}
              disabled={subsetIndex <= 0}
              className="nav-button"
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
              className="nav-input"
            />
            <button
              onClick={() => onSubsetIndexChange(subsetIndex + 1)}
              disabled={subsetIndex >= subsetCount - 1}
              className="nav-button"
            >
              →
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Select Sequence:
          </label>
          <select
            value={subsetIndex}
            onChange={(e) => onSubsetIndexChange(parseInt(e.target.value))}
            className="form-select"
          >
            {allSequences.map((sequence, index) => (
              <option key={index} value={index}>
                {`${index + 1}: ${sequence.videoset}/${sequence.camera}`}
              </option>
            ))}
          </select>
          <div className="info-item" style={{ marginTop: '8px', fontSize: '11px', opacity: '0.7' }}>
            Keyboard shortcuts: S (next) | Shift+S (previous)
          </div>
        </div>

        <div className="info-card">
          <div className="info-item">
            <span className="info-label">Videoset:</span> <span className="info-value">{currentSequence.videoset}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Camera:</span> <span className="info-value">{currentSequence.camera}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Annotation:</span> <span className="info-value">{currentSequence.annotation_suffix}</span>
          </div>
        </div>
      </div>

      <h3>Timeseries Selection</h3>

      <div className="form-group">
        <label className="form-label">
          Timeseries Dataset:
        </label>
        <select
          value={timeseriesName}
          onChange={(e) => onTimeseriesChange(e.target.value)}
          className="form-select"
        >
          {availableTimeseries.length === 0 ? (
            <option value="">Loading...</option>
          ) : (
            availableTimeseries.map((timeseries) => (
              <option key={timeseries} value={timeseries}>
                {timeseries}
              </option>
            ))
          )}
        </select>
      </div>

      <h3>Plot Configuration</h3>

      {loading && <div className="loading-text">Loading columns...</div>}
      {error && <div className="error-text">Error: {error}</div>}

      {!loading && !error && (
        <>
          <div className="form-group">
            <label className="form-label">
              Y-Axis Column:
            </label>
            <select
              value={yColumn || ''}
              onChange={(e) => onYColumnChange(e.target.value || undefined)}
              className="form-select"
            >
              <option value="">-- Select Column --</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Z-Axis Column (Color):
            </label>
            <select
              value={zColumn || ''}
              onChange={(e) => onZColumnChange(e.target.value || undefined)}
              className="form-select"
            >
              <option value="">-- Select Column --</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div className="info-card" style={{ marginTop: '24px' }}>
            <div className="info-item">
              <span className="info-label">Dataset:</span> <span className="info-value">{videoset}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Camera:</span> <span className="info-value">{camera}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Timeseries:</span> <span className="info-value">{timeseriesName}</span>
            </div>
            <div className="info-item" style={{ marginTop: '8px', fontSize: '11px', opacity: '0.8' }}>
              Available columns: {columns.length}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;
