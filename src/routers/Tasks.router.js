const express = require('express');
const router = express.Router();

const {
  getAllTasks,
  getTasksByGroupID,
  getTasksByUserAndGroupID,
  insertTasks,
  updateTasks,
  deleteTasks,
  getAllTaskItems,
  getTaskItemsByTaskID,
  getTaskItemsByUserAndGroupID,
  insertTaskItems,
  updateTaskItems,
  deleteTaskItems,
  getTasksByUserID,
  getTasksByTaskID,
} = require('../models/Tasks.model');
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { getGroupMemberByGroupID } = require('../models/Groups.model');

// ------------------------------------------------------------------
// 							Tasks
// ------------------------------------------------------------------
// GET all tasks
router.get('/tasks', (req, res, next) => {
  getAllTasks()
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// GET tasks by group_id
router.get('/tasks/group/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getTasksByGroupID(data)
    .then((group) => res.status(200).json(group))
    .catch(next);
});

// GET tasks by assignee_id and group_id
router.get('/tasks/user/:group_id/:user_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
    user_id: req.params.user_id,
  };

  getTasksByUserAndGroupID(data)
    .then((group) => res.status(200).json(group))
    .catch(next);
});

// CREATE tasks
// Request body: description and title
// Optional: assignee_id and due_date
router.post('/tasks/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.description == undefined || req.body.title == undefined) {
    res.status(400).json({ message: 'Error: description or title is undefined' });
    return;
  }

  const data = {
    creator_id: req.user.id,
    description: req.body.description,
    title: req.body.title,
    group_id: req.params.group_id,
    assignee_id: req.body.assignee_id || null,
    due_date: req.body.due_date || null,
  };

  // Check that user is in group
  getGroupMemberByGroupID(data)
    .then((members) => {
      if (members.some((member) => member.user_id === data.creator_id)) {
        insertTasks(data)
          .then((results) => {
            res.status(201).json(results);
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'You are not a member of this group' });
      }
    })
    .catch(next);
});

// UPDATE tasks
// Request body: description and title
// Optional: assignee_id, status and due_date
router.put('/tasks/:id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.description == undefined || req.body.title == undefined) {
    res.status(400).json({ message: 'Error: description or title is undefined' });
    return;
  }

  const data = {
    creator_id: req.user.id,
    description: req.body.description,
    title: req.body.title,
    id: req.params.id,
    assignee_id: req.body.assignee_id || null,
    due_date: req.body.due_date || null,
    status: req.body.status,
  };

  // Check that user created the task or is assigned to the task
  getTasksByTaskID(data)
    .then((tasks) => {
      if (tasks.length === 0) {
        return res.status(404).json({ message: 'Task not found' });
      }
      if (tasks[0].creator_id === data.creator_id || tasks[0].assignee_id === data.creator_id) {
        updateTasks(data)
          .then((results) => {
            res.status(200).json(results);
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'You did not create or get assigned to this task' });
      }
    })
    .catch(next);
});

// DELETE tasks
router.delete('/tasks/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
    creator_id: req.user.id,
  };

  // Check that user created the task
  getTasksByUserID(data)
    .then((tasks) => {
      if (tasks.length > 0) {
        deleteTasks(data)
          .then((results) => {
            res.status(204).json();
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'You did not create this task' });
      }
    })
    .catch(next);
});

// ------------------------------------------------------------------
// 				        	Task Items
// ------------------------------------------------------------------
// GET all task items
router.get('/taskItems', (req, res, next) => {
  getAllTaskItems()
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// GET task items by task_id
router.get('/taskItems/:task_id', (req, res, next) => {
  const data = {
    task_id: req.params.task_id,
  };

  getTaskItemsByTaskID(data)
    .then((group) => res.status(200).json(group))
    .catch(next);
});

// CREATE task item
// Request body: text
// Optional: completed_by
router.post('/taskItems/:task_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.text == undefined) {
    res.status(400).json({ message: 'Error: text is undefined' });
    return;
  }

  const data = {
    creator_id: req.user.id,
    text: req.body.text,
    task_id: req.params.task_id,
    completed_by: req.body.completed_by || null,
  };

  // Check that user created the task
  getTasksByUserID({ id: data.task_id, creator_id: data.creator_id })
    .then((tasks) => {
      if (tasks.length > 0) {
        insertTaskItems(data)
          .then((results) => {
            res.status(201).json(results);
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'You did not create this task' });
      }
    })
    .catch(next);
});

// UPDATE task item
// Request body: text
// Optional: completed_by, completed_at, completed
router.put('/taskItems/:taskId/:id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.text == undefined) {
    res.status(400).json({ message: 'Error: text is undefined' });
    return;
  }

  const data = {
    creator_id: req.user.id,
    text: req.body.text,
    id: req.params.id,
    completed_by: req.body.completed ? req.user.id : null,
    completed_at: req.body.completed_at || null,
    completed: req.body.completed ?? false,
  };

  // Check that user created the task or is assigned to the task
  getTasksByTaskID({ id: req.params.taskId })
    .then((tasks) => {
      if (tasks.length === 0) {
        return res.status(404).json({ message: 'Task not found' });
      }
      if (tasks[0].creator_id === data.creator_id || tasks[0].assignee_id === data.creator_id) {
        updateTaskItems(data)
          .then((results) => {
            res.status(200).json(results);
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'You did not create or get assigned to this task' });
      }
    })
    .catch(next);
});

// DELETE task item
router.delete('/taskItems/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
    creator_id: req.user.id,
  };

  // Check that user created the task
  getTasksByUserID(data)
    .then((tasks) => {
      if (tasks.length > 0) {
        deleteTaskItems(data)
          .then((results) => {
            res.status(204).json();
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'You did not create this task' });
      }
    })
    .catch(next);
});

module.exports = router;
