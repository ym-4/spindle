// Token, userId and groupId is global in other js file
let tasks = [];
let taskItems = [];
let assigned = [];
let people = [];

window.addEventListener('DOMContentLoaded', async () => {
  // --------------
  // Fetch data
  // --------------

  await fetchGroupTasks();
  people = await fetchAllUsers();

  // Fetch task items for each task
  for (let i = 0; i < tasks.length; i++) {
    let currTaskId = tasks[i].id;
    let currTaskItems = await fetchGroupTaskItems(currTaskId);
    taskItems.push({
      taskId: currTaskId,
      items: currTaskItems,
    });
  }

  await fetchGroupTasksByAssignee();
  await fetchGroupMembers(groupId);

  console.log('===========================');
  console.log(tasks);
  console.log(taskItems);
  console.log(assigned);
  console.log(people);
  console.log('===========================');

  // --------------
  // Display Data
  // --------------
  displayGroupTasks();
  initializeSortable();

  attachAddSubtaskBtnListeners();
  addCreateTaskListeners();
});

// -------------------------------------------------------------------------------------
// Display functions
// -------------------------------------------------------------------------------------
function displayGroupTasks() {
  let todoCount = 0;
  let progressCount = 0;
  let doneCount = 0;

  const todo = document.querySelector('[data-status="todo"]');
  const progress = document.querySelector('[data-status="in_progress"]');
  const done = document.querySelector('[data-status="done"]');

  todo.innerHTML = '';
  progress.innerHTML = '';
  done.innerHTML = '';

  tasks.forEach((task) => {
    const taskData = taskItems.find((t) => t.taskId === task.id);

    const items = taskData ? taskData.items : [];

    const subtasks = items
      .map(
        (item) => `
      <div
        class="subtask ${item.completed ? 'completed' : ''}"
        data-id="${item.id}"
        data-task-id="${task.id}"
      >
        <i class="bi ${
          item.completed ? 'bi-check-square-fill text-success' : 'bi-square'
        } subtask-icon me-2"></i>

        <span>${item.text}</span>
      </div>
    `,
      )
      .join('');

    const total = items.length;

    const completed = items.filter((item) => item.completed).length;

    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    const cardColor =
      task.status === 'todo'
        ? 'note-yellow'
        : task.status === 'in_progress'
          ? 'note-blue'
          : 'note-green';

    const name = getAssigneeName(task);

    const html = `
      <div class="task-card ${cardColor}" draggable="true" data-id="${task.id}">

          <h6>${task.title}</h6>

          <div class="subtasks">
              ${items.length > 0 ? subtasks : `<p class="text-muted small mb-0">${task.description}</p>`}
          </div>

          <div class="task-footer">

              <div class="task-user">
                  <img
                      src="images/Groups_profile_${name === 'You' ? 1 : 2}.png"
                      class="rounded-circle"
                      width="24"
                      height="24"
                  >
                  <span>${name}</span>
              </div>

              <div class="task-date">
                  <i class="bi bi-clock"></i>
                  ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
              </div>

              <span class="badge bg-primary">
                  ${percent}%
              </span>

          </div>

      </div>
      `;

    switch (task.status) {
      case 'todo':
        todo.innerHTML += html;
        todoCount++;
        break;

      case 'in_progress':
        progress.innerHTML += html;
        progressCount++;
        break;

      case 'done':
        done.innerHTML += html;
        doneCount++;
        break;
    }
  });

  document.getElementById('todoNum').innerText = todoCount;
  document.getElementById('inProgressNum').innerText = progressCount;
  document.getElementById('doneNum').innerText = doneCount;

  attachSubtaskListeners();
}

// -------------------------------------------------------------------------------------
// Other functions
// -------------------------------------------------------------------------------------

function attachSubtaskListeners() {
  document.querySelectorAll('.subtask').forEach((subtask) => {
    subtask.onclick = toggleSubtask;
  });
}

function addCreateTaskListeners() {
  const createTaskBtn = document.getElementById('createTaskBtn');

  createTaskBtn.addEventListener('click', createTask);

  let temp = '';

  members.forEach((member) => {
    let curr = people.find((person) => person.id === member.user_id);

    temp += `<li><a class="dropdown-item" href="#">${curr.name}</a></li>`;
  });

  document.getElementById('dropdownMember').innerHTML = temp;

  const dropdownBtn = document.getElementById('assigneeDropdownBtn');

  document.querySelectorAll('#taskAssignee .dropdown-item').forEach((item) => {
    item.addEventListener('click', function (e) {
      e.preventDefault();

      dropdownBtn.textContent = this.textContent;

      dropdownBtn.dataset.value = this.textContent;
    });
  });
}

