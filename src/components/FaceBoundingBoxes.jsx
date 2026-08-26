import React from 'react';

/**
 * FaceBoundingBoxes component renders bounding boxes over an image or video frame.
 * Props:
 *   - boxes: Array of objects { x, y, width, height, confidence, swapProbability }
 *   - mediaUrl (optional): URL of the media to display behind the boxes.
 *   - mediaType: 'image' | 'video' (default 'image')
 */
export default function FaceBoundingBoxes({ boxes = [], mediaUrl, mediaType = 'image' }) {
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: 'auto',
    backgroundColor: '#0f172a', // match dark theme
  };

  return (
    <div style={containerStyle} className="face-bounding-boxes-container">
      {mediaUrl && mediaType === 'image' && (
        <img src={mediaUrl} alt="media" style={{ width: '100%', display: 'block' }} />
      )}
      {mediaUrl && mediaType === 'video' && (
        <video src={mediaUrl} controls style={{ width: '100%' }} />
      )}
      {boxes.map((box, idx) => {
        const { x, y, width, height, confidence = 0, swapProbability = 0 } = box;
        const style = {
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: `${width}%`,
          height: `${height}%`,
          border: '2px solid rgba(255,0,0,0.8)',
          boxSizing: 'border-box',
        };
        const labelStyle = {
          position: 'absolute',
          left: 0,
          top: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: '0.7rem',
          padding: '2px 4px',
          borderRadius: '2px',
        };
        return (
          <div key={idx} style={style}>
            <div style={labelStyle}>
              {`Conf: ${(confidence * 100).toFixed(0)}% | Swap: ${(swapProbability * 100).toFixed(0)}%`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
