import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { fetchFrameSize, getTimeseriesAtTimestamp, getFrameUrl } from './api';
export interface Box {
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  label: string;
}

interface InteractiveImageProps {
  selectedLabel: string;
  timestamp:number;
  videoset: string;
  camera: string;
  timeseriesName: string;
}

const InteractiveImage: React.FC<InteractiveImageProps> = ({ selectedLabel,timestamp,videoset,camera,timeseriesName }) => {

  const [currentBox, setCurrentBox] = useState<Omit<Box, 'label'> | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [detectionBoxes, setDetectionBoxes] = useState<Box[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<{width:number,height:number}>({width:0,height:0});

  const load_frame_size = useCallback(async () => {
    const frame_size = await fetchFrameSize(videoset,camera,timestamp);
    if (frame_size.data) {
      setFrameSize({width:frame_size.data.width,height:frame_size.data.height});
      console.log("Frame size:",frame_size.data);
    }
    else {
      console.error("Error fetching frame size:",frame_size.error);
    }
  }, [videoset, camera, timestamp]);

  const loadDetectionBoxes = useCallback(async () => {
    try {
      // Try to load detection data from a timeseries named 'detections'
      // This assumes there's a timeseries with detection data
      const detectionData = await getTimeseriesAtTimestamp(videoset, camera, timeseriesName, timestamp);
      if (detectionData.data && detectionData.data.length > 0) {
        // Convert the detection data to Box format
        const boxes: Box[] = detectionData.data.map((detection: Record<string, unknown>) => ({
          bbox_x: (detection.bbox_x as number),
          bbox_y: (detection.bbox_y as number),
          bbox_w: (detection.bbox_w as number),
          bbox_h: (detection.bbox_h as number),
          label: (detection.label as string) || (detection.class as string) || 'detection',
        }));
        setDetectionBoxes(boxes);
        console.log("Loaded detection boxes:", boxes);
      } else {
        setDetectionBoxes([]);
      }
    } catch (error) {
      console.error("Error loading detection boxes:", error);
      setDetectionBoxes([]);
    }
  }, [videoset, camera, timestamp,timeseriesName]);

  useEffect(() => {
    load_frame_size();
    loadDetectionBoxes();
  },[load_frame_size, loadDetectionBoxes]);

  let scale_factor = 1;
  if (imageContainerRef.current) {
    const rect = imageContainerRef.current.getBoundingClientRect();
    scale_factor = rect.width / frameSize.width; // Assuming original image width is 640px
  }
  const getCoordinates = (e: MouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    if (!imageContainerRef.current) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setCurrentBox({ bbox_x: coords.x, bbox_y: coords.y, bbox_w: 0, bbox_h: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !currentBox) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const newWidth = coords.x - currentBox.bbox_x;
    const newHeight = coords.y - currentBox.bbox_y;

    setCurrentBox({
      ...currentBox,
      bbox_w: newWidth,
      bbox_h: newHeight,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;

    // To ensure width and height are positive, we adjust the x and y coordinates.
    const finalBox: Box = {
        bbox_x: currentBox.bbox_w > 0 ? currentBox.bbox_x : currentBox.bbox_x + currentBox.bbox_w,
        bbox_y: currentBox.bbox_h > 0 ? currentBox.bbox_y : currentBox.bbox_y + currentBox.bbox_h,
        bbox_w: Math.abs(currentBox.bbox_w),
        bbox_h: Math.abs(currentBox.bbox_h),
        label: selectedLabel,
    };

    if (finalBox.bbox_w > 0 && finalBox.bbox_h > 0) {
        setBoxes([...boxes, finalBox]);
    }

    setIsDrawing(false);
    setCurrentBox(null);
  };

  const handleRemoveBox = (e: React.MouseEvent, indexToRemove: number) => {
    e.preventDefault();
    setBoxes(boxes.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      setBoxes(boxes.slice(0, -1));
    }
  };

  return (
    <div
      ref={imageContainerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        outline: 'none', // Remove focus outline
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves the container
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <img
        src={getFrameUrl(videoset, camera, timestamp)}
        alt="interactive"
        style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
      />
      {/* Render detection boxes from API (read-only) */}
      {detectionBoxes.map((box, index) => (
        <div
          key={`detection-${index}`}
          style={{
            position: 'absolute',
            border: '2px solid green',
            left: box.bbox_x*scale_factor,
            top: box.bbox_y*scale_factor,
            width: box.bbox_w*scale_factor,
            height: box.bbox_h*scale_factor,
            pointerEvents: 'none', // Make detection boxes non-interactive
          }}
        >
          <div style={{ position: 'absolute', top: -20, left: 0, color: 'white', backgroundColor: 'green', padding: '2px' }}>
            {box.label}
          </div>
        </div>
      ))}
      {/* Render manually drawn boxes (interactive) */}
      {boxes.map((box, index) => (
        <div
          key={`manual-${index}`}
          style={{
            position: 'absolute',
            border: '2px solid red',
            left: box.bbox_x*scale_factor,
            top: box.bbox_y*scale_factor,
            width: box.bbox_w*scale_factor,
            height: box.bbox_h*scale_factor,
          }}
          onContextMenu={(e) => handleRemoveBox(e, index)}
        >
          <div style={{ position: 'absolute', top: -20, left: 0, color: 'white', backgroundColor: 'red', padding: '2px' }}>
            {box.label}
          </div>
        </div>
      ))}
      {currentBox && (
        <div
          style={{
            position: 'absolute',
            border: '2px dotted blue',
            left: currentBox.bbox_w > 0 ? currentBox.bbox_x : currentBox.bbox_x + currentBox.bbox_w,
            top: currentBox.bbox_h > 0 ? currentBox.bbox_y : currentBox.bbox_y + currentBox.bbox_h,
            width: Math.abs(currentBox.bbox_w),
            height: Math.abs(currentBox.bbox_h),
          }}
        />
      )}
    </div>
  );
};

export default InteractiveImage;