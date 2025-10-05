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
			color: z.length > 0 ? z : '#2563eb',
			showscale: z.length > 0,
			colorbar: z.length > 0 ? {
				title: {
				  text: zColumn || 'Z Values',
				  font: {
					color: '#f8fafc',
					size: 12
				  }
				},
				titleside: 'right',
				tickfont: {
				  color: '#cbd5e1',
				  size: 10
				},
				bgcolor: 'rgba(30, 41, 59, 0.8)',
				bordercolor: '#475569',
				borderwidth: 1,
				outlinecolor: '#475569',
				outlinewidth: 1
			} : undefined,
			line: z.length === 0 ? {
				color: '#1e40af',
				width: 1
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
				color: '#f59e0b',
				symbol: 'x',
				line: {
					color: '#d97706',
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
		  title: {
			text: 'Timestamp',
			font: {
			  color: '#f8fafc',
			  size: 14
			}
		  },
		  showgrid: true,
		  gridcolor: '#334155',
		  tickfont: {
			color: '#cbd5e1',
			size: 12
		  },
		  linecolor: '#475569',
		  zerolinecolor: '#475569'
		},
		yaxis: {
		  title: {
			text: yColumn || 'Y Values',
			font: {
			  color: '#f8fafc',
			  size: 14
			}
		  },
		  showgrid: true,
		  gridcolor: '#334155',
		  tickfont: {
			color: '#cbd5e1',
			size: 12
		  },
		  linecolor: '#475569',
		  zerolinecolor: '#475569'
		},
		plot_bgcolor: '#1e293b',
		paper_bgcolor: '#0f172a',
		margin: { t: 50, r: 60, b: 70, l: 80 },
		showlegend: annotations && showAnnotations && annotations.x.length > 0,
		legend: {
		  font: {
			color: '#f8fafc',
			size: 12
		  },
		  bgcolor: 'rgba(30, 41, 59, 0.8)',
		  bordercolor: '#475569',
		  borderwidth: 1
		},
		font: {
		  color: '#f8fafc',
		  family: 'Inter, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif'
		}
	  },
	  {
		responsive: true,
		displayModeBar: true,
		modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian'],
		displaylogo: false
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
		  line: { color: "#06b6d4", width: 2 },
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
			line: { color: "#f8fafc", width: 2, dash: "dot" },
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
	<div style={{
	  width: "100%",
	  height: "100%",
	  display: "flex",
	  flexDirection: "column",
	  backgroundColor: "#0f172a",
	  color: "#f8fafc"
	}}>
	  {loading && (
		<div style={{
		  display: "flex",
		  alignItems: "center",
		  justifyContent: "center",
		  height: "100%",
		  color: "#cbd5e1",
		  fontSize: "16px"
		}}>
		  Loading timeseries data...
		</div>
	  )}
	  {error && (
		<div style={{
		  display: "flex",
		  alignItems: "center",
		  justifyContent: "center",
		  height: "100%",
		  color: "#ef4444",
		  fontSize: "16px",
		  textAlign: "center",
		  padding: "20px"
		}}>
		  Error: {error}
		</div>
	  )}
	  <div ref={plotDiv} id="plot" style={{ width: "100%", height: "100%", flex: 1 }}></div>
	</div>
  );
}