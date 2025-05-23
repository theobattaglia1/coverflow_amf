import React, { useState, useEffect, useRef } from 'react';

// Utility to clamp values
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(val, max));
}

// Single placeholder for brevity
const placeholder = 'https://allmyfriendsinc.com/uploads/444a59dfe2a66aa5224c7038f7539b15';

// 7 items on each side
const leftArcItems = [
  { id: 1, title: 'Left A', image: placeholder },
  { id: 2, title: 'Left B', image: placeholder },
  { id: 3, title: 'Left C', image: placeholder },
  { id: 4, title: 'Left D', image: placeholder },
  { id: 5, title: 'Left E', image: placeholder },
  { id: 6, title: 'Left F', image: placeholder },
  { id: 7, title: 'Left G', image: placeholder },
];

const rightArcItems = [
  { id: 8,  title: 'Right A', image: placeholder },
  { id: 9,  title: 'Right B', image: placeholder },
  { id: 10, title: 'Right C', image: placeholder },
  { id: 11, title: 'Right D', image: placeholder },
  { id: 12, title: 'Right E', image: placeholder },
  { id: 13, title: 'Right F', image: placeholder },
  { id: 14, title: 'Right G', image: placeholder },
];

// If you need small dx/dy nudges per item, define them here:
const leftArcNudges = Array(7).fill({ dx: 0, dy: 0 });
const rightArcNudges = Array(7).fill({ dx: 0, dy: 0 });

export default function Showcase() {
  const [selectedItem, setSelectedItem] = useState(leftArcItems[0]);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container on mount + resize
  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
        setHeight(containerRef.current.offsetHeight);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // The “north star” radius, based on smallest dimension:
  // we can make it bigger (~0.45) so arcs push out near edges top/bottom
  const r = 0.45 * Math.min(width, height);

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>( ) Demo: Edges + Bigger Items</h1>

      <div ref={containerRef} style={styles.container}>
        {/** 
         LEFT ARC: angles from -70..+70 => narrower vertical spread 
         (less top/bottom space), 
         centerX ~ 0.1W => near left edge
         */}
        {renderArc(
          leftArcItems,
          leftArcNudges,
          -70,   // startAngle
          70,    // endAngle
          0.1 * width,
          0.5 * height,
          r,
          setSelectedItem
        )}

        {/**
         RIGHT ARC: angles from +110..+250 => “)” shape
         centerX ~ 0.9W => near right edge
        */}
        {renderArc(
          rightArcItems,
          rightArcNudges,
          110,
          250,
          0.9 * width,
          0.5 * height,
          r,
          setSelectedItem
        )}

        {/**
         Center card: if you want it smaller, do e.g. 0.5*r; bigger => 0.8*r
         Also clamp so it doesn’t get too small or large.
        */}
        <div
          style={{
            ...styles.centerCard,
            left: width / 2,
            top: height / 2,
            width: clamp(0.5 * r, 120, 500),
          }}
        >
          <img
            src={selectedItem.image}
            alt={selectedItem.title}
            style={{
              width: '90%',
              borderRadius: 4,
              display: 'block',
              margin: '0 auto',
            }}
          />
          <h2 style={{ color: '#333', marginTop: '0.5rem', textAlign: 'center' }}>
            {selectedItem.title}
          </h2>
          <button
            style={styles.button}
            onClick={() => alert(`View collection for ${selectedItem.title}`)}
          >
            View Collection
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders items on a half-circle from startAngle..endAngle (in degrees).
 * center=(cx, cy), radius=r, plus optional dx/dy from arcNudges for small manual adjustments.
 * We'll make items bigger => e.g. itemWidth=0.3*r => clamp that to avoid extremes.
 */
function renderArc(
  items: { id: number; title: string; image: string }[],
  nudges: { dx: number; dy: number }[],
  startDeg: number,
  endDeg: number,
  cx: number,
  cy: number,
  r: number,
  setSelectedItem: React.Dispatch<React.SetStateAction<{ id: number; title: string; image: string }>>
) {
  if (!items.length || r <= 0) return null;

  const steps = items.length - 1;
  const angleStep = (endDeg - startDeg) / steps;

  return items.map((item, i) => {
    const angleDeg = startDeg + angleStep * i;
    const rad = (Math.PI / 180) * angleDeg;

    let x = cx + r * Math.cos(rad);
    let y = cy + r * Math.sin(rad);

    // optional small nudge for this item
    x += nudges[i].dx;
    y += nudges[i].dy;

    return (
      <div
        key={item.id}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: 'translate(-50%, -50%)',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onClick={() => setSelectedItem(item)}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform =
            'translate(-50%, -50%) scale(1.15)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform =
            'translate(-50%, -50%) scale(1.0)';
        }}
      >
        {/* 
          Make items bigger => e.g. 0.3*r 
          Then clamp so they don't get too huge or tiny:
        */}
        <img
          src={item.image}
          alt={item.title}
          style={{
            width: clamp(0.3 * r, 80, 300),
            borderRadius: '6px',
          }}
        />
      </div>
    );
  });
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    padding: 0,
    textAlign: 'center',
    overflow: 'hidden',
  },
  title: {
    marginBottom: '1rem',
  },
  container: {
    width: '100vw',
    height: 'min(90vmin, 900px)',
    minWidth: '700px',
    minHeight: '600px',
    margin: '0 auto',
    position: 'relative',
    background: '#f8f8f8',
  },
  centerCard: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    background: '#fff',
    borderRadius: 6,
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    padding: '1rem',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.5rem 1rem',
    background: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
};
