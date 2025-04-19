;(async function() {
  const apiBase = '/api/tasks'
  const artistHeader = { 'X-Artist-ID': 'default', 'Content-Type': 'application/json' }

  // DOM refs
  const form      = document.getElementById('task-form')
  const titleIn   = document.getElementById('task-title')
  const descIn    = document.getElementById('task-desc')
  const dueIn     = document.getElementById('task-due')
  const listEl    = document.getElementById('task-list')
  const statusEl  = document.getElementById('task-status')

  // Load & render all tasks
  async function loadTasks() {
    statusEl.textContent = 'Loading…'
    try {
      const res = await fetch(apiBase, { headers: { 'X-Artist-ID': 'default' } })
      const tasks = await res.json()
      renderTasks(tasks)
      statusEl.textContent = ''
    } catch (err) {
      console.error('Failed to load tasks', err)
      statusEl.textContent = 'Error loading tasks'
    }
  }

  // Render task list
  function renderTasks(tasks) {
    listEl.innerHTML = ''
    if (!tasks.length) {
      listEl.innerHTML = '<li>No tasks yet</li>'
      return
    }
    tasks.forEach(t => {
      const li = document.createElement('li')
      li.dataset.id = t.id
      li.innerHTML = `
        <strong>${t.title}</strong><br/>
        <span>${t.description || ''}</span><br/>
        <em>Due: ${t.dueDate || '—'}</em>
        <div class="actions">
          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
        </div>
      `
      listEl.appendChild(li)
    })
  }

  // Handle Edit/Delete clicks
  listEl.addEventListener('click', async (e) => {
    const li = e.target.closest('li')
    if (!li) return
    const id = li.dataset.id

    // Delete
    if (e.target.classList.contains('delete')) {
      if (!confirm('Delete this task?')) return
      await fetch(`${apiBase}/${id}`, {
        method: 'DELETE',
        headers: { 'X-Artist-ID': 'default' }
      })
      return loadTasks()
    }

    // Edit
    if (e.target.classList.contains('edit')) {
      const newTitle = prompt('Title', li.querySelector('strong').textContent)
      if (newTitle == null) return
      const newDesc  = prompt('Description', li.querySelector('span').textContent)
      const newDue   = prompt('Due date', li.querySelector('em').textContent.replace(/^Due:\s*/, ''))
      await fetch(`${apiBase}/${id}`, {
        method: 'PUT',
        headers: artistHeader,
        body: JSON.stringify({ title: newTitle, description: newDesc, dueDate: newDue })
      })
      return loadTasks()
    }
  })

  // Handle new‐task form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const payload = {
      title:       titleIn.value.trim(),
      description: descIn.value.trim(),
      dueDate:     dueIn.value.trim()
    }
    if (!payload.title) {
      alert('Title is required')
      return
    }
    await fetch(apiBase, {
      method: 'POST',
      headers: artistHeader,
      body: JSON.stringify(payload)
    })
    titleIn.value = descIn.value = dueIn.value = ''
    loadTasks()
  })

  // Initial load
  loadTasks()
})()
