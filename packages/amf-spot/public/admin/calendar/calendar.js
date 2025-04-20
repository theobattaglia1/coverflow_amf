// public/admin/calendar/calendar.js

console.log('[CLIENT] calendar.js start');

(async function loadEvents() {
  console.log('[CLIENT] loadEvents()');

  try {
    console.log('[CLIENT] fetching /api/calendar-events');
    const resp = await fetch('/api/calendar-events', {
      credentials: 'same-origin' // send our HttpOnly cookie
    });
    console.log('[CLIENT] /api/calendar-events status=', resp.status);

    if (resp.status === 401) {
      console.log('[CLIENT] not authorized, redirecting to /auth/google');
      return window.location.href = '/auth/google';
    }

    if (!resp.ok) {
      console.error('[CLIENT] /api/calendar-events returned error:', await resp.text());
      throw new Error('Fetch events failed');
    }

    const events = await resp.json();
    console.log('[CLIENT] event data=', events);

    const container = document.getElementById('eventsContainer');
    container.innerHTML = ''; // clear loading message

    if (!Array.isArray(events) || events.length === 0) {
      console.log('[CLIENT] no upcoming events');
      container.innerHTML = '<p>No upcoming events found.</p>';
    } else {
      console.log('[CLIENT] rendering', events.length, 'events');
      const ul = document.createElement('ul');
      events.forEach(e => {
        const when = e.start.dateTime || e.start.date || '—';
        const li = document.createElement('li');
        li.textContent = `${new Date(when).toLocaleString()} — ${e.summary || '(No title)'}`;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

  } catch (err) {
    console.error('[CLIENT] loadEvents() caught error:', err);
    const container = document.getElementById('eventsContainer');
    container.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
})();
