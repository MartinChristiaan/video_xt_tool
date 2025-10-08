import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { fetchFrameSize, getTimeseriesAtTimestamp, getFrameUrl, getAnnotationAtTimestamp, saveAnnotationsAtTimestamp } from './api';
import { zValueToColor, getZRange, defaultBoxColors, getContrastingTextColor } from './colorUtils';
import './InteractiveImage.css';
export interface Box {
  bbox_x: number;
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  label: string;
  type: 'detection' | 'annotation' | 'manual';
  id?: string; // Unique identifier for tracking
  // may have more properties
}

interface InteractiveImageProps {
  selectedLabel: string;
  timestamp:number;
  videoset: string;
  camera: string;
  timeseriesName: string;
  annotations?: { x: number[]; y: number[]; z: number[] } | null;
  showAnnotations?: boolean;
  annotationSuffix?: string;
  yColumn?: string;
  zColumn?: string;
}

function getBoxZValue(box: Box, zColumn?: string): number {
  if (zColumn && (box as any)[zColumn] != null) {
    return (box as any)[zColumn] as number;
  }
  return 0;
}

const InteractiveImage: React.FC<InteractiveImageProps> = ({ selectedLabel,timestamp,videoset,camera,timeseriesName,annotations,showAnnotations,annotationSuffix,zColumn }) => {

  const [currentBox, setCurrentBox] = useState<Omit<Box, 'label' | 'type' | 'id'> & { id: string } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [allBoxes, setAllBoxes] = useState<Box[]>([]);
  const [detectionBoxes, setDetectionBoxes] = useState<Box[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<{width:number,height:number}>({width:0,height:0});
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Calculate z-value ranges for color mapping
  const allZValues = [
    ...detectionBoxes.map(box => getBoxZValue(box, zColumn)),
  ].filter((z): z is number => z != null);

  const { min: zMin, max: zMax } = getZRange(allZValues);

  const load_frame_size = useCallback(async () => {
    const frame_size = await fetchFrameSize(videoset,camera,timestamp);
    if (frame_size.data) {
      setFrameSize({width:frame_size.data.width,height:frame_size.data.height});
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
        setDetectionBoxes(detectionData.data as unknown as Box[]);
      } else {
        setDetectionBoxes([]);
      }
    } catch (error) {
      console.error("Error loading detection boxes:", error);
      setDetectionBoxes([]);
    }
  }, [videoset, camera, timestamp, timeseriesName, zColumn]);

  const saveCurrentAnnotations = useCallback(async (currentBoxes: Box[]) => {
    if (!annotationSuffix) return;
    
    // Filter only manual and annotation type boxes for saving
    const boxesToSave = currentBoxes.filter(box => box.type === 'manual' || box.type === 'annotation');
    
    // Convert boxes to the format expected by the API
    const annotationsData = boxesToSave.map(box => ({
      bbox_x: (box.bbox_x - x_offset/scale_factor) , 
      bbox_y: (box.bbox_y  - y_offset/scale_factor),
      bbox_w: box.bbox_w ,
      bbox_h: box.bbox_h ,
      label: box.label,
      timestamp: timestamp,
    }));

    try {
      const result = await saveAnnotationsAtTimestamp(videoset, camera, annotationSuffix, timestamp, annotationsData);
      if (result.error) {
        console.error("Error saving annotations:", result.error);
      }
    } catch (error) {
      console.error("Error saving annotations:", error);
    }
  }, [videoset, camera, annotationSuffix, timestamp, zColumn]);

  const loadAnnotationBoxes = useCallback(async () => {
    if (!annotationSuffix || !showAnnotations) {
      // Remove existing annotation boxes from the unified state
      setAllBoxes([]);
      return;
    }

    try {
      const annotationData = await getAnnotationAtTimestamp(videoset, camera, annotationSuffix, timestamp);
      if (annotationData.data && annotationData.data.length > 0) {
        // Convert the annotation data to Box format
        const annotationBoxes: Box[] = annotationData.data.map((annotation: Record<string, unknown>, index: number) => ({
          bbox_x: (annotation.bbox_x as number) || 0,
          bbox_y: (annotation.bbox_y as number) || 0,
          bbox_w: (annotation.bbox_w as number) || 10,
          bbox_h: (annotation.bbox_h as number) || 10,
          label: (annotation.label as string) || `Ann${index + 1}`,
          type: 'annotation',
          id: `annotation-${timestamp}-${index}`,
          ...(zColumn && annotation.hasOwnProperty(zColumn) ? { [zColumn]: annotation[zColumn] } : {})
        }));
        
        // Replace annotation boxes in the unified state
        setAllBoxes(annotationBoxes
        );
      } else {
        // Remove existing annotation boxes if no data
        setAllBoxes(prevBoxes => prevBoxes.filter(box => box.type !== 'annotation'));
      }
    } catch (error) {
      console.error("Error loading annotation boxes:", error);
      setAllBoxes(prevBoxes => prevBoxes.filter(box => box.type !== 'annotation'));
    }
  }, [videoset, camera, annotationSuffix, timestamp, showAnnotations, zColumn]);

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
    loadAnnotationBoxes();
  },[load_frame_size, loadDetectionBoxes, loadAnnotationBoxes]);

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
    setCurrentBox({ bbox_x: coords.x, bbox_y: coords.y, bbox_w: 0, bbox_h: 0, id: `drawing-${Date.now()}` });
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
        type: 'manual',
        id: `manual-${timestamp}-${Date.now()}`,
        // For manually drawn boxes, we could assign a z_value based on the current timestamp
        // or leave it undefined to use the default color
    };
    // Note: coordinates are already in frame coordinate system from getCoordinates()
    // No additional scaling needed since getCoordinates() already handles scale_factor

    if (finalBox.bbox_w > 5 && finalBox.bbox_h > 5) { // Minimum size check
        setAllBoxes(prevBoxes => {
          const newBoxes = [...prevBoxes, finalBox];
          // Automatically save annotations when a new box is added
          saveCurrentAnnotations(newBoxes);
          return newBoxes;
        });
    }

    setIsDrawing(false);
    setCurrentBox(null);
  };

  const handleRemoveBox = (e: React.MouseEvent, boxId: string) => {
    e.preventDefault();
    setAllBoxes(prevBoxes => {
      const newBoxes = prevBoxes.filter(box => box.id !== boxId);
      // Automatically save annotations when a box is removed
      saveCurrentAnnotations(newBoxes);
      return newBoxes;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      // Remove the last manually created or annotation box
      setAllBoxes(prevBoxes => {
        const editableBoxes = prevBoxes.filter(box => box.type === 'manual' || box.type === 'annotation');
        if (editableBoxes.length > 0) {
          const lastBox = editableBoxes[editableBoxes.length - 1];
          const newBoxes = prevBoxes.filter(box => box.id !== lastBox.id);
          // Automatically save annotations when a box is removed
          saveCurrentAnnotations(newBoxes);
          return newBoxes;
        }
        return prevBoxes;
      });
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
      {detectionBoxes.map((box, index) => {
        const z_value = getBoxZValue(box,zColumn);
        const boxColor = zValueToColor(z_value, zMin, zMax, defaultBoxColors.detection);
        return (
          <div
            key={`detection-${index}`}
            style={{
              position: 'absolute',
              left: box.bbox_x * scale_factor + x_offset,
              top: box.bbox_y * scale_factor + y_offset,
              width: box.bbox_w * scale_factor,
              height: box.bbox_h * scale_factor,
              border: `2px solid ${boxColor}`,
              boxSizing: 'border-box',
              pointerEvents: 'none'
            }}
          >
            <div style={{
              position: 'absolute',
              top: -10,
              left: -2,
              color: getContrastingTextColor(boxColor),
              backgroundColor: boxColor,
              padding: '2px',
              fontSize: '6px',
              fontWeight: 'bold',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              fontFamily: 'inherit'
            }}>
              {box.label + ` (${z_value.toFixed(2)})`}
            </div>
          </div>
        );
      })}

      {/* Render annotation boxes from unified state (interactive) */}
      {allBoxes.filter(box => box.type === 'annotation').map((box) => {
        const z_value = getBoxZValue(box, zColumn);
        const boxColor = zValueToColor(z_value, zMin, zMax, defaultBoxColors.annotation);
        return (
          <div
            key={box.id}
            style={{
              position: 'absolute',
              left: box.bbox_x * scale_factor + x_offset,
              top: box.bbox_y * scale_factor + y_offset,
              width: box.bbox_w * scale_factor,
              height: box.bbox_h * scale_factor,
              border: `2px solid ${boxColor}`,
              boxSizing: 'border-box',
              cursor: 'pointer'
            }}
            onContextMenu={(e) => handleRemoveBox(e, box.id!)}
          >
            <div style={{
              position: 'absolute',
              top: -12,
              left: -2,
              color: getContrastingTextColor(boxColor),
              backgroundColor: boxColor,
              padding: '2px',
              fontSize: '7px',
              fontWeight: 'bold',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              fontFamily: 'inherit',
              pointerEvents: 'none'
            }}>
              {box.label}
            </div>
          </div>
        );
      })}

      {/* Render annotation points from API (read-only) */}
      {annotations && showAnnotations && annotations.x.map((x, index) => {
        const zValue = annotations.z ? annotations.z[index] : undefined;
        const pointColor = zValueToColor(zValue, zMin, zMax, defaultBoxColors.annotationPoint);
        return (
          <div
            key={`annotation-${index}`}
            style={{
              position: 'absolute',
              left: x * scale_factor + x_offset - 4, // Center the point (8px diameter / 2)
              top: annotations.y[index] * scale_factor + y_offset - 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: pointColor,
              border: `2px solid ${pointColor}`,
              boxSizing: 'border-box',
              pointerEvents: 'none'
            }}
          >
            <div style={{
              position: 'absolute',
              top: -18,
              left: '50%',
              transform: 'translateX(-50%)',
              color: getContrastingTextColor(pointColor),
              backgroundColor: pointColor,
              padding: '1px 3px',
              fontSize: '8px',
              fontWeight: 'bold',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              fontFamily: 'inherit'
            }}>
              {`A${index + 1}`}
            </div>
          </div>
        );
      })}

      {/* Render manually drawn boxes from unified state (interactive) */}
      {allBoxes.filter(box => box.type === 'manual').map((box) => {
        const z_value = getBoxZValue(box, zColumn);
        const boxColor = zValueToColor(z_value, zMin, zMax, defaultBoxColors.manual);
        return (
          <div
            key={box.id}
            style={{
              position: 'absolute',
              left: box.bbox_x * scale_factor,
              top: box.bbox_y * scale_factor,
              width: box.bbox_w * scale_factor,
              height: box.bbox_h * scale_factor,
              border: `2px solid ${boxColor}`,
              boxSizing: 'border-box',
              cursor: 'pointer'
            }}
            onContextMenu={(e) => handleRemoveBox(e, box.id!)}
          >
            <div style={{
              position: 'absolute',
              top: -16,
              left: -1,
              color: getContrastingTextColor(boxColor),
              backgroundColor: boxColor,
              padding: '2px 4px',
              fontSize: '10px',
              fontWeight: 'bold',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              fontFamily: 'inherit',
              pointerEvents: 'none'
            }}>
              {box.label}
            </div>
          </div>
        );
      })}
      {currentBox && (
        <div
          style={{
            position: 'absolute',
            left: (currentBox.bbox_w > 0 ? currentBox.bbox_x : currentBox.bbox_x + currentBox.bbox_w) * scale_factor,
            top: (currentBox.bbox_h > 0 ? currentBox.bbox_y : currentBox.bbox_y + currentBox.bbox_h) * scale_factor,
            width: Math.abs(currentBox.bbox_w) * scale_factor,
            height: Math.abs(currentBox.bbox_h) * scale_factor,
            border: `2px dotted ${defaultBoxColors.drawing}`,
            boxSizing: 'border-box',
            pointerEvents: 'none'
          }}
        />
      )}
      </div>
    </div>
  );
};

export default InteractiveImage;