function attachAddSubtaskBtnListeners() {
  const container = document.getElementById('subtaskContainer');
  const addBtn = document.getElementById('addSubtaskBtn');

  addBtn?.addEventListener('click', () => {
    const div = document.createElement('div');

    div.className = 'input-group mb-2';

    div.innerHTML = `
            <input
                type="text"
                class="form-control subtask-input"
                placeholder="New subtask"
            >

            <button
                class="btn btn-outline-danger removeSubtaskBtn"
                type="button"
            >
                <i class="bi bi-trash"></i>
            </button>
        `;

    container.appendChild(div);
  });

  container?.addEventListener('click', (e) => {
    const btn = e.target.closest('.removeSubtaskBtn');

    if (!btn) return;

    btn.closest('.input-group').remove();
  });
}

// Update subtask
async function toggleSubtask(e) {
  const subtask = e.currentTarget;
  const taskItemId = subtask.dataset.id;
  const taskId = subtask.dataset.taskId;

  const completed = !subtask.classList.contains('completed');

  const data = {
    text: subtask.querySelector('span').textContent,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };

  try {
    await updateGroupTaskItems(data, taskItemId, taskId);

    subtask.classList.toggle('completed');

    const icon = subtask.querySelector('i');
    icon.classList.toggle('bi-square');
    icon.classList.toggle('bi-check-square-fill');
    icon.classList.toggle('text-success');

    await refreshTaskData();
    displayGroupTasks();

    displayToast('success', 'Task updated!');
  } catch (err) {
    displayToast('error', 'You did not create or get assigned to this task');
  }
}

// Dragging tasks
function initializeSortable() {
  document.querySelectorAll('.task-container').forEach((container) => {
    new Sortable(container, {
      group: 'tasks',
      animation: 150,
      ghostClass: 'dragging',

      onStart(evt) {
        document.querySelectorAll('.task-container').forEach((c) => {
          c.classList.add('drop-zone');
        });
      },

      onMove(evt) {
        document.querySelectorAll('.task-container').forEach((c) => {
          c.classList.remove('drop-hover');
        });

        evt.to.classList.add('drop-hover');
      },

      async onEnd(evt) {
        document.querySelectorAll('.task-container').forEach((c) => {
          c.classList.remove('drop-zone');
          c.classList.remove('drop-hover');
        });

        const taskId = evt.item.dataset.id;
        const newStatus = evt.to.dataset.status;

        await updateTaskStatus(taskId, newStatus);
      },
    });
  });
}

async function updateTaskStatus(taskId, status) {
  const task = tasks.find((t) => t.id == taskId);

  if (!task) return;

  const data = {
    title: task.title,
    description: task.description,
    assignee_id: task.assignee_id,
    due_date: task.due_date,
    status: status,
  };

  try {
    await updateGroupTasks(data, taskId);

    task.status = status;

    displayGroupTasks();

    displayToast('success', 'Task moved!');
  } catch (err) {
    displayToast('error', err.message);

    await refreshTaskData();
    displayGroupTasks();
  }
}

function getAssigneeName(task) {
  if (!task.assignee_id) return 'Unassigned';

  if (task.assignee_id == userId) return 'You';

  const user = people.find((u) => u.id == task.assignee_id);

  return user ? user.name : 'Unknown User';
}

async function refreshTaskData() {
  taskItems = [];

  await fetchGroupTasks();

  // Fetch task items for each task
  for (let i = 0; i < tasks.length; i++) {
    let currTaskId = tasks[i].id;
    let currTaskItems = await fetchGroupTaskItems(currTaskId);
    taskItems.push({
      taskId: currTaskId,
      items: currTaskItems,
    });
  }

  await fetchGroupTasksByAssignee();
}

