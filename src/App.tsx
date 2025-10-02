import React, { useState, useEffect } from 'react';
import TimeseriesPlot from './timeseries_plot';
import { getTimeseries, getDetections } from './api';
import InteractiveImage from './InteractiveImage';
import { type Box } from './InteractiveImage';

export default function App() {
  const [data, setData] = useState<{ x: number[], y: number[], z: number[] }>({ x: [], y: [], z: [] });
  const [selectedTimestamp, setSelectedTimestamp] = useState<number>(0);
  const [videoset, setVideoset] = useState<string>('leusderheide_20230705');
  const [camera, setCamera] = useState<string>('visual_halfres/CPFS7_0310');
  const [timeseriesName, setTimeseriesName] = useState<string>('detections/yolov8_mscoco.csv');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <InteractiveImage selectedLabel='object' timestamp={selectedTimestamp} videoset={videoset} camera={camera} />
    // <div className="App">
    //   <div style={{ padding: '20px' }}>
    //     {error && (
    //       <div style={{ color: 'red', marginTop: '10px' }}>
    //         Error: {error}
    //       </div>
    //     )}
    //     {data.x.length === 0 && !loading && !error && (
    //       <div style={{ marginTop: '10px' }}>
    //         No timeseries data available. Make sure the backend is running and a videoset/timeseries is loaded.
    //       </div>
    //     )}
    //     {selectedTimestamp && (
    //       <div style={{ marginTop: '10px' }}>
    //         Selected timestamp: {selectedTimestamp}
    //       </div>
    //     )}
    //   </div>
    //   {data.x.length > 0 && (
    //     <div>
    //       <TimeseriesPlot data={data} setSelectedTimestamp={setSelectedTimestamp} />
    //     </div>
    //   )}
    // </div>
  );
}
