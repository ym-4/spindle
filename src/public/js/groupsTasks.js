document.querySelectorAll('.subtask').forEach((subtask) => {
  subtask.addEventListener('click', () => {
    subtask.classList.toggle('completed');

    const icon = subtask.querySelector('i');
    icon.classList.toggle('bi-square');
    icon.classList.toggle('bi-check-square-fill');

    if (icon.classList.contains('bi-square')) {
      icon.classList.remove('text-success');
    } else {
      icon.classList.add('text-success');
    }
  });
});

document.querySelectorAll('.task-container').forEach((container) => {
  new Sortable(container, {
    group: 'tasks',
    animation: 150,
    ghostClass: 'dragging',

    onEnd(evt) {
      const task = evt.item;
      const newColumn = evt.to.closest('.kanban-column');

      // Update backend here
    },
  });
});
