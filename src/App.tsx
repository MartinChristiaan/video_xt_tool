import React, { useState, useEffect, useCallback } from 'react';
import TimeseriesPlot from './timeseries_plot';
import InteractiveImage from './InteractiveImage';
import Sidebar from './sidebar';
import { getSubsets, getSubset, getTimeseriesOptions, type Sequence } from './api';
import './App.css';



export default function App() {
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(0);
  const [subsetName, setSubsetName] = useState<string>('Leusderheide');
  const [subset, setSubset] = useState<Sequence[] | null>(null);
  const [subsetIndex, setSubsetIndex] = useState<number>(0);
  const [availableSubsets, setAvailableSubsets] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [timeseriesName, setTimeseriesName] = useState<string>('');
  const [availableTimeseries, setAvailableTimeseries] = useState<string[]>([]);
  const [yColumn, setYColumn] = useState<string | undefined>('bbox_y');
  const [zColumn, setZColumn] = useState<string | undefined>('confidence');

  // Load available subsets on component mount
  useEffect(() => {
    const loadSubsets = async () => {
      try {
        setLoading(true);
        const response = await getSubsets();
        if (response.error) {
          setError(response.error);
        } else if (response.data) {
          setAvailableSubsets(response.data);
          // Load the default subset if it exists
          if (response.data.includes(subsetName)) {
            const subsetResponse = await getSubset(subsetName);
            if (subsetResponse.error) {
              setError(subsetResponse.error);
            } else if (subsetResponse.data) {
              setSubset(subsetResponse.data);
              setSubsetIndex(0);
              setError(null);
            }
          } else if (response.data.length > 0) {
            // Load the first available subset
            const firstSubset = response.data[0];
            setSubsetName(firstSubset);
            const subsetResponse = await getSubset(firstSubset);
            if (subsetResponse.error) {
              setError(subsetResponse.error);
            } else if (subsetResponse.data) {
              setSubset(subsetResponse.data);
              setSubsetIndex(0);
              setError(null);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subsets');
      } finally {
        setLoading(false);
      }
    };

    loadSubsets();
  }, [subsetName]);

  // Load available timeseries for the current sequence
  const loadTimeseries = useCallback(async (videoset: string, camera: string) => {
    try {
      const response = await getTimeseriesOptions(videoset, camera);
      if (response.error) {
        console.error('Error loading timeseries options:', response.error);
      } else if (response.data) {
        setAvailableTimeseries(response.data);
        // Set default timeseries name if not already set
        if (!timeseriesName && response.data.length > 0) {
          // Try to find a default that contains "detection" or use the first one
          const defaultTimeseries = response.data.find(name =>
            name.toLowerCase().includes('detection') ||
            name.toLowerCase().includes('yolo')
          ) || response.data[0];
          setTimeseriesName(defaultTimeseries);
        }
      }
    } catch (err) {
      console.error('Failed to load timeseries options:', err);
    }
  }, [timeseriesName]);

  // Load timeseries when subset changes
  useEffect(() => {
    if (subset && subset.length > 0) {
      const currentSequence = subset[subsetIndex];
      loadTimeseries(currentSequence.videoset, currentSequence.camera);
    }
  }, [subset, subsetIndex, loadTimeseries]);

  // Load a specific subset
  const loadSubset = async (name: string) => {
    try {
      setLoading(true);
      const response = await getSubset(name);
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setSubset(response.data);
        setSubsetIndex(0); // Reset to first sequence
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subset');
    } finally {
      setLoading(false);
    }
  };

  // Handle subset name change
  const handleSubsetChange = async (newSubsetName: string) => {
    if (newSubsetName !== subsetName) {
      setSubsetName(newSubsetName);
      await loadSubset(newSubsetName);
    }
  };

  // Handle subset index change
  const handleSubsetIndexChange = (newIndex: number) => {
    if (subset && newIndex >= 0 && newIndex < subset.length) {
      setSubsetIndex(newIndex);
    }
  };

  const handleTimestampChange = (timestamp: number | null) => {
    if (timestamp !== null) {
      setSelectedTimestamp(timestamp);
    }
  };

  const handleYColumnChange = (column: string | undefined) => {
    setYColumn(column);
  };

  const handleZColumnChange = (column: string | undefined) => {
    setZColumn(column);
  };

  const handleTimeseriesChange = (newTimeseriesName: string) => {
    setTimeseriesName(newTimeseriesName);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="app loading">
        Loading subset...
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="app error">
        <div>Error: {error}</div>
        <button onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  // Show empty state if no subset is loaded
  if (!subset || subset.length === 0) {
    return (
      <div className="app empty">
        No sequences found in subset
      </div>
    );
  }

  // Get current sequence
  const currentSequence = subset[subsetIndex];
  const videoset = currentSequence.videoset;
  const camera = currentSequence.camera;

  return (
    <div className="app">
      <Sidebar
        videoset={videoset}
        camera={camera}
        timeseriesName={timeseriesName}
        availableTimeseries={availableTimeseries}
        onTimeseriesChange={handleTimeseriesChange}
        yColumn={yColumn}
        zColumn={zColumn}
        onYColumnChange={handleYColumnChange}
        onZColumnChange={handleZColumnChange}
        // Subset-related props
        subsetName={subsetName}
        availableSubsets={availableSubsets}
        onSubsetChange={handleSubsetChange}
        subsetIndex={subsetIndex}
        subsetCount={subset.length}
        onSubsetIndexChange={handleSubsetIndexChange}
        currentSequence={currentSequence}
      />
      <div className="content">
        <div className="image-container">
          <InteractiveImage
            selectedLabel='object'
            timestamp={selectedTimestamp}
            videoset={videoset}
            camera={camera}
            timeseriesName={timeseriesName}
          />
        </div>
        <div className="timeseries-container">
          <TimeseriesPlot
            setSelectedTimestamp={handleTimestampChange}
            videoset={videoset}
            camera={camera}
            timeseriesName={timeseriesName}
            yColumn={yColumn}
            zColumn={zColumn}
          />
        </div>
      </div>
    </div>
  );
}
