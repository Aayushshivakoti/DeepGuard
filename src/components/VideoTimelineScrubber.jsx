import React, { useRef, useState } from "react";
import "./VideoTimelineScrubber.css";

/**
 * Props:
 *  - videoSrc: string (URL of the video)
 *  - riskFrames: Array<{ frame: number; risk: "low" | "medium" | "high" }>
 *  - onSeek?: (frame: number) => void   // optional external callback
 */
export default function VideoTimelineScrubber({ videoSrc, riskFrames = [], onSeek }) {
  const videoRef = useRef(null);
  const timelineRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [hoverInfo, setHoverInfo] = useState(null);

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const markers = riskFrames.map((item) => ({
    percent: duration ? (item.frame / (duration * 30)) * 100 : 0,
    risk: item.risk,
  }));

  const riskColor = {
    low: "var(--risk-low, #10b981)",
    medium: "var(--risk-medium, #fbbf24)",
    high: "var(--risk-high, #ef4444)",
  };

  const seekToFraction = (fraction) => {
    if (videoRef.current) {
      videoRef.current.currentTime = fraction * duration;
      const frame = Math.round(fraction * duration * 30);
      if (onSeek) onSeek(frame);
    }
  };

  const handleClick = (e) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    seekToFraction(Math.max(0, Math.min(1, fraction)));
  };

  const handleMouseMove = (e) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    const time = fraction * duration;
    const nearest = riskFrames.reduce(
      (prev, cur) =>
        Math.abs(cur.frame - time * 30) < Math.abs(prev.frame - time * 30) ? cur : prev,
      riskFrames[0] || { frame: 0, risk: "low" }
    );
    setHoverInfo({ x, risk: nearest.risk, time: time.toFixed(1) });
  };

  const clearHover = () => setHoverInfo(null);

  return (
    <div className="video-timeline-scrubber">
      <video
        ref={videoRef}
        src={videoSrc}
        controls
        onLoadedMetadata={handleLoadedMetadata}
        className="scrubber-video"
      />
      <div
        className="timeline-bar"
        ref={timelineRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={clearHover}
      >
        {markers.map((m, i) => (
          <div
            key={i}
            className="marker"
            style={{ left: `${m.percent}%`, backgroundColor: riskColor[m.risk] }}
          />
        ))}
        {hoverInfo && (
          <div className="tooltip" style={{ left: hoverInfo.x }}>
            {`${hoverInfo.risk.toUpperCase()} – ${hoverInfo.time}s`}
          </div>
        )}
      </div>
    </div>
  );
}
