/* global authFetch, getToken, getStoredUser, onWs, sendWs */

// ── State ──
let sessions = [];
let activeSessionId = null;
let activeTab = 'upcoming';

// Call state
let pc = null;
let localStream = null;
let callState = 'idle';
let screenTrack = null;
let mediaRecorder = null;
let recordedChunks = [];

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// ── DOM refs ──
const $ = (id) => document.getElementById(id);

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadSessions();
  bindEvents();
  connectSocket();
  onWs('session:task_added', (data) => {
    if (data.sessionId === activeSessionId) addTaskToUI(data.task);
  });
  onWs('session:task_toggled', (data) => {
    if (data.sessionId === activeSessionId) toggleTaskInUI(data.task);
  });
  onWs('session:participant_joined', (data) => {
    if (data.sessionId === activeSessionId) loadParticipants();
  });
  onWs('session:participant_left', (data) => {
    if (data.sessionId === activeSessionId) loadParticipants();
  });
  onWs('session:status', (data) => {
    if (data.sessionId === activeSessionId) {
      updateSessionStatusBadge(data.status);
    }
  });
  onWs('session:invited', () => loadSessions());
});

// ── API ──
async function api(path, opts = {}) {
  const res = await authFetch(`/sessions${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Load sessions ──
async function loadSessions() {
  try {
    sessions = await api('');
    renderSessionList();
    if (activeSessionId) {
      const stillExists = sessions.find((s) => s.id === activeSessionId);
      if (!stillExists) {
        activeSessionId = null;
        showEmpty();
      } else {
        showSessionDetail(activeSessionId);
      }
    }
  } catch {
    /* ignore */
  }
}

// ── Render session list ──
function renderSessionList() {
  const list = $('ssSessionList');
  const now = new Date();
  const filtered = sessions.filter((s) => {
    const d = new Date(s.scheduled_at);
    return activeTab === 'upcoming' ? d >= now : d < now;
  });
  list.innerHTML = filtered
    .map(
      (s) => `
    <li class="ss-list-item${s.id === activeSessionId ? ' active' : ''}" data-id="${s.id}">
      <div class="ss-list-item__icon"><i class="fas fa-book"></i></div>
      <div class="ss-list-item__info">
        <div class="ss-list-item__title">${esc(s.title)}</div>
        <div class="ss-list-item__meta">${esc(formatDate(s.scheduled_at))} &middot; by ${esc(s.host_name || 'Unknown')}</div>
      </div>
      <div class="ss-list-item__status">${s.status}</div>
    </li>`,
    )
    .join('');

  list.querySelectorAll('.ss-list-item').forEach((li) => {
    li.addEventListener('click', () => {
      const id = Number(li.dataset.id);
      showSessionDetail(id);
    });
  });
}

// ── Show session detail ──
async function showSessionDetail(sessionId) {
  activeSessionId = sessionId;
  try {
    const session = await api(`/${sessionId}`);
    $('ssEmpty').classList.add('hidden');
    $('ssActive').classList.remove('hidden');

    $('ssDetailTitle').textContent = session.title || 'Untitled';
    $('ssDetailDesc').textContent = session.description || 'No description';
    $('ssDetailMeta').textContent =
      `${formatDate(session.scheduled_at)} — Hosted by ${esc(session.host_name || 'Unknown')}`;
    updateSessionStatusBadge(session.status);

    renderSessionList();

    await loadTasks(sessionId);
    await loadParticipants();
    await loadRecordings(sessionId);
  } catch {
    showEmpty();
  }
}

function updateSessionStatusBadge(status) {
  const badge = document.querySelector('.ss-list-item.active .ss-list-item__status');
  if (badge) badge.textContent = status;
}

function showEmpty() {
  activeSessionId = null;
  $('ssEmpty').classList.remove('hidden');
  $('ssActive').classList.add('hidden');
  renderSessionList();
}

// ── Tasks ──
async function loadTasks(sessionId) {
  const tasks = await api(`/${sessionId}/tasks`);
  const list = $('ssTaskList');
  list.innerHTML = tasks
    .map(
      (t) => `
    <li class="ss-task-item" data-id="${t.id}">
      <div class="ss-task-check${t.is_done ? ' done' : ''}" data-id="${t.id}">${t.is_done ? '&#10003;' : ''}</div>
      <span class="ss-task-text${t.is_done ? ' done' : ''}">${esc(t.text)}</span>
      <span class="ss-task-author">by ${esc(t.created_by_name || 'Unknown')}</span>
      <button class="ss-task-del" data-id="${t.id}" title="Delete">&times;</button>
    </li>`,
    )
    .join('');
  $('ssTaskCount').textContent = `${tasks.filter((t) => !t.is_done).length}/${tasks.length}`;

  list.querySelectorAll('.ss-task-check').forEach((el) => {
    el.addEventListener('click', () => toggleTask(Number(el.dataset.id)));
  });
  list.querySelectorAll('.ss-task-del').forEach((el) => {
    el.addEventListener('click', () => deleteTask(Number(el.dataset.id)));
  });
}

async function toggleTask(taskId) {
  if (!activeSessionId) return;
  const task = await api(`/${activeSessionId}/tasks/${taskId}/toggle`, { method: 'PUT' });
  toggleTaskInUI(task);
  sendWs({ type: 'session:task_toggled', sessionId: activeSessionId, task });
}

function toggleTaskInUI(task) {
  const item = document.querySelector(`.ss-task-item[data-id="${task.id}"]`);
  if (!item) return;
  const check = item.querySelector('.ss-task-check');
  const text = item.querySelector('.ss-task-text');
  check.classList.toggle('done', task.is_done);
  check.innerHTML = task.is_done ? '&#10003;' : '';
  text.classList.toggle('done', task.is_done);
}

function addTaskToUI(task) {
  const list = $('ssTaskList');
  const div = document.createElement('li');
  div.className = 'ss-task-item';
  div.dataset.id = task.id;
  div.innerHTML = `
    <div class="ss-task-check${task.is_done ? ' done' : ''}" data-id="${task.id}">${task.is_done ? '&#10003;' : ''}</div>
    <span class="ss-task-text${task.is_done ? ' done' : ''}">${esc(task.text)}</span>
    <span class="ss-task-author">by ${esc(task.created_by_name || 'Unknown')}</span>
    <button class="ss-task-del" data-id="${task.id}">&times;</button>`;
  div.querySelector('.ss-task-check').addEventListener('click', () => toggleTask(task.id));
  div.querySelector('.ss-task-del').addEventListener('click', () => deleteTask(task.id));
  list.appendChild(div);
}

async function deleteTask(taskId) {
  if (!activeSessionId) return;
  await api(`/${activeSessionId}/tasks/${taskId}`, { method: 'DELETE' });
  document.querySelector(`.ss-task-item[data-id="${taskId}"]`)?.remove();
}

// ── Participants ──
async function loadParticipants() {
  if (!activeSessionId) return;
  const parts = await api(`/${activeSessionId}/participants`);
  const list = $('ssParticipantList');
  list.innerHTML = parts
    .map(
      (p) => `
    <li class="ss-participant-item">
      <i class="fas fa-user"></i>
      ${esc(p.name || p.email)}
      <span class="ss-participant-badge">${p.status}</span>
    </li>`,
    )
    .join('');
}

// ── Recordings ──
async function loadRecordings(sessionId) {
  const recs = await api(`/${sessionId}/recordings`);
  const list = $('ssRecordingList');
  if (!recs.length) {
    list.innerHTML = '<li style="font-size:13px;color:#667781">No recordings yet</li>';
    return;
  }
  list.innerHTML = recs
    .map(
      (r) => `
    <li class="ss-recording-item">
      <i class="fas fa-video"></i>
      <a href="${esc(r.file_path)}" target="_blank">Recording ${r.id}</a>
      <span style="color:#667781;font-size:12px">by ${esc(r.uploaded_by_name || 'Unknown')} &middot; ${r.duration_sec || 0}s</span>
    </li>`,
    )
    .join('');
}

// ── WebSocket ──
function connectSocket() {
  if (typeof connectSocket !== 'undefined') {
    try {
      window.connectSocket();
    } catch {
      /* already connected */
    }
  }
}

// ── Call WebRTC ──
async function ensurePC() {
  if (pc) return pc;
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = (e) => {
    if (e.candidate && activeSessionId) {
      sendWs({
        type: 'session:call_signal',
        sessionId: activeSessionId,
        signal: { type: 'ice', candidate: e.candidate },
      });
    }
  };
  pc.ontrack = (e) => {
    const vid = $('ssRemoteVideo');
    if (e.track.kind === 'video') {
      vid.srcObject = e.streams[0];
      vid.classList.remove('hidden');
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      endCall();
    }
  };
  return pc;
}

async function startMedia(video) {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  const pc = await ensurePC();
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  const localVid = $('ssLocalVideo');
  localVid.srcObject = localStream;
  localVid.classList.remove('hidden');
}

function showCallOverlay(status, incoming) {
  $('ssCallOverlay').classList.remove('hidden');
  $('ssCallStatus').textContent = status;
  $('ssCallControls').classList.toggle('hidden', !!incoming);
  $('ssCallIncoming').classList.toggle('hidden', !incoming);
  $('ssCallVideoWrap').classList.remove('hidden');
}

function hideCallOverlay() {
  $('ssCallOverlay').classList.add('hidden');
  $('ssCallVideoWrap').classList.add('hidden');
  $('ssCallControls').classList.add('hidden');
  $('ssCallIncoming').classList.add('hidden');
  $('ssCallTaskPopup').classList.add('hidden');
}

function endCall() {
  if (screenTrack) {
    screenTrack.stop();
    screenTrack = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (pc) {
    pc.close();
    pc = null;
  }
  callState = 'idle';
  hideCallOverlay();
}

async function startCall(video) {
  if (callState !== 'idle') return;
  callState = 'connecting';
  showCallOverlay('Connecting…');
  await startMedia(video);
  const pc = await ensurePC();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendWs({
    type: 'session:call_signal',
    sessionId: activeSessionId,
    signal: { type: 'offer', sdp: offer },
  });
  callState = 'active';
}

async function handleSessionCallSignal(data) {
  if (data.fromUserId === getStoredUser()?.id) return;
  const pc = await ensurePC();
  const signal = data.signal;

  if (signal.type === 'offer') {
    callState = 'incoming';
    $('ssCallIncomingText').textContent = `${data.fromUserId} is calling…`;
    showCallOverlay('Incoming call…', true);
    $('ssBtnAcceptCall').onclick = async () => {
      await startMedia(true);
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendWs({
        type: 'session:call_signal',
        sessionId: activeSessionId,
        signal: { type: 'answer', sdp: answer },
      });
      callState = 'active';
      showCallOverlay('Connected');
      $('ssCallControls').classList.remove('hidden');
      $('ssCallIncoming').classList.add('hidden');
    };
    $('ssBtnDeclineCall').onclick = () => endCall();
  } else if (signal.type === 'answer') {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    showCallOverlay('Connected');
    callState = 'active';
  } else if (signal.type === 'ice' && signal.candidate) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } catch {
      /* ignore */
    }
  }
}

// ── Screen share ──
async function toggleScreenShare() {
  if (screenTrack) {
    screenTrack.stop();
    pc.getSenders()
      .find((s) => s.track === screenTrack)
      ?.removeTrack?.();
    screenTrack = null;
    $('ssScreenShareVideo').classList.add('hidden');
    sendWs({ type: 'session:screenshare_stopped', sessionId: activeSessionId });
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenTrack = stream.getVideoTracks()[0];
    const pc = await ensurePC();
    pc.addTrack(screenTrack, stream);
    // renegotiate
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendWs({
      type: 'session:call_signal',
      sessionId: activeSessionId,
      signal: { type: 'offer', sdp: offer },
    });
    $('ssScreenShareVideo').srcObject = stream;
    $('ssScreenShareVideo').classList.remove('hidden');
    sendWs({ type: 'session:screenshare_started', sessionId: activeSessionId });
    screenTrack.onended = () => {
      screenTrack = null;
      $('ssScreenShareVideo').classList.add('hidden');
      sendWs({ type: 'session:screenshare_stopped', sessionId: activeSessionId });
    };
  } catch {
    /* user cancelled */
  }
}

// ── Recording (stretch) ──
async function startRecording() {
  if (!localStream) return;
  recordedChunks = [];
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const mix = new MediaStream([
      ...localStream.getAudioTracks(),
      ...screenStream.getVideoTracks(),
    ]);
    mediaRecorder = new MediaRecorder(mix, { mimeType: 'video/webm;codecs=vp9,opus' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('file', blob, `session-${activeSessionId}-${Date.now()}.webm`);
      try {
        const res = await authFetch('/upload', { method: 'POST', body: formData });
        const body = await res.json();
        if (body.filePath) {
          await api(`/${activeSessionId}/recordings`, {
            method: 'POST',
            body: JSON.stringify({
              file_path: body.filePath,
              duration_sec: Math.round((recordedChunks.length * 100) / 1000),
            }),
            headers: { 'Content-Type': 'application/json' },
          });
          loadRecordings(activeSessionId);
        }
      } catch {
        /* upload failed */
      }
      screenStream.getTracks().forEach((t) => t.stop());
      $('ssRecStatus').textContent = 'Recording saved!';
      $('ssBtnStartRec').classList.remove('hidden');
      $('ssBtnStopRec').classList.add('hidden');
    };
    $('ssRecPreview').srcObject = mix;
    $('ssRecPreview').classList.remove('hidden');
    mediaRecorder.start(100);
    $('ssRecStatus').textContent = 'Recording…';
    $('ssBtnStartRec').classList.add('hidden');
    $('ssBtnStopRec').classList.remove('hidden');
  } catch {
    /* user cancelled */
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

// ── Event binding ──
function bindEvents() {
  // Tabs
  document.querySelectorAll('.ss-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ss-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderSessionList();
    });
  });

  // Back to list
  $('btnBackToList').addEventListener('click', showEmpty);

  // New session modal
  $('btnNewSession').addEventListener('click', () =>
    $('ssNewSessionModal').classList.remove('hidden'),
  );
  $('btnCloseModal').addEventListener('click', () =>
    $('ssNewSessionModal').classList.add('hidden'),
  );
  $('btnCancelSession').addEventListener('click', () =>
    $('ssNewSessionModal').classList.add('hidden'),
  );

  // Create session
  $('btnCreateSession').addEventListener('click', async () => {
    const title = $('ssFormTitle').value.trim();
    const description = $('ssFormDesc').value.trim();
    const scheduled_at = $('ssFormDatetime').value;
    const invitees = $('ssFormInvitees')
      .value.split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    if (!title || !scheduled_at) return alert('Title and date/time are required');
    try {
      await api('', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          scheduled_at: new Date(scheduled_at).toISOString(),
          invitee_ids: invitees,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      $('ssNewSessionModal').classList.add('hidden');
      $('ssFormTitle').value = '';
      $('ssFormDesc').value = '';
      $('ssFormDatetime').value = '';
      $('ssFormInvitees').value = '';
      await loadSessions();
    } catch (e) {
      alert('Failed to create session: ' + e.message);
    }
  });

  // Add task
  $('btnAddTask').addEventListener('click', () => {
    $('ssTaskForm').classList.remove('hidden');
    $('ssTaskInput').focus();
  });
  $('ssTaskCancel').addEventListener('click', () => {
    $('ssTaskForm').classList.add('hidden');
    $('ssTaskInput').value = '';
  });
  $('ssTaskSubmit').addEventListener('click', async () => {
    const text = $('ssTaskInput').value.trim();
    if (!text || !activeSessionId) return;
    try {
      const task = await api(`/${activeSessionId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ text }),
        headers: { 'Content-Type': 'application/json' },
      });
      addTaskToUI(task);
      sendWs({ type: 'session:task_added', sessionId: activeSessionId, task });
      $('ssTaskInput').value = '';
      $('ssTaskForm').classList.add('hidden');
    } catch (e) {
      alert('Failed to add task: ' + e.message);
    }
  });
  $('ssTaskInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('ssTaskSubmit').click();
  });

  // Call buttons
  $('btnStartCall').addEventListener('click', () => startCall(false));
  $('btnStartVideo').addEventListener('click', () => startCall(true));
  $('ssBtnEndCall').addEventListener('click', endCall);
  $('ssBtnMute').addEventListener('click', () => {
    if (localStream) {
      const audio = localStream.getAudioTracks()[0];
      if (audio) audio.enabled = !audio.enabled;
    }
  });
  $('ssBtnToggleVideo').addEventListener('click', () => {
    if (localStream) {
      const video = localStream.getVideoTracks()[0];
      if (video) video.enabled = !video.enabled;
    }
  });
  $('ssBtnScreenShare').addEventListener('click', toggleScreenShare);
  $('ssBtnCancelRinging').addEventListener('click', endCall);

  // Handle incoming session call signals
  onWs('session:call_signal', handleSessionCallSignal);
  onWs('session:screenshare_started', (data) => {
    if (data.fromUserId !== getStoredUser()?.id && data.sessionId === activeSessionId) {
      $('ssCallStatus').textContent = `${data.fromUserId} is sharing screen`;
    }
  });
  onWs('session:screenshare_stopped', (data) => {
    if (data.sessionId === activeSessionId) {
      $('ssCallStatus').textContent = 'Connected';
    }
  });

  // Recording modal
  $('ssBtnStartRec').addEventListener('click', startRecording);
  $('ssBtnStopRec').addEventListener('click', stopRecording);
  $('btnCloseRecModal').addEventListener('click', () =>
    $('ssRecordingModal').classList.add('hidden'),
  );
}

// ── Helpers ──
function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
