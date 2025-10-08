import React, { useState, useEffect, useCallback } from 'react';
import { getColumnOptions, saveAnnotations, type Sequence } from './api';
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
  // Annotation-related props
  showAnnotations: boolean;
  onShowAnnotationsChange: (show: boolean) => void;
  autosaveAnnotations: boolean;
  onAutosaveAnnotationsChange: (autosave: boolean) => void;
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
  allSequences,
  showAnnotations,
  onShowAnnotationsChange,
  autosaveAnnotations,
  onAutosaveAnnotationsChange
}) => {
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAnnotations, setSavingAnnotations] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  const handleSaveAnnotations = useCallback(async () => {
    if (!currentSequence.annotation_suffix) {
      setSaveMessage('No annotation suffix available');
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    setSavingAnnotations(true);
    setSaveMessage(null);

    try {
      const response = await saveAnnotations(
        currentSequence.videoset,
        currentSequence.camera,
        currentSequence.annotation_suffix
      );

      if (response.error) {
        setSaveMessage(`Error: ${response.error}`);
      } else if (response.data) {
        setSaveMessage(`Saved! Created: ${response.data.num_created}, Kept: ${response.data.num_kept}`);
      }
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save annotations');
    } finally {
      setSavingAnnotations(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  }, [currentSequence]);

  // Autosave when sequence changes
  const prevSequenceRef = React.useRef<Sequence | null>(null);
  
  useEffect(() => {
    if (autosaveAnnotations && prevSequenceRef.current && 
        (prevSequenceRef.current.videoset !== currentSequence.videoset ||
         prevSequenceRef.current.camera !== currentSequence.camera ||
         prevSequenceRef.current.annotation_suffix !== currentSequence.annotation_suffix)) {
      // Save annotations for the previous sequence
      const saveForPreviousSequence = async () => {
        const prevSeq = prevSequenceRef.current!;
        if (prevSeq.annotation_suffix) {
          setSavingAnnotations(true);
          try {
            const response = await saveAnnotations(
              prevSeq.videoset,
              prevSeq.camera,
              prevSeq.annotation_suffix
            );
            if (response.data) {
              setSaveMessage(`Auto-saved previous sequence annotations`);
              setTimeout(() => setSaveMessage(null), 3000);
            }
          } catch (err) {
            console.error('Auto-save failed:', err);
          } finally {
            setSavingAnnotations(false);
          }
        }
      };
      saveForPreviousSequence();
    }
    prevSequenceRef.current = currentSequence;
  }, [currentSequence, autosaveAnnotations]);

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

      <h3>Annotations</h3>

      <div className="form-group">
        <label className="form-label">
          <input
            type="checkbox"
            checked={showAnnotations}
            onChange={(e) => onShowAnnotationsChange(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Show Annotations
        </label>
      </div>

      <div className="form-group">
        <label className="form-label">
          <input
            type="checkbox"
            checked={autosaveAnnotations}
            onChange={(e) => onAutosaveAnnotationsChange(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          Autosave annotations on sequence change
        </label>
      </div>

      <div className="form-group">
        <button
          onClick={handleSaveAnnotations}
          disabled={savingAnnotations || !currentSequence.annotation_suffix}
          className="save-button"
          style={{
            padding: '8px 16px',
            backgroundColor: savingAnnotations ? '#ccc' : '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: savingAnnotations || !currentSequence.annotation_suffix ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {savingAnnotations ? 'Saving...' : 'Save Annotations'}
        </button>
        {saveMessage && (
          <div style={{
            marginTop: '8px',
            padding: '6px',
            fontSize: '12px',
            borderRadius: '4px',
            backgroundColor: saveMessage.startsWith('Error') ? '#ffebee' : '#e8f5e8',
            color: saveMessage.startsWith('Error') ? '#c62828' : '#2e7d32',
            border: `1px solid ${saveMessage.startsWith('Error') ? '#ffcdd2' : '#c8e6c9'}`
          }}>
            {saveMessage}
          </div>
        )}
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
