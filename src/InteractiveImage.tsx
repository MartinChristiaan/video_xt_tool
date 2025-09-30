import React, { useState, useRef, MouseEvent } from 'react';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface InteractiveImageProps {
  selectedLabel: string;
  timestamp:number;
}

const InteractiveImage: React.FC<InteractiveImageProps> = ({ selectedLabel,timestamp }) => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [currentBox, setCurrentBox] = useState<Omit<Box, 'label'> | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const getCoordinates = (e: MouseEvent<HTMLDivElement>): { x: number; y: number } | null => {
    if (!imageContainerRef.current) return null;
    const rect = imageContainerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setCurrentBox({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !currentBox) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const newWidth = coords.x - currentBox.x;
    const newHeight = coords.y - currentBox.y;

    setCurrentBox({
      ...currentBox,
      width: newWidth,
      height: newHeight,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;

    // To ensure width and height are positive, we adjust the x and y coordinates.
    const finalBox: Box = {
        x: currentBox.width > 0 ? currentBox.x : currentBox.x + currentBox.width,
        y: currentBox.height > 0 ? currentBox.y : currentBox.y + currentBox.height,
        width: Math.abs(currentBox.width),
        height: Math.abs(currentBox.height),
        label: selectedLabel,
    };

    if (finalBox.width > 0 && finalBox.height > 0) {
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
        src={`http://localhost:5000/frame/${timestamp}`}
        alt="interactive"
        style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
      />
      {boxes.map((box, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            border: '2px solid red',
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
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
            left: currentBox.width > 0 ? currentBox.x : currentBox.x + currentBox.width,
            top: currentBox.height > 0 ? currentBox.y : currentBox.y + currentBox.height,
            width: Math.abs(currentBox.width),
            height: Math.abs(currentBox.height),
          }}
        />
      )}
    </div>
  );
};

export default InteractiveImage;