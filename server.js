const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err.message);
    console.error('Request body:', req.body);
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid JSON format in request body'
    });
  }
  next(err);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error'
  });
});

// Helper function to read database
function readDatabase() {
  try {
    const data = fs.readFileSync('database.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    // Return default database structure if file is corrupted or doesn't exist
    return {
      users: [
        {
          id: "1",
          username: "student1",
          password: "pass123",
          role: "student",
          name: "Rahul Kumar"
        },
        {
          id: "2",
          username: "mod1",
          password: "pass123",
          role: "moderator",
          name: "Dr. Sharma"
        },
        {
          id: "3",
          username: "gate1",
          password: "pass123",
          role: "gatekeeper",
          name: "Security Officer"
        },
        {
          id: "4",
          username: "admin1",
          password: "pass123",
          role: "admin",
          name: "System Administrator"
        }
      ],
      passes: []
    };
  }
}

// Helper function to write database
function writeDatabase(data) {
  try {
    fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to database:', error);
  }
}

// Generate unique ID
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is working' });
});

// API: Login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, message: 'Username and password are required' });
    }
    
    const db = readDatabase();
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        }
      });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Server error during login' });
  }
});

// API: Student Registration
app.post('/api/register', (req, res) => {
  try {
    const { fullName, studentId, email, phone, course, year, password } = req.body;
    
    if (!fullName || !studentId || !email || !phone || !course || !year || !password) {
      return res.json({ success: false, message: 'All fields are required' });
    }
    
    const db = readDatabase();
    
    // Check if student ID already exists
    const existingUser = db.users.find(u => u.username === studentId || u.studentId === studentId);
    if (existingUser) {
      return res.json({ success: false, message: 'Student ID already exists' });
    }
    
    // Check if email already exists
    const existingEmail = db.users.find(u => u.email === email);
    if (existingEmail) {
      return res.json({ success: false, message: 'Email already registered' });
    }
    
    // Create new student
    const newStudent = {
      id: generateId(),
      username: studentId,
      password: password,
      role: 'student',
      name: fullName,
      studentId: studentId,
      email: email,
      phone: phone,
      course: course,
      year: year,
      registeredAt: new Date().toISOString()
    };
    
    db.users.push(newStudent);
    writeDatabase(db);
    
    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: newStudent.id,
        username: newStudent.username,
        role: newStudent.role,
        name: newStudent.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false, message: 'Server error during registration' });
  }
});

// API: Create pass request (Student)
app.post('/api/passes', (req, res) => {
  const { studentId, studentName, reason, category, returnTime, notes } = req.body;
  const db = readDatabase();
  
  const newPass = {
    id: generateId(),
    studentId,
    studentName,
    reason,
    category: category || 'general',
    returnTime: returnTime || null,
    notes: notes || '',
    status: 'pending',
    moderatorRemarks: '',
    requestedAt: new Date().toISOString(),
    approvedAt: null,
    usedAt: null
  };
  
  db.passes.push(newPass);
  writeDatabase(db);
  
  res.json({ success: true, pass: newPass });
});

// API: Get all passes
app.get('/api/passes', (req, res) => {
  const db = readDatabase();
  res.json({ success: true, passes: db.passes });
});

// API: Get passes by student ID
app.get('/api/passes/student/:studentId', (req, res) => {
  const { studentId } = req.params;
  const db = readDatabase();
  
  const studentPasses = db.passes.filter(p => p.studentId === studentId);
  res.json({ success: true, passes: studentPasses });
});

// API: Update pass status (Moderator)
app.put('/api/passes/:passId', (req, res) => {
  const { passId } = req.params;
  const { status, moderatorRemarks } = req.body;
  const db = readDatabase();
  
  const passIndex = db.passes.findIndex(p => p.id === passId);
  
  if (passIndex !== -1) {
    db.passes[passIndex].status = status;
    db.passes[passIndex].moderatorRemarks = moderatorRemarks;
    if (status === 'approved') {
      db.passes[passIndex].approvedAt = new Date().toISOString();
    }
    
    writeDatabase(db);
    res.json({ success: true, pass: db.passes[passIndex] });
  } else {
    res.json({ success: false, message: 'Pass not found' });
  }
});

// API: Mark pass as used (Gatekeeper)
app.put('/api/passes/:passId/use', (req, res) => {
  const { passId } = req.params;
  const db = readDatabase();
  
  const passIndex = db.passes.findIndex(p => p.id === passId);
  
  if (passIndex !== -1) {
    if (db.passes[passIndex].status !== 'approved') {
      return res.json({ success: false, message: 'Pass not approved' });
    }
    
    db.passes[passIndex].usedAt = new Date().toISOString();
    
    writeDatabase(db);
    res.json({ success: true, pass: db.passes[passIndex] });
  } else {
    res.json({ success: false, message: 'Pass not found' });
  }
});

// API: Get pass by ID (for QR scan)
app.get('/api/passes/:passId', (req, res) => {
  const { passId } = req.params;
  const db = readDatabase();
  
  const pass = db.passes.find(p => p.id === passId);
  
  if (pass) {
    res.json({ success: true, pass });
  } else {
    res.json({ success: false, message: 'Pass not found' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port or make sure no other service is using port ${PORT}`);
  } else {
    console.error('Error starting server:', err);
  }
});