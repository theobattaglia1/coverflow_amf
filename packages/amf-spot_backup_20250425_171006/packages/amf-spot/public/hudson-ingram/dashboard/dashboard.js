// File: packages/amf-spot/public/hudson-ingram/dashboard/dashboard.js

console.log('[Dashboard] Script loaded');

document.addEventListener('do-you-remember.m4aMContentLoaded', async () => {
  console.log('[Dashboard] do-you-remember.m4aM loaded');

  const artist = window.location.pathname.split('/')[1];

  try {
    const [tasks, comments, images, events] = await Promise.all([
      fetchJSON(`/api/${artist}/tasks`),
      fetchJSON(`/api/${artist}/comments`),
      fetchJSON(`/api/${artist}/image-files`),
      fetchJSON(`/api/${artist}/calendar-events`)
    ]);

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
  container.innerHTML = '';

  const manager = document.createElement('div');
  manager.textContent = `Manager: ${data?.manager ?? 'undefined'}`;
  container.appendChild(manager);

  const producer = document.createElement('div');
  producer.textContent = `Producer: ${data?.producer ?? 'undefined'}`;
  container.appendChild(producer);
}

function renderImages(imageData) {
  if (!Array.isArray(imageData?.files)) {
    console.warn('[Dashboard] unexpected payload for images', imageData);
    return;
  }

  const container = document.querySelector('#carousel');
  container.innerHTML = '';

  imageData.files.forEach(file => {
    const img = document.createElement('img');
    img.src = `/images/${file}`;
    img.className = 'carousel-img';
    container.appendChild(img);
  });
}

function renderEvents(events) {
  const container = document.querySelector('#events-section');
  container.innerHTML = '';

  (events || []).forEach(ev => {
    const el = document.createElement('div');
    el.className = 'event';
    el.textContent = `${ev.date ?? 'TBD'} — ${ev.description ?? 'No details'}`;
    container.appendChild(el);
  });
}
