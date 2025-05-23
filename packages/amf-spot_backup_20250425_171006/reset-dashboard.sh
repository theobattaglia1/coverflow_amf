#!/bin/bash

echo '⚠️ Replacing all dashboard files with clean verified versions...'

mkdir -p public/partner/dashboard

# INDEX
cat > public/partner/dashboard/index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Partner Dashboard</title>
  <link rel="stylesheet" href="dashboard.css" />
  <link rel="stylesheet" href="audioplayer.css" />
  <link rel="stylesheet" href="comment-styles.css" />
  <link rel="stylesheet" href="coverflow.css" />
  <link rel="stylesheet" href="showcase.css" />
</head>
<body>
  <main id="dashboard">
    <h1>Partner Dashboard</h1>

    <section id="coverflow-hero">
      <div class="coverflow-controls">
        <button id="grid-toggle">Grid</button>
        <button id="circle-toggle">Circle</button>
      </div>
      <div class="coverflow" id="coverflow-images"></div>
    </section>

    <section id="showcase-section">
      <h2>Showcase</h2>
      <div id="showcase"></div>
    </section>

    <section class="audio-section">
      <h2>Audio Preview</h2>
      <div id="audio-player"></div>
    </section>

    <section id="tasks-section">
      <h2>Tasks</h2>
      <div id="tasks"></div>
    </section>

    <section id="comments-section">
      <h2>Team Comments</h2>
      <div id="comments"></div>
    </section>

    <section id="images-section">
      <h2>Image Carousel</h2>
      <div id="carousel"></div>
    </section>

    <section id="events-section">
      <h2>Upcoming Events</h2>
    </section>
  </main>

  <script src="coverflow.js"></script>
  <script src="showcase.js"></script>
  <script src="dashboard.js"></script>
  <script src="audioplayer.js"></script>
</body>
</html>
HTML
