// File: packages/amf-spot/public/hudson-ingram/dashboard/audioplayer.js

console.log('[AudioPlayer] Initializing...');

document.addEventListener('do-you-remember.m4aMContentLoaded', async () => {
  console.log('[AudioPlayer] do-you-remember.m4aM loaded');
  await initializeAudioPlayer();
});

async function initializeAudioPlayer() {
  const artist = window.location.pathname.split('/')[1];
  const container = document.querySelector('#audio-player');
  container.innerHTML = '<h2>Audio Player</h2>';

  console.log('[AudioPlayer] Creating audio player section');

  try {
    const data = await fetchJSON(`/api/${artist}/audio-files`);
    console.log('[AudioPlayer] Audio data received:', data);
    const playlists = organizeTracks(data.files);
    console.log('[AudioPlayer] Tracks organized into playlists:', playlists);
    renderPlaylist(container, playlists.showcase || []);
  } catch (err) {
    console.error('[AudioPlayer] Error loading audio data', err);
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.json();
}

function organizeTracks(files) {
  const showcase = files?.filter(f => f.tags?.includes('showcase')) || [];
  const archive = files?.filter(f => f.tags?.includes('archive')) || [];
  const singles = files?.filter(f => f.tags?.includes('single')) || [];
  return { showcase, archive, singles };
}

function renderPlaylist(container, tracks) {
  console.log('[AudioPlayer] Rendering playlist:', tracks);
  if (!Array.isArray(tracks)) return;

  const list = document.createElement('ul');
  list.className = 'audio-track-list';

  tracks.forEach((track, idx) => {
    const item = document.createElement('li');
    item.className = 'audio-track-item';
    item.textContent = `${idx + 1}. ${track.title || 'Untitled'}`;

    item.onclick = () => {
      playTrack(track);
    };

    list.appendChild(item);
  });

  container.appendChild(list);
}

function playTrack(track) {
  console.log('[AudioPlayer] Playing track:', track);

  const audio = document.querySelector('audio') || document.createElement('audio');
  audio.src = sanitizeFileName(track.url);
  audio.controls = true;
  document.querySelector('#audio-player').appendChild(audio);
  audio.play();
}

function sanitizeFileName(path) {
  return encodeURI(path).replace(/\\?/g, '');
}
