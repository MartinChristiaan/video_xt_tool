import React, { useEffect, useRef, useState } from "react";
import Plotly from "plotly.js-dist";

interface TimeseriesPlotProps {
  data: {
	x: number[];
	y: number[];
	z: number[];
  };
  setSelectedTimestamp: (timestamp: number | null) => void;
}

export default function TimeseriesPlot({ data, setSelectedTimestamp }: TimeseriesPlotProps) {
  const plotDiv = useRef(null);

function drawPlot(x: number[], y: number[], z: number[]) {
	const base_trace= {
		y: y,
		x: x,
		mode: 'markers',
		marker: {
			size: 5,
			color: z
		}
	}

	Plotly.newPlot(
	  plotDiv.current,
	  [
		base_trace

	  ],
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
  }

//   function regeneratePlot() {
// 	const newData = generateData();
// 	setData(newData);
// 	drawPlot(newData.x, newData.y);
// 	setCurrentX(null);
//   }

  // Initial mount
  useEffect(() => {
	// const initialData = generateData();
	// setData(initialData);
	console.log('redraw plot with data:', data);
	drawPlot(data.x, data.y,data.z);
  }, [data]);

  return (
	<div>
	  {/* <button onClick={regeneratePlot} style={{ marginBottom: "20px" }}>
		Regenerate Plot Values
	  </button> */}
	  <div ref={plotDiv} id="plot" style={{ width: "100vw", height: "100vh"}}></div>
	</div>
  );
}