import React, { useEffect, useState } from 'react';
import Showcase from '../components/Showcase';

const ShowcaseView = () => {
  const [showcaseItems, setShowcaseItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulating API fetch - replace with your actual API call
    const fetchShowcaseItems = async () => {
      try {
        setLoading(true);
        // Placeholder data for demonstration
        const data = [
          {
            id: 1,
            title: 'Acoustic Sessions',
            image: '/images/acoustic.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Acoustic',
            uploadedDate: 'Jan 15, 2025',
            type: 'video'
          },
          {
            id: 2,
            title: 'Studio Recordings',
            image: '/images/studio.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Studio',
            uploadedDate: 'Feb 3, 2025',
            type: 'audio'
          },
          {
            id: 3,
            title: 'Live Performance',
            image: '/images/live.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Live',
            uploadedDate: 'Mar 2, 2025',
            type: 'video'
          },
          {
            id: 4,
            title: 'Music Videos',
            image: '/images/music-videos.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Videos',
            uploadedDate: 'Feb 28, 2025',
            type: 'video'
          },
          {
            id: 5,
            title: 'Behind the Scenes',
            image: '/images/bts.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=BTS',
            uploadedDate: 'Mar 15, 2025',
            type: 'video'
          },
          {
            id: 6,
            title: 'Album Artwork',
            image: '/images/album.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Album',
            uploadedDate: 'Jan 30, 2025',
            type: 'image'
          },
          {
            id: 7,
            title: 'Tour Photos',
            image: '/images/tour.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Tour',
            uploadedDate: 'Feb 15, 2025',
            type: 'image'
          },
          {
            id: 8,
            title: 'Interviews',
            image: '/images/interviews.jpg',
            thumbnail: 'https://via.placeholder.com/120/e3e3e3/111111?text=Interviews',
            uploadedDate: 'Mar 5, 2025',
            type: 'video'
          },
        ];
        
        setShowcaseItems(data);
      } catch (error) {
        console.error('Error fetching showcase items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShowcaseItems();
  }, []);

  const handleShowcaseItemClick = (item, index) => {
    console.log(`Showcase item clicked: ${item.title} at index ${index}`);
    // Add your navigation or detail view logic here
  };

  if (loading) {
    return <div className="loading">Loading showcase items...</div>;
  }

  return (
    <div className="dashboard-section">
      <Showcase 
        items={showcaseItems} 
        title="Featured Content" 
        onItemClick={handleShowcaseItemClick} 
      />
    </div>
  );
};

export default ShowcaseView;
