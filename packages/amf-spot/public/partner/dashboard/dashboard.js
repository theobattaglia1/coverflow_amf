// FILE: dashboard.js

console.log('[Dashboard] Script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Dashboard] DOM loaded');
  const artist = window.location.pathname.split('/')[1];

  try {
    const [tasksRes, comments, images, eventsRes] = await Promise.all([
    ]);

    const tasks = tasksRes.tasks ?? tasksRes;
    const events = eventsRes.events ?? eventsRes;

    renderTasks(tasks);
    renderComments(comments);
    renderImages(images);
    renderEvents(events);
  } catch (err) {
    console.error('[Dashboard] Error loading data', err);
  }
});

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return await res.json();
}

function renderTasks(tasks) {
  const container = document.querySelector('#tasks');
  if (!container) return;
  container.innerHTML = '';

  (tasks?.slice(0, 5) || []).forEach(task => {
    const el = document.createElement('div');
    el.className = 'task';
    el.textContent = task.title || '[No Title]';
    container.appendChild(el);
  });
}

function renderComments(data) {
  const container = document.querySelector('#comments');
  if (!container) return;
  container.innerHTML = '';

  const manager = document.createElement('div');
  manager.textContent = `Manager: ${data?.manager ?? 'undefined'}`;
  container.appendChild(manager);

  const producer = document.createElement('div');
  producer.textContent = `Producer: ${data?.producer ?? 'undefined'}`;
  container.appendChild(producer);
}

function renderImages(imageData) {
  const container = document.querySelector('#carousel');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(imageData?.files)) {
    console.warn('[Dashboard] unexpected payload for images', imageData);
    return;
  }

  imageData.files.forEach(file => {
    const src = typeof file === 'string' ? `/images/${file}` : file.url || '/images/fallback.jpg';
    const img = document.createElement('img');
    img.src = src;
    img.className = 'carousel-img';
    container.appendChild(img);
  });
}

function renderEvents(events) {
  const container = document.querySelector('#events-section');
  if (!container) return;
  container.innerHTML = '';

  (events || []).forEach(ev => {
    const el = document.createElement('div');
    el.className = 'event';
    el.textContent = `${ev.date ?? 'TBD'} — ${ev.description ?? 'No details'}`;
    container.appendChild(el);
  });
}
