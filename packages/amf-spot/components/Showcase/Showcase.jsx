import React, { useState, useEffect } from 'react';
import './Showcase.css';

/**
 * Showcase Component
 * 
 * A circular carousel display for featuring artists/music content
 * Similar to Apple's coverflow but in a full circle arrangement
 */
const Showcase = ({ items = [], title = "Showcase", onItemClick }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Use a fixed set of items if none provided
  const defaultItems = [
    { id: 1, title: 'Acoustic Sessions', thumbnail: 'https://via.placeholder.com/120' },
    { id: 2, title: 'Studio Recordings', thumbnail: 'https://via.placeholder.com/120' },
    { id: 3, title: 'Live Performance', thumbnail: 'https://via.placeholder.com/120' },
    { id: 4, title: 'Music Videos', thumbnail: 'https://via.placeholder.com/120' },
    { id: 5, title: 'Behind the Scenes', thumbnail: 'https://via.placeholder.com/120' },
    { id: 6, title: 'Album Artwork', thumbnail: 'https://via.placeholder.com/120' },
    { id: 7, title: 'Tour Photos', thumbnail: 'https://via.placeholder.com/120' },
    { id: 8, title: 'Interviews', thumbnail: 'https://via.placeholder.com/120' },
  ];
  
  const displayItems = items.length > 0 ? items : defaultItems;
  const itemCount = displayItems.length;
  
  // Animate rotation on render
  useEffect(() => {
    const container = document.querySelector('.showcase-container');
    if (container) {
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }
  }, []);

  // Handle when an item is clicked
  const handleItemClick = (index) => {
    setActiveIndex(index);
    if (onItemClick) {
      onItemClick(displayItems[index], index);
    }
  };

  // Calculate position for each item in the circle
  const getItemStyle = (index) => {
    // Full 360-degree circle layout
    const degreesPerItem = 360 / itemCount;
    const rotation = index * degreesPerItem;
    const isActive = index === activeIndex;
    
    // Calculate the radius based on container size
    const radius = 200; // Larger radius for better spacing
    
    // Convert polar coordinates to Cartesian
    const x = radius * Math.sin(rotation * Math.PI / 180);
    const y = -radius * Math.cos(rotation * Math.PI / 180);
    
    // Move the center items forward for a "coverflow" effect
    const zIndex = isActive ? 10 : Math.abs(((index - activeIndex + itemCount) % itemCount) - itemCount/2);

    return {
      transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${isActive ? 1.2 : 1})`,
      zIndex: zIndex,
      opacity: isActive ? 1 : 0.8,
      transition: 'all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)'
    };
  };

  // Toggle play/pause for media items
  const togglePlayPause = (e, index) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
    setActiveIndex(index);
  };

  return (
    <div className="showcase-wrapper">
      <h2 className="showcase-title">{title}</h2>
      
      <div className="showcase-container">
        <div className="center-content">
          <h3>Artwork {displayItems[activeIndex]?.title || 'A'}</h3>
          <p>Uploaded: {displayItems[activeIndex]?.uploadedDate || 'N/A'}</p>
          <button className="view-collection-btn">View Collection</button>
        </div>
        
        {displayItems.map((item, index) => (
          <div 
            key={`showcase-item-${index}`}
            className={`showcase-item ${activeIndex === index ? 'active' : ''}`}
            style={getItemStyle(index)}
            onClick={() => handleItemClick(index)}
          >
            <div className="item-content">
              <img 
                src={item.image || item.thumbnail} 
                alt={item.title || `Item ${index + 1}`} 
                className="item-image"
              />
              
              {/* Add play button overlay for media items */}
              {item.type === 'video' && (
                <div 
                  className="play-button-overlay"
                  onClick={(e) => togglePlayPause(e, index)}
                >
                  <div className={`play-icon ${isPlaying && activeIndex === index ? 'pause' : 'play'}`}></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Showcase;
