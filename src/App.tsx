import React, { useState, useEffect } from 'react';
import TimeseriesPlot from './timeseries_plot';
import InteractiveImage from './InteractiveImage';
import { type Box } from './InteractiveImage';

export default function App() {
  const [data, setData] = useState<{ x: number[], y: number[], z: number[] }>({ x: [], y: [], z: [] });
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(0);
  const [videoset, setVideoset] = useState<string>('leusderheide_20230705');
  const [camera, setCamera] = useState<string>('visual_halfres/CPFS7_0305');
  const [timeseriesName, setTimeseriesName] = useState<string>('detections/yolov8x_mscoco.csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yColumn, setYColumn] = useState<string | undefined>('bbox_y');
  const [zColumn, setZColumn] = useState<string | undefined>('confidence');

  // const loadTimeseriesData = async () => {
  //   setLoading(true);
  //   setError(null);

  //   const result = await getTimeseries();

  //   if (result.error) {
  //     setError(result.error);
  //     console.error('Error loading timeseries data:', result.error);
  //   } else if (result.data) {
  //     // Convert API format (X, Y, Z) to component format (x, y, z)
  //     setData({
  //       x: result.data.X,
  //       y: result.data.Y,
  //       z: result.data.Z
  //     });
  //     setSelectedTimestamp(result.data.X[0] || 0);
  //   }

  //   setLoading(false);
  // };

  // const loadDetections = async () => {
  //   const result = await getDetections(selectedTimestamp);
  //   if (result.error) {
  //     console.error('Error loading detections:', result.error);
  //   } else if (result.data) {
  //     console.log('Detections loaded:', result.data);
  //     setDetections(result.data.detections as Box[]);
  //   }
  // }

  // useEffect(() => {
  //   loadDetections();
  // }, [selectedTimestamp]);



  // // Load data on component mount
  // useEffect(() => {
  //   loadTimeseriesData();
  //   loadDetections();
  // }, []);

  const handleTimestampChange = (timestamp: number | null) => {
    if (timestamp !== null) {
      setSelectedTimestamp(timestamp);
    }
  };

  return (
    <div className="App" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '70vh', overflow: 'hidden' }}>
        <InteractiveImage selectedLabel='object' timestamp={selectedTimestamp} videoset={videoset} camera={camera} timeseriesName={timeseriesName} />
      </div>
      <div style={{ height: '30vh', overflow: 'hidden' }}>
        <TimeseriesPlot setSelectedTimestamp={handleTimestampChange} videoset={videoset} camera={camera} timeseriesName={timeseriesName} yColumn={yColumn} zColumn={zColumn} />
      </div>
    </div>
  );
}
