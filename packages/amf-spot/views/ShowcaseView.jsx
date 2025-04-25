import React from 'react';
import Showcase from '../components/Showcase';

const ShowcaseView = () => {
  // Sample data - replace with your actual data
  const showcaseItems = [
    {
      id: 1,
      title: 'Acoustic Sessions',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Acoustic',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Acoustic',
      uploadedDate: 'Jan 15, 2025',
      type: 'video'
    },
    {
      id: 2,
      title: 'Studio Recordings',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Studio',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Studio',
      uploadedDate: 'Feb 3, 2025',
      type: 'audio'
    },
    {
      id: 3,
      title: 'Live Performance',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Live',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Live',
      uploadedDate: 'Mar 2, 2025',
      type: 'video'
    },
    {
      id: 4,
      title: 'Music Videos',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Videos',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Videos',
      uploadedDate: 'Feb 28, 2025',
      type: 'video'
    },
    {
      id: 5,
      title: 'Behind the Scenes',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=BTS',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=BTS',
      uploadedDate: 'Mar 15, 2025',
      type: 'video'
    },
    {
      id: 6,
      title: 'Album Artwork',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Album',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Album',
      uploadedDate: 'Jan 30, 2025',
      type: 'image'
    },
    {
      id: 7,
      title: 'Tour Photos',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Tour',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Tour',
      uploadedDate: 'Feb 15, 2025',
      type: 'image'
    },
    {
      id: 8,
      title: 'Interviews',
      image: 'https://via.placeholder.com/120/e3e3e3/111111?text=Interviews',
      thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Interviews',
      uploadedDate: 'Mar 5, 2025',
      type: 'video'
    },
  ];

  const handleItemClick = (item, index) => {
    console.log(`Item clicked: ${item.title} at index ${index}`);
    // Add your navigation logic here
  };

  return (
    <div className="dashboard-section">
      <Showcase 
        items={showcaseItems} 
        title="Showcase" 
        onItemClick={handleItemClick} 
      />
    </div>
  );
};

export default ShowcaseView;
