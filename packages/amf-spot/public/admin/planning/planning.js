(async ()=>{
  const apiBase = '/api/tasks';
  const artistHeader = { 'X-Artist-ID': 'default' };
  const taskInput = document.getElementById('taskInput');
  const addBtn = document.getElementById('addTaskBtn');
  const listContainer = document.getElementById('taskList');

  async function loadTasks(){
    const res = await fetch(apiBase + '?status=all', { headers: artistHeader });
    const tasks = await res.json();
    listContainer.innerHTML = '';
    tasks.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t.text;
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        await fetch(\`\${apiBase}/\${t.id}\`, {
          method: 'DELETE',
          headers: artistHeader
        });
        await loadTasks();
      });
      li.appendChild(del);
      listContainer.appendChild(li);
    });
  }

  addBtn.addEventListener('click', async () => {
    const text = taskInput.value.trim();
    if (!text) return;
    const id = Date.now().toString();
    await fetch(apiBase, {
      method: 'POST',
      headers: { ...artistHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text, status: 'pending' })
    });
    taskInput.value = '';
    await loadTasks();
  });

  await loadTasks();
})();
