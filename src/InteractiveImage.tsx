import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { fetchFrameSize, getTimeseriesAtTimestamp, getFrameUrl } from './api';
import './InteractiveImage.css';
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
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    // Don't zoom while drawing
    if (isDrawing) return;

    if (!imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(5, zoom * zoomFactor));

    // Calculate new pan offset to zoom towards mouse position
    const newPanX = mouseX - (mouseX - panOffset.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panOffset.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [zoom, panOffset, isDrawing]);

  useEffect(() => {
    load_frame_size();
    loadDetectionBoxes();
  },[load_frame_size, loadDetectionBoxes]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Calculate scale factor based on the actual image display size
  let scale_factor = 1;
  let x_offset = 0;
  let y_offset = 0;
  if (imageContainerRef.current && frameSize.width > 0 && frameSize.height > 0) {
    const rect = imageContainerRef.current.getBoundingClientRect();
    const imageAspectRatio = frameSize.width / frameSize.height;
    const containerAspectRatio = rect.width / rect.height;

    if (containerAspectRatio > imageAspectRatio) {
      // Container is wider than image - image is constrained by height
      scale_factor = rect.height / frameSize.height;
    } else {
      // Container is taller than image - image is constrained by width
      scale_factor = rect.width / frameSize.width;
    }
    // Calculate offsets to center the image
    x_offset = (rect.width - frameSize.width * scale_factor) / 2;
    y_offset = (rect.height - frameSize.height * scale_factor) / 2;
  }

  const getCoordinates = (e: MouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    if (!imageContainerRef.current) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    // Get coordinates relative to the transformed div (which contains the image and boxes)
    const transformedX = (e.clientX - rect.left - panOffset.x) / zoom;
    const transformedY = (e.clientY - rect.top - panOffset.y) / zoom;
    // Convert from display coordinates to frame coordinates
    return { x: transformedX / scale_factor, y: transformedY / scale_factor };
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
    // Note: coordinates are already in frame coordinate system from getCoordinates()
    // No additional scaling needed since getCoordinates() already handles scale_factor

    if (finalBox.bbox_w > 5 && finalBox.bbox_h > 5) { // Minimum size check
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

  const handleDoubleClick = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      className="interactive-image-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Stop drawing if mouse leaves the container
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      tabIndex={0}
      ref={imageContainerRef}
    >
      <div
        className="interactive-image-transform"
        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})` }}
      >
        <img
          src={getFrameUrl(videoset, camera, timestamp)}
          alt="interactive"
          className="interactive-image-content"
        />

        {/* Zoom indicator */}
        {zoom !== 1 && (
          <div
            className="interactive-image-zoom-indicator"
            style={{ transform: `scale(${1 / zoom})` }}
          >
            {Math.round(zoom * 100)}%
          </div>
        )}
      {/* Render detection boxes from API (read-only) */}
      {detectionBoxes.map((box, index) => (
        <div
          key={`detection-${index}`}
          className="interactive-image-detection-box"
          style={{
            left: box.bbox_x * scale_factor + x_offset,
            top: box.bbox_y * scale_factor + y_offset,
            width: box.bbox_w * scale_factor,
            height: box.bbox_h * scale_factor,
          }}
        >
          <div className="interactive-image-detection-label">
            {box.label}
          </div>
        </div>
      ))}
      {/* Render manually drawn boxes (interactive) */}
      {boxes.map((box, index) => (
        <div
          key={`manual-${index}`}
          className="interactive-image-manual-box"
          style={{
            left: box.bbox_x * scale_factor,
            top: box.bbox_y * scale_factor,
            width: box.bbox_w * scale_factor,
            height: box.bbox_h * scale_factor,
          }}
          onContextMenu={(e) => handleRemoveBox(e, index)}
        >
          <div className="interactive-image-manual-label">
            {box.label}
          </div>
        </div>
      ))}
      {currentBox && (
        <div
          className="interactive-image-drawing-box"
          style={{
            left: (currentBox.bbox_w > 0 ? currentBox.bbox_x : currentBox.bbox_x + currentBox.bbox_w) * scale_factor,
            top: (currentBox.bbox_h > 0 ? currentBox.bbox_y : currentBox.bbox_y + currentBox.bbox_h) * scale_factor,
            width: Math.abs(currentBox.bbox_w) * scale_factor,
            height: Math.abs(currentBox.bbox_h) * scale_factor,
          }}
        />
      )}
      </div>
    </div>
  );
};

export default InteractiveImage;