async function createTask() {
  const title = document.getElementById('taskTitleInput').value.trim();
  const description = document.getElementById('taskDescriptionInput').value.trim();
  const assignee = document.getElementById('assigneeDropdownBtn').dataset.value;
  const dueDate = document.getElementById('taskDueDateInput').value;

  const subtasks = [...document.querySelectorAll('.subtask-input')]
    .map((input) => input.value.trim())
    .filter((text) => text !== '');

  if (!title || !description) {
    displayToast('warning', 'Please enter a task title and description.');
    return;
  }

  const data = {
    title,
    description,
    assignee_id: null,
    due_date: dueDate || null,
  };

  if (assignee) {
    const assignedUser = people.find((p) => p.name === assignee);

    if (assignedUser) {
      data.assignee_id = assignedUser.id;
    }
  }

  try {
    // Create task
    const newTask = await createGroupTasks(data);

    // Create subtasks only if there are any
    if (subtasks.length > 0) {
      for (const text of subtasks) {
        await createGroupTaskItems({ text }, newTask[0].id);
      }
    }

    await refreshTaskData();
    displayGroupTasks();
    resetCreateTaskModal();

    bootstrap.Modal.getInstance(document.getElementById('createTaskModal')).hide();

    document.getElementById('assigneeDropdownBtn').textContent = 'Assign Person';
    delete document.getElementById('assigneeDropdownBtn').dataset.value;

    displayToast('success', 'Task created successfully!');
  } catch (err) {
    console.error(err);
    displayToast('error', 'Failed to create task.');
  }
}

function resetCreateTaskModal() {
  // Clear text fields
  document.getElementById('taskTitleInput').value = '';
  document.getElementById('taskDescriptionInput').value = '';
  document.getElementById('taskDueDateInput').value = '';

  // Reset assignee dropdown
  const assigneeBtn = document.getElementById('assigneeDropdownBtn');
  assigneeBtn.textContent = 'Select member';
  delete assigneeBtn.dataset.value;

  // Reset subtasks to one empty input
  document.getElementById('subtaskContainer').innerHTML = `
    <div class="input-group mb-2">
      <input
        type="text"
        class="form-control subtask-input"
        placeholder="New subtask"
      >
      <button
        class="btn btn-outline-danger removeSubtaskBtn"
        type="button"
      >
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
}

// -------------------------------------------------------------------------------------
// Fetch functions
// -------------------------------------------------------------------------------------

// Get group tasks
async function fetchGroupTasks() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/tasks/group/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupTasks', responseData);

      if (responseStatus == 200) {
        tasks = responseData;
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// Get group tasks by assignee_id
async function fetchGroupTasksByAssignee() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/tasks/user/${groupId}/${userId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupTasksByAssignee', responseData);

      if (responseStatus == 200) {
        assigned = responseData;
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// Get group task items
async function fetchGroupTaskItems(task_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/taskItems/${task_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupTaskItems', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// -------------------------------------------------------------------------------------
// Create functions
// -------------------------------------------------------------------------------------

// Create group tasks
// data includes:
// Request body: description and title
// Optional: assignee_id and due_date
async function createGroupTasks(data) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/tasks/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('createGroupTasks', responseData);

      // message created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not a group member',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

// Create group task items
// data includes:
// Request body: text
// Optional: completed_by
async function createGroupTaskItems(data, task_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/taskItems/${task_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('createGroupTaskItems', responseData);

      // message created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not create the task',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

// -------------------------------------------------------------------------------------
// Update functions
// -------------------------------------------------------------------------------------

// Update group tasks
// data includes:
// Request body: description and title
// Optional: assignee_id, status and due_date
async function updateGroupTasks(data, task_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/tasks/${task_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupTasks', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not create the task',
        });

        // Task not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Task not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update group task items
// data includes:
// Request body: text
// Optional: completed_by, completed_at, completed
async function updateGroupTaskItems(data, task_item_id, task_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/taskItems/${task_id}/${task_item_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupTaskItems', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not create the task',
        });

        // Task not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Task not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// -------------------------------------------------------------------------------------
// Delete functions
// -------------------------------------------------------------------------------------

// Delete group tasks
async function deleteGroupTasks(task_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/tasks/${task_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupTasks', responseData);

      // task deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not create the task',
        });
        // Task not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Task not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

// Delete group task items
async function deleteGroupTaskItems(task_item_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groupTasks/taskItems/${task_item_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupTaskItems', responseData);

      // task deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not create the task',
        });
        // Task not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Task not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}
