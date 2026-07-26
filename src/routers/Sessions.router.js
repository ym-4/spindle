const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');
const Sessions = require('../models/Sessions.model');
const { sendToUser } = require('../realtime/wsHub');

router.use(authenticateJWT);

// GET /sessions — list upcoming sessions for current user
router.get('/', async (req, res, next) => {
  try {
    const sessions = await Sessions.listUpcoming(req.user.id);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// POST /sessions — create a new study session
router.post('/', async (req, res, next) => {
  try {
    const { title, description, scheduled_at, invitee_ids } = req.body;
    if (!title || !scheduled_at) {
      return res.status(400).json({ error: 'title and scheduled_at are required' });
    }
    const session = await Sessions.createSession(
      req.user.id,
      title,
      description || '',
      scheduled_at,
      invitee_ids || [],
    );
    if (invitee_ids && invitee_ids.length > 0) {
      invitee_ids.forEach((uid) => {
        sendToUser(uid, { type: 'session:invited', session });
      });
    }
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// GET /sessions/:id — get session details
router.get('/:id', async (req, res, next) => {
  try {
    const session = await Sessions.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// PUT /sessions/:id — update session status (start, complete, cancel)
router.put('/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const session = await Sessions.updateSessionStatus(req.params.id, status);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const participants = await Sessions.listParticipants(req.params.id);
    participants.forEach((p) => {
      if (p.user_id !== req.user.id) {
        sendToUser(p.user_id, { type: 'session:status', sessionId: session.id, status });
      }
    });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// DELETE /sessions/:id — delete a session
router.delete('/:id', async (req, res, next) => {
  try {
    const session = await Sessions.deleteSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// --- Participants ---

// GET /sessions/:id/participants
router.get('/:id/participants', async (req, res, next) => {
  try {
    const participants = await Sessions.listParticipants(req.params.id);
    res.json(participants);
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/participants — join or invite
router.post('/:id/participants', async (req, res, next) => {
  try {
    const { user_id } = req.body;
    const participant = await Sessions.addParticipant(req.params.id, user_id || req.user.id);
    const participants = await Sessions.listParticipants(req.params.id);
    participants.forEach((p) => {
      if (p.user_id !== req.user.id) {
        sendToUser(p.user_id, {
          type: 'session:participant_joined',
          sessionId: Number(req.params.id),
          participant,
        });
      }
    });
    res.status(201).json(participant);
  } catch (err) {
    next(err);
  }
});

// DELETE /sessions/:id/participants/:userId — leave or remove
router.delete('/:id/participants/:userId', async (req, res, next) => {
  try {
    const removed = await Sessions.removeParticipant(req.params.id, req.params.userId);
    if (!removed) return res.status(404).json({ error: 'Participant not found' });
    const participants = await Sessions.listParticipants(req.params.id);
    participants.forEach((p) => {
      if (p.user_id !== req.user.id) {
        sendToUser(p.user_id, {
          type: 'session:participant_left',
          sessionId: Number(req.params.id),
          userId: Number(req.params.userId),
        });
      }
    });
    res.json({ message: 'Removed' });
  } catch (err) {
    next(err);
  }
});

// --- Tasks ---

// GET /sessions/:id/tasks
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const tasks = await Sessions.listTasks(req.params.id);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/tasks
router.post('/:id/tasks', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const task = await Sessions.addTask(req.params.id, req.user.id, text);
    const participants = await Sessions.listParticipants(req.params.id);
    participants.forEach((p) => {
      if (p.user_id !== req.user.id) {
        sendToUser(p.user_id, {
          type: 'session:task_added',
          sessionId: Number(req.params.id),
          task,
        });
      }
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PUT /sessions/:id/tasks/:taskId/toggle
router.put('/:id/tasks/:taskId/toggle', async (req, res, next) => {
  try {
    const task = await Sessions.toggleTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const participants = await Sessions.listParticipants(req.params.id);
    participants.forEach((p) => {
      if (p.user_id !== req.user.id) {
        sendToUser(p.user_id, {
          type: 'session:task_toggled',
          sessionId: Number(req.params.id),
          task,
        });
      }
    });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /sessions/:id/tasks/:taskId
router.delete('/:id/tasks/:taskId', async (req, res, next) => {
  try {
    const task = await Sessions.deleteTask(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// --- Recordings ---

// GET /sessions/:id/recordings
router.get('/:id/recordings', async (req, res, next) => {
  try {
    const recordings = await Sessions.listRecordings(req.params.id);
    res.json(recordings);
  } catch (err) {
    next(err);
  }
});

// POST /sessions/:id/recordings — upload a recording
router.post('/:id/recordings', async (req, res, next) => {
  try {
    const { file_path, duration_sec } = req.body;
    if (!file_path) return res.status(400).json({ error: 'file_path is required' });
    const rec = await Sessions.saveRecording(
      req.params.id,
      req.user.id,
      file_path,
      duration_sec || 0,
    );
    res.status(201).json(rec);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
