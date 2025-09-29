import React, { useState } from 'react';
import TimeseriesPlot from './timeseries_plot';

function generateData() {
  const x = Array.from({ length: 10000 }, (_, i) => i);
  const y = x.map((v) => Math.sin(v / 10) + Math.random() * 0.2);
  const z = x.map((v) => v * 0.2);
  return { x, y, z };
}

export default function App() {
  const [data, setData] = useState(generateData());
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);

  const handleGenerateData = () => {
    setData(generateData());
  };

  return (
    <div className="App">
      <button onClick={handleGenerateData}>Generate New Data</button>
      <TimeseriesPlot data={data} setSelectedTimestamp={setSelectedTimestamp}/>
    </div>
  );
}
