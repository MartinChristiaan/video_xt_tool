import React, { useEffect, useRef, useState, useCallback } from "react";
import Plotly from "plotly.js-dist";
import { getTimeseriesData } from "./api";


interface TimeseriesPlotProps {
  setSelectedTimestamp: (timestamp: number | null) => void;
  videoset: string;
  camera: string;
  timeseriesName: string;
  yColumn?: string;
  zColumn?: string;
  annotations?: { x: number[]; y: number[]; z: number[] } | null;
  showAnnotations?: boolean;
}

export default function TimeseriesPlot({ videoset,camera,setSelectedTimestamp,timeseriesName,yColumn,zColumn,annotations,showAnnotations }: TimeseriesPlotProps) {
	const plotDiv = useRef(null);
	const [data, setData] = useState<{x: number[]; y: number[]; z: number[]}>({
		x: [],
		y: [],
		z: []
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchTimeseriesData = useCallback(async () => {
		if (!videoset || !camera || !timeseriesName) {
			return;
		}

		setLoading(true);
		setError(null);

		try {
			// Fetch timeseries data with optional column specifications
			const response = await getTimeseriesData(videoset, camera, timeseriesName, yColumn, zColumn);

			if (response.error) {
				setError(response.error);
				return;
			}

			if (response.data) {
				setData({
					x: response.data.x || [],
					y: response.data.y || [],
					z: response.data.z || []
				});
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch timeseries data');
		} finally {
			setLoading(false);
		}
	}, [videoset, camera, timeseriesName, yColumn, zColumn]);

	const drawPlot = useCallback((x: number[], y: number[], z: number[]) => {
	const base_trace= {
		y: y,
		x: x,
		mode: 'markers',
		marker: {
			size: 5,
			color: z,
			showscale: z.length > 0,
			colorbar: z.length > 0 ? {
				title: zColumn || 'Z Values',
				titleside: 'right'
			} : undefined
		},
		name: 'Data'
	}

	// Create traces array with base trace
	const traces: Partial<Plotly.PlotData>[] = [base_trace];

	// Add annotation trace if annotations exist and should be shown
	if (annotations && showAnnotations && annotations.x.length > 0) {
		const annotation_trace = {
			y: annotations.y,
			x: annotations.x,
			mode: 'markers',
			marker: {
				size: 8,
				color: 'red',
				symbol: 'x',
				line: {
					color: 'darkred',
					width: 2
				}
			},
			name: 'Annotations'
		};
		traces.push(annotation_trace);
	}

	Plotly.newPlot(
	  plotDiv.current,
	  traces,
	  {
		xaxis: {
		  title: 'Timestamp',
		  showgrid: true
		},
		yaxis: {
		  title: yColumn || 'Y Values',
		  showgrid: true
		},
		margin: { t: 40, r: 40, b: 60, l: 60 },
		showlegend: annotations && showAnnotations && annotations.x.length > 0
	  }
	);

	// Hover event
	if (!plotDiv.current || !('on' in plotDiv.current)) return;
	const current_plot = plotDiv.current as unknown as Plotly.PlotlyHTMLElement;

	current_plot.on("plotly_hover", (evt: Readonly<Plotly.PlotMouseEvent>) => {
	  const xval = evt.points[0].x;
	  // setCurrentX(xval);
	  Plotly.relayout(plotDiv.current, {
		"shapes[0]": {
		  type: "line",
		  x0: xval,
		  x1: xval,
		  y0: Math.min(...y),
		  y1: Math.max(...y),
		  line: { color: "red", width: 2 },
		},
	  });
	});

	current_plot.on("plotly_unhover", () => {
	  // setCurrentX(null);
	  Plotly.relayout(plotDiv.current, { "shapes[0]": null });
	});

	// Click event
	current_plot.on("plotly_click", (evt: Readonly<Plotly.PlotMouseEvent>) => {
	  const xval = evt.points[0].x;
	  setSelectedTimestamp(xval);
	  Plotly.relayout(plotDiv.current, {
		"shapes[1]": null,
	  }).then(() => {
		Plotly.relayout(plotDiv.current, {
		  "shapes[1]": {
			type: "line",
			x0: xval,
			x1: xval,
			y0: Math.min(...y),
			y1: Math.max(...y),
			line: { color: "black", width: 2, dash: "dot" },
		  },
		});
	  });
	});
  }, [setSelectedTimestamp, yColumn, zColumn, annotations, showAnnotations]);

//   function regeneratePlot() {
// 	const newData = generateData();
// 	setData(newData);
// 	drawPlot(newData.x, newData.y);
// 	setCurrentX(null);
//   }

  // Fetch data when props change
  useEffect(() => {
	fetchTimeseriesData();
  }, [fetchTimeseriesData]);

  // Redraw plot when data changes
  useEffect(() => {
	if (data.x.length > 0) {
		console.log('redraw plot with data:', data);
		drawPlot(data.x, data.y, data.z);
	}
  }, [data, drawPlot]);

  return (
	<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
	  {loading && <div>Loading timeseries data...</div>}
	  {error && <div style={{ color: 'red' }}>Error: {error}</div>}
	  <div ref={plotDiv} id="plot" style={{ width: "100%", height: "100%", flex: 1 }}></div>
	</div>
  );
}