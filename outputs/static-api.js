/*
 * Browser-only data adapter for static hosting.
 * Data belongs to this browser and this site origin; it is not synchronized
 * with other devices or protected by a server-side authorization layer.
 */
(() => {
  const DB_KEY = 'unidesk-static-data-v1';
  const SESSION_KEY = 'unidesk-static-user-v1';
  const defaults = { users: {}, students: [], attendance: [], circulars: [], events: [], teachers: [], leaves: [] };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const clean = (value, max = 180) => String(value || '').trim().slice(0, max);
  const id = () => crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map((part) => part.toString(16).padStart(2, '0')).join('');
  const validSemester = (value) => /^Semester [1-6]$/.test(value);

  function readDb() {
    try { return { ...copy(defaults), ...JSON.parse(localStorage.getItem(DB_KEY) || '{}') }; }
    catch { return copy(defaults); }
  }
  function saveDb(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function activeUser(db) {
    const userId = localStorage.getItem(SESSION_KEY);
    return Object.values(db.users).find((user) => user.id === userId) || null;
  }
  function sendUser(user) { return { id: user.id, name: user.name, email: user.email, staffId: user.staffId, role: user.role === 'hr' ? 'hr' : 'faculty' }; }
  function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
  async function passwordHash(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
  }
  function bodyOf(options) {
    try { return JSON.parse(options.body || '{}'); } catch { return {}; }
  }
  function matchesDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

  async function request(path, options = {}) {
    const url = new URL(path, location.origin);
    const method = (options.method || 'GET').toUpperCase();
    const body = bodyOf(options);
    const db = readDb();
    const route = url.pathname;

    if (method === 'GET' && route === '/api/setup') return { hrConfigured: Object.values(db.users).some((user) => user.role === 'hr') };
    if (method === 'POST' && route === '/api/register') {
      const email = clean(body.email, 180).toLowerCase();
      const name = clean(body.name, 100);
      const staffId = clean(body.staffId, 40).toUpperCase();
      const password = String(body.password || '');
      const role = body.role === 'hr' ? 'hr' : 'faculty';
      if (!email.includes('@') || !name || !staffId || password.length < 8) fail('Enter your name, work email, staff ID, and a password of at least 8 characters.');
      if (db.users[email]) fail('An account already exists for this email.', 409);
      if (Object.values(db.users).some((user) => user.staffId === staffId)) fail('That staff ID is already registered.', 409);
      if (role === 'hr' && Object.values(db.users).some((user) => user.role === 'hr')) fail('An HR account is already set up. Ask the HR account holder for access.', 403);
      const salt = id();
      const user = { id: id(), email, name, staffId, role, salt, passwordHash: await passwordHash(password, salt), createdAt: new Date().toISOString() };
      db.users[email] = user;
      if (!db.teachers.some((teacher) => teacher.staffId === staffId)) db.teachers.push({ id: user.id, name, staffId, email, department: clean(body.department, 80) || 'Faculty' });
      saveDb(db); localStorage.setItem(SESSION_KEY, user.id);
      return { user: sendUser(user) };
    }
    if (method === 'POST' && route === '/api/login') {
      const email = clean(body.email, 180).toLowerCase();
      const user = db.users[email];
      if (!user || await passwordHash(String(body.password || ''), user.salt) !== user.passwordHash) fail('Email or password is incorrect.', 401);
      localStorage.setItem(SESSION_KEY, user.id);
      return { user: sendUser(user) };
    }
    if (method === 'POST' && route === '/api/logout') { localStorage.removeItem(SESSION_KEY); return { ok: true }; }
    if (method === 'GET' && route === '/api/me') {
      const user = activeUser(db);
      if (!user) fail('Please sign in.', 401);
      return { user: sendUser(user) };
    }

    const teacher = activeUser(db);
    if (route.startsWith('/api/') && !teacher) fail('Please sign in again.', 401);
    const isHr = teacher?.role === 'hr';

    if (method === 'GET' && route === '/api/students') {
      const { course, semester, group, search } = Object.fromEntries(url.searchParams);
      const query = clean(search, 80).toLowerCase();
      const students = db.students.filter((student) => (!course || student.course === course) && (!semester || student.semester === semester) && (!group || student.group === group) && (!query || `${student.rollNumber} ${student.name}`.toLowerCase().includes(query)))
        .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
      return { students };
    }
    if (method === 'POST' && route === '/api/students') {
      const student = { id: id(), rollNumber: clean(body.rollNumber, 40).toUpperCase(), name: clean(body.name, 100), course: clean(body.course, 40), semester: clean(body.semester, 20), group: clean(body.group, 40), createdAt: new Date().toISOString() };
      if (!student.rollNumber || !student.name || !['BCA', 'B.Sc', 'B.Com'].includes(student.course) || !validSemester(student.semester) || !student.group) fail('Enter a roll number, name, course, semester, and group.');
      if (db.students.some((item) => item.rollNumber === student.rollNumber && item.course === student.course && item.semester === student.semester && item.group === student.group)) fail('That roll number is already in this group.', 409);
      db.students.push(student); saveDb(db); return { student };
    }
    if (method === 'DELETE' && route.startsWith('/api/students/')) { db.students = db.students.filter((student) => student.id !== route.split('/').pop()); saveDb(db); return { ok: true }; }

    if (method === 'GET' && route === '/api/attendance') {
      const { course, semester, group, date, subject } = Object.fromEntries(url.searchParams);
      return { entries: db.attendance.filter((entry) => (!course || entry.course === course) && (!semester || entry.semester === semester) && (!group || entry.group === group) && (!date || entry.date === date) && (!subject || entry.subject === subject)) };
    }
    if (method === 'POST' && route === '/api/attendance') {
      const student = db.students.find((item) => item.id === body.studentId);
      const status = ['present', 'absent', 'late'].includes(body.status) ? body.status : '';
      const date = clean(body.date, 10); const subject = clean(body.subject, 100);
      if (!student || !status || !matchesDate(date) || !subject) fail('Choose a student, subject, date, and status.');
      const index = db.attendance.findIndex((entry) => entry.studentId === student.id && entry.date === date && entry.subject === subject);
      const entry = { id: index >= 0 ? db.attendance[index].id : id(), studentId: student.id, rollNumber: student.rollNumber, studentName: student.name, course: student.course, semester: student.semester, group: student.group, subject, date, status, markedBy: teacher.staffId, markedAt: new Date().toISOString() };
      if (index >= 0) db.attendance[index] = entry; else db.attendance.push(entry);
      saveDb(db); return { entry };
    }

    if (method === 'GET' && route === '/api/circulars') return { circulars: db.circulars.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    if (method === 'POST' && route === '/api/circulars') {
      const title = clean(body.title, 160); const message = clean(body.message, 5000);
      if (!title || !message) fail('Enter a title and notice.');
      const circular = { id: id(), title, message, audience: clean(body.audience, 80) || 'All students', createdBy: teacher.name, createdAt: new Date().toISOString() };
      db.circulars.push(circular); saveDb(db); return { circular };
    }
    if (method === 'DELETE' && route.startsWith('/api/circulars/')) { db.circulars = db.circulars.filter((item) => item.id !== route.split('/').pop()); saveDb(db); return { ok: true }; }

    if (method === 'GET' && route === '/api/events') {
      const year = Number(url.searchParams.get('year'));
      return { events: db.events.filter((item) => !year || Number(item.date.slice(0, 4)) === year).sort((a, b) => a.date.localeCompare(b.date)) };
    }
    if (method === 'POST' && route === '/api/events') {
      const event = { id: id(), title: clean(body.title, 160), date: clean(body.date, 10), kind: body.kind === 'Holiday' ? 'Holiday' : 'Event', details: clean(body.details, 1000), createdBy: teacher.name };
      if (!event.title || !matchesDate(event.date)) fail('Enter an event name and date.');
      db.events.push(event); saveDb(db); return { event };
    }
    if (method === 'DELETE' && route.startsWith('/api/events/')) { db.events = db.events.filter((item) => item.id !== route.split('/').pop()); saveDb(db); return { ok: true }; }

    if (method === 'GET' && route === '/api/teachers') {
      if (isHr) return { teachers: db.teachers.slice().sort((a, b) => a.name.localeCompare(b.name)) };
      const ownProfile = db.teachers.find((item) => item.staffId === teacher.staffId) || { id: teacher.id, name: teacher.name, staffId: teacher.staffId, email: teacher.email, department: 'Faculty' };
      return { teachers: [ownProfile] };
    }
    if (method === 'POST' && route === '/api/teachers') {
      if (!isHr) fail('Only HR can manage the teacher directory.', 403);
      const item = { id: id(), name: clean(body.name, 100), staffId: clean(body.staffId, 40).toUpperCase(), email: clean(body.email, 180).toLowerCase(), department: clean(body.department, 80) || 'Faculty' };
      if (!item.name || !item.staffId) fail('Enter the teacher name and staff ID.');
      if (db.teachers.some((candidate) => candidate.staffId === item.staffId)) fail('That staff ID is already listed.', 409);
      db.teachers.push(item); saveDb(db); return { teacher: item };
    }

    const ownsLeave = (item) => item.staffId === teacher.staffId && (item.createdById === teacher.id || (!item.createdById && item.createdBy === teacher.name));
    if (method === 'GET' && route === '/api/leaves') {
      const leaves = isHr ? db.leaves : db.leaves.filter(ownsLeave);
      return { leaves: leaves.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    }
    if (method === 'POST' && route === '/api/leaves') {
      const item = { id: id(), teacherName: teacher.name, staffId: teacher.staffId, startDate: clean(body.startDate, 10), endDate: clean(body.endDate, 10), reason: clean(body.reason, 500), status: 'Pending', createdBy: teacher.name, createdById: teacher.id, createdAt: new Date().toISOString() };
      if (!matchesDate(item.startDate) || !matchesDate(item.endDate) || item.endDate < item.startDate) fail('Choose valid leave dates.');
      db.leaves.push(item); saveDb(db); return { leave: item };
    }
    const leaveMatch = route.match(/^\/api\/leaves\/([a-f0-9-]+)$/i);
    if (method === 'PATCH' && leaveMatch) {
      if (!isHr) fail('Only HR can approve or decline leave requests.', 403);
      const item = db.leaves.find((leave) => leave.id === leaveMatch[1]);
      if (!item) fail('Leave request not found.', 404);
      if (!['Approved', 'Declined'].includes(body.status)) fail('Choose approve or decline.');
      item.status = body.status; item.reviewedBy = teacher.name; item.reviewedAt = new Date().toISOString();
      saveDb(db); return { leave: item };
    }
    fail('Not found.', 404);
  }

  window.UniDeskStaticApi = { request };
})();
