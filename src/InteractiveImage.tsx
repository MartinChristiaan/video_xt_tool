import React, { useState, useRef, MouseEvent, useEffect } from 'react';
import { fetchFrameSize } from './api';
export interface Box {
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  label: string;
}

interface InteractiveImageProps {
  selectedLabel: string;
  timestamp:number;
  videoset: string;
  camera: string;
}

const InteractiveImage: React.FC<InteractiveImageProps> = ({ selectedLabel,timestamp,videoset,camera }) => {

  const [currentBox, setCurrentBox] = useState<Omit<Box, 'label'> | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<{width:number,height:number}>({width:0,height:0});

  const load_frame_size = async () => {
    const frame_size = await fetchFrameSize(videoset,camera,timestamp);
    if (frame_size.data) {
      setFrameSize({width:frame_size.data.width,height:frame_size.data.height});
      console.log("Frame size:",frame_size.data);
    }
    else {
      console.error("Error fetching frame size:",frame_size.error);
    }
  }
  useEffect(() => {
    load_frame_size();
  },[videoset,camera,timestamp]);

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
    setCurrentBox({ bbox_x: coords.x, bbox_y: coords.y, bbox_width: 0, bbox_height: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !currentBox) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const newWidth = coords.x - currentBox.bbox_x;
    const newHeight = coords.y - currentBox.bbox_y;

    setCurrentBox({
      ...currentBox,
      bbox_width: newWidth,
      bbox_height: newHeight,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;

    // To ensure width and height are positive, we adjust the x and y coordinates.
    const finalBox: Box = {
        bbox_x: currentBox.bbox_width > 0 ? currentBox.bbox_x : currentBox.bbox_x + currentBox.bbox_width,
        bbox_y: currentBox.bbox_height > 0 ? currentBox.bbox_y : currentBox.bbox_y + currentBox.bbox_height,
        bbox_width: Math.abs(currentBox.bbox_width),
        bbox_height: Math.abs(currentBox.bbox_height),
        label: selectedLabel,
    };

    if (finalBox.bbox_width > 0 && finalBox.bbox_height > 0) {
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
        src={`http://localhost:5000/frame/${videoset}/${camera.replace('/','___')}/${timestamp}`}
        alt="interactive"
        style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
      />
      {boxes.map((box, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            border: '2px solid red',
            left: box.bbox_x*scale_factor,
            top: box.bbox_y*scale_factor,
            width: box.bbox_width*scale_factor,
            height: box.bbox_height*scale_factor,
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
            left: currentBox.bbox_width > 0 ? currentBox.bbox_x : currentBox.bbox_x + currentBox.bbox_width,
            top: currentBox.bbox_height > 0 ? currentBox.bbox_y : currentBox.bbox_y + currentBox.bbox_height,
            width: Math.abs(currentBox.bbox_width),
            height: Math.abs(currentBox.bbox_height),
          }}
        />
      )}
    </div>
  );
};

export default InteractiveImage;