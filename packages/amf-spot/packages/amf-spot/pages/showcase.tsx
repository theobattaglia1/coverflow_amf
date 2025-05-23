import React, { useState } from 'react';

interface Item {
  id: number;
  title: string;
  image: string;
}

const Showcase: React.FC = () => {
  // Example data — replace with your own images/titles
  const items: Item[] = [
    { id: 1, title: 'Item One',   image: 'https://via.placeholder.com/80?text=1' },
    { id: 2, title: 'Item Two',   image: 'https://via.placeholder.com/80?text=2' },
    { id: 3, title: 'Item Three', image: 'https://via.placeholder.com/80?text=3' },
    { id: 4, title: 'Item Four',  image: 'https://via.placeholder.com/80?text=4' },
    { id: 5, title: 'Item Five',  image: 'https://via.placeholder.com/80?text=5' },
    { id: 6, title: 'Item Six',   image: 'https://via.placeholder.com/80?text=6' },
    { id: 7, title: 'Item Seven', image: 'https://via.placeholder.com/80?text=7' },
    { id: 8, title: 'Item Eight', image: 'https://via.placeholder.com/80?text=8' },
  ];

  const [selectedItem, setSelectedItem] = useState<Item>(items[0]);

  // Circle config
  const radius = 200; // Distance from center
  const centerX = 0;  // We'll use CSS to center the container
  const centerY = 0;

  return (
    <div style={{ minHeight: '100vh', background: '#222', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', color: '#fff' }}>Showcase Demo</h1>
      
      <div style={styles.container}>
        {items.map((item, index) => {
          const angle = (360 / items.length) * index;
          const rad = (Math.PI / 180) * angle;
          const x = centerX + radius * Math.cos(rad);
          const y = centerY + radius * Math.sin(rad);

          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onClick={() => setSelectedItem(item)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform =
                  'translate(-50%, -50%) scale(1.2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform =
                  'translate(-50%, -50%) scale(1.0)';
              }}
            >
              <img 
                src={item.image} 
                alt={item.title} 
                style={{ borderRadius: '8px' }}
              />
            </div>
          );
        })}

        <div style={styles.centerCard}>
          <img 
            src={selectedItem.image} 
            alt={selectedItem.title} 
            style={{
              width: '120px',
              height: '120px',
              objectFit: 'cover',
              borderRadius: '8px',
            }}
          />
          <h2 style={{ color: '#fff', marginTop: '0.5rem' }}>{selectedItem.title}</h2>
          <button
            style={{
              padding: '0.5rem 1rem',
              background: '#fff',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
              fontWeight: 'bold',
              marginTop: '0.5rem',
            }}
            onClick={() => alert(\`View collection for \${selectedItem.title}!\`)}
          >
            View Collection
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
    width: '600px',
    height: '600px',
    margin: '2rem auto',
    border: '1px solid #555',
    borderRadius: '50%',
    overflow: 'visible',
  },
  centerCard: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '180px',
    height: 'auto',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    border: '1px solid #444',
    padding: '1rem',
    borderRadius: '8px',
  },
};

export default Showcase;
