import React from 'react';
import ShowcaseView from './views/ShowcaseView';

function App() {
  return (
    <div className="app">
      <h1>Partner Dashboard</h1>
      <div className="view-controls">
        <button>Grid</button>
        <button>Circle</button>
      </div>
      <ShowcaseView />
    </div>
  );
}

export default App;
