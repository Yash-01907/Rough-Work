// ====================
// SERVER SETUP
// ====================

// server/package.json
{
  "name": "skillswap-server",
  "version": "1.0.0",
  "description": "Skill Swap Platform Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "socket.io": "^4.7.2",
    "multer": "^1.4.5-lts.1",
    "validator": "^13.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}

// server/.env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/skillswap
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development

// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const socketIo = require('socket.io');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Passport config
require('./config/passport')(passport);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillswap', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requests', require('./routes/requests'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(User ${userId} joined room);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});

// server/config/passport.js
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const bcrypt = require('bcryptjs');

module.exports = function(passport) {
  // Local Strategy
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Password incorrect' });
        }
      } catch (error) {
        return done(error);
      }
    }
  ));

  // JWT Strategy
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  }, async (jwt_payload, done) => {
    try {
      const user = await User.findById(jwt_payload.id);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  }));
};

// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  location: {
    type: String,
    default: ''
  },
  skillsOffered: [{
    type: String,
    trim: true
  }],
  skillsWanted: [{
    type: String,
    trim: true
  }],
  availability: {
    type: String,
    enum: ['Weekends', 'Evenings', 'Weekdays', 'Flexible'],
    default: 'Flexible'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  profilePhoto: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', UserSchema);

// server/models/SwapRequest.js
const mongoose = require('mongoose');

const SwapRequestSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skillOffered: {
    type: String,
    required: true
  },
  skillWanted: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SwapRequest', SwapRequestSchema);

// server/routes/auth.js
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// @route POST /api/auth/register
// @desc Register user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email: email.toLowerCase(),
      password
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        location: user.location,
        skillsOffered: user.skillsOffered,
        skillsWanted: user.skillsWanted,
        availability: user.availability,
        isPublic: user.isPublic,
        profilePhoto: user.profilePhoto
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route POST /api/auth/login
// @desc Login user
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (!user) {
      return res.status(400).json({ message: info.message });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        location: user.location,
        skillsOffered: user.skillsOffered,
        skillsWanted: user.skillsWanted,
        availability: user.availability,
        isPublic: user.isPublic,
        profilePhoto: user.profilePhoto
      }
    });
  })(req, res, next);
});

module.exports = router;

// server/routes/users.js
const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const router = express.Router();

// @route GET /api/users/public
// @desc Get all public users with pagination
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let query = { isPublic: true };
    
    if (search) {
      query.$or = [
        { skillsOffered: { $regex: search, $options: 'i' } },
        { skillsWanted: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/users/:id
// @desc Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/users/profile
// @desc Update user profile
router.put('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const {
      name,
      location,
      skillsOffered,
      skillsWanted,
      availability,
      isPublic,
      profilePhoto
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name,
        location,
        skillsOffered,
        skillsWanted,
        availability,
        isPublic,
        profilePhoto
      },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// server/routes/requests.js
const express = require('express');
const passport = require('passport');
const SwapRequest = require('../models/SwapRequest');
const User = require('../models/User');
const router = express.Router();

// @route POST /api/requests
// @desc Create a new swap request
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { toUser, skillOffered, skillWanted, message } = req.body;
    
    // Check if request already exists
    const existingRequest = await SwapRequest.findOne({
      fromUser: req.user.id,
      toUser,
      status: 'Pending'
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'Request already sent to this user' });
    }

    const newRequest = new SwapRequest({
      fromUser: req.user.id,
      toUser,
      skillOffered,
      skillWanted,
      message
    });

    await newRequest.save();

    // Populate the request with user details
    const populatedRequest = await SwapRequest.findById(newRequest._id)
      .populate('fromUser', 'name profilePhoto')
      .populate('toUser', 'name profilePhoto');

    // Emit real-time notification
    const io = req.app.get('io');
    io.to(toUser).emit('newRequest', {
      message: ${req.user.name} sent you a skill swap request!,
      request: populatedRequest
    });

    res.status(201).json(populatedRequest);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/requests
// @desc Get all requests for current user
router.get('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const requests = await SwapRequest.find({
      $or: [
        { fromUser: req.user.id },
        { toUser: req.user.id }
      ]
    })
    .populate('fromUser', 'name profilePhoto')
    .populate('toUser', 'name profilePhoto')
    .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route PUT /api/requests/:id/status
// @desc Update request status
router.put('/:id/status', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { status } = req.body;
    
    const request = await SwapRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Only the recipient can update the status
    if (request.toUser.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    request.status = status;
    await request.save();

    const populatedRequest = await SwapRequest.findById(request._id)
      .populate('fromUser', 'name profilePhoto')
      .populate('toUser', 'name profilePhoto');

    // Emit real-time notification to the sender
    const io = req.app.get('io');
    io.to(request.fromUser.toString()).emit('requestUpdated', {
      message: Your request to ${req.user.name} was ${status.toLowerCase()}!,
      request: populatedRequest
    });

    res.json(populatedRequest);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// ====================
// CLIENT SETUP
// ====================

// client/package.json
{
  "name": "skillswap-client",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "react-router-dom": "^6.15.0",
    "axios": "^1.5.0",
    "react-bootstrap": "^2.8.0",
    "bootstrap": "^5.3.0",
    "react-toastify": "^9.1.3",
    "socket.io-client": "^4.7.2"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslistrc": [
    ">0.2%",
    "not dead",
    "not op_mini all"
  ],
  "proxy": "http://localhost:5000"
}

// client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// client/src/index.css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #f8f9fa;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

.skill-tag {
  background-color: #007bff;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  margin: 0.125rem;
  display: inline-block;
}

.skill-tag.wanted {
  background-color: #28a745;
}

.profile-photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #dee2e6;
}

.profile-photo-large {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #dee2e6;
}

.user-card {
  transition: transform 0.2s;
  height: 100%;
}

.user-card:hover {
  transform: translateY(-5px);
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.navbar-brand {
  font-weight: bold;
  color: #007bff !important;
}

.btn-outline-primary:hover {
  color: #fff;
  background-color: #007bff;
  border-color: #007bff;
}

.modal-header {
  border-bottom: 1px solid #dee2e6;
}

.modal-footer {
  border-top: 1px solid #dee2e6;
}

.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import UserDetailPage from './pages/UserDetailPage';
import RequestsPage from './pages/RequestsPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="App">
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/user/:id" element={<UserDetailPage />} />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/requests" 
                element={
                  <ProtectedRoute>
                    <RequestsPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

// client/src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = Bearer ${token};
      // You could validate token here by making a request to a protected route
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      axios.defaults.headers.common['Authorization'] = Bearer ${token};
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/api/auth/register', userData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      axios.defaults.headers.common['Authorization'] = Bearer ${token};
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    updateUser,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// client/src/context/SocketContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000');
      setSocket(newSocket);

      newSocket.emit('join', user.id);

      newSocket.on('newRequest', (data) => {
        toast.info(data.message);
      });

      newSocket.on('requestUpdated', (data) => {
        toast.success(data.message);
      });

      return () => {
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [user]);

  const value = {
    socket
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

// client/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, token } = useAuth();

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

// client/src/components/Navbar.js
import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Navbar bg="white" expand="lg" className="shadow-sm">
      <Container>
        <Navbar.Brand as={Link} to="/">
          🔄 SkillSwap
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">Home</Nav.Link>
            {user && (
              <>
                <Nav.Link as={Link} to="/profile">Profile</Nav.Link>
                <Nav.Link as={Link} to="/requests">Requests</Nav.Link>
              </>
            )}
          </Nav>
          <Nav>
            {user ? (
              <div className="d-flex align-items-center">
                <span className="me-3">Welcome, {user.name}!</span>
                <Button variant="outline-primary" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            ) : (
              <div>
                <Button 
                  variant="outline-primary" 
                  as={Link} 
                  to="/login"
                  className="me-2"
                >
                  Login
                </Button>
                <Button 
                  variant="primary" 
                  as={Link} 
                  to="/register"
                >
                  Register
                </Button>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;

// client/src/components/UserCard.js
import React from 'react';
import { Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const UserCard = ({ user, onSendRequest }) => {
  const { user: currentUser } = useAuth();

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <Card className="user-card shadow-sm">
      <Card.Body className="text-center">
        <div className="d-flex justify-content-center mb-3">
          {user.profilePhoto ? (
            <img 
              src={user.profilePhoto} 
              alt={user.name}
              className="profile-photo"
            />
          ) : (
            <div 
              className="profile-photo d-flex align-items-center justify-content-center bg-secondary text-white"
              style={{ fontSize: '1.5rem' }}
            >
              {getInitials(user.name)}
            </div>
          )}
        </div>
        
        <Card.Title className="h5">{user.name}</Card.Title>
        
        {user.location && (
          <Card.Subtitle className="mb-2 text-muted">
            📍 {user.location}
          </Card.Subtitle>
        )}
        
        <div className="mb-3">
          <div className="mb-2">
            <small className="text-muted">Skills Offered:</small>
            <div>
              {user.skillsOffered.length > 0 ? (
                user.skillsOffered.map((skill, index) => (
                  <span key={index} className="skill-tag">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-muted">None listed</span>
              )}
            </div>
          </div>
          
          <div className="mb-2">
            <small className="text-muted">Skills Wanted:</small>
            <div>
              {user.skillsWanted.length > 0 ? (
                user.skillsWanted.map((skill, index) => (
                  <span key={index} className="skill-tag wanted">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-muted">None listed</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-3">
          <Badge bg="info">{user.availability}</Badge>
        </div>
        
        <div className="d-grid gap-2">
          <Button 
            variant="outline-primary" 
            as={Link} 
            to={/user/${user._id}}
          >
            View Profile
          </Button>
          {currentUser && currentUser.id !== user._id && (
            <Button 
              variant="primary" 
              onClick={() => onSendRequest(user)}
            >
              Send Request
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default UserCard;

// client/src/components/RequestModal.js
import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const RequestModal = ({ show, onHide, targetUser }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    skillOffered: '',
    skillWanted: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.skillOffered || !formData.skillWanted) {
      toast.error('Please select both skills');
      return;
    }

    setLoading(true);
    
    try {
      await axios.post('/api/requests', {
        toUser: targetUser._id,
        skillOffered: formData.skillOffered,
        skillWanted: formData.skillWanted,
        message: formData.message
      });
      
      toast.success('Request sent successfully!');
      onHide();
      setFormData({ skillOffered: '', skillWanted: '', message: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!user || !targetUser) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Send Skill Swap Request</Modal.Title>
      </Modal.Header>
      
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Alert variant="info">
            <strong>Requesting swap with:</strong> {targetUser.name}
          </Alert>
          
          <Form.Group className="mb-3">
            <Form.Label>Your Skill to Offer</Form.Label>
            <Form.Select 
              name="skillOffered"
              value={formData.skillOffered}
              onChange={handleChange}
              required
            >
              <option value="">Select a skill you offer...</option>
              {user.skillsOffered.map((skill, index) => (
                <option key={index} value={skill}>
                  {skill}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Skill You Want from {targetUser.name}</Form.Label>
            <Form.Select 
              name="skillWanted"
              value={formData.skillWanted}
              onChange={handleChange}
              required
            >
              <option value="">Select a skill they offer...</option>
              {targetUser.skillsOffered.map((skill, index) => (
                <option key={index} value={skill}>
                  {skill}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Message (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Add a personal message..."
            />
          </Form.Group>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RequestModal;

// client/src/pages/HomePage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Pagination, Spinner, Alert } from 'react-bootstrap';
import UserCard from '../components/UserCard';
import RequestModal from '../components/RequestModal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users/public', {
        params: {
          page: currentPage,
          limit: 6,
          search: searchTerm
        }
      });
      
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = (targetUser) => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }
    
    setSelectedUser(targetUser);
    setShowRequestModal(true);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const items = [];
    
    for (let page = 1; page <= totalPages; page++) {
      items.push(
        <Pagination.Item
          key={page}
          active={page === currentPage}
          onClick={() => handlePageChange(page)}
        >
          {page}
        </Pagination.Item>
      );
    }

    return (
      <Pagination className="justify-content-center">
        <Pagination.Prev
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        />
        {items}
        <Pagination.Next
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        />
      </Pagination>
    );
  };

  return (
    <Container className="py-4">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center mb-4">Discover Skills & Connect</h1>
          <p className="text-center text-muted mb-4">
            Find people to exchange skills with and grow together
          </p>
          
          <Form.Control
            type="search"
            placeholder="Search by skills, name, or location..."
            value={searchTerm}
            onChange={handleSearch}
            className="mb-4"
          />
        </Col>
      </Row>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <Alert variant="info" className="text-center">
          {searchTerm ? 'No users found matching your search.' : 'No users found.'}
        </Alert>
      ) : (
        <>
          <Row className="g-4">
            {users.map((user) => (
              <Col key={user._id} md={6} lg={4}>
                <UserCard 
                  user={user} 
                  onSendRequest={handleSendRequest}
                />
              </Col>
            ))}
          </Row>
          
          <div className="mt-5">
            {renderPagination()}
          </div>
        </>
      )}

      <RequestModal
        show={showRequestModal}
        onHide={() => setShowRequestModal(false)}
        targetUser={selectedUser}
      />
    </Container>
  );
};

export default HomePage;

// client/src/pages/LoginPage.js
import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} lg={4}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Login</h2>
              
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="Enter your email"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Enter your password"
                  />
                </Form.Group>

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                </div>
              </Form>

              <div className="text-center mt-3">
                <Link to="#" className="text-decoration-none">
                  Forgot password?
                </Link>
              </div>

              <hr />

              <div className="text-center">
                <span>Don't have an account? </span>
                <Link to="/register" className="text-decoration-none">
                  Sign up
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default LoginPage;

// client/src/pages/RegisterPage.js
import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password
    });
    
    if (result.success) {
      navigate('/profile');
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md={6} lg={4}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Create Account</h2>
              
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Enter your full name"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="Enter your email"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Enter your password"
                    minLength={6}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Confirm your password"
                  />
                </Form.Group>

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </div>
              </Form>

              <hr />

              <div className="text-center">
                <span>Already have an account? </span>
                <Link to="/login" className="text-decoration-none">
                  Sign in
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default RegisterPage;

// client/src/pages/ProfilePage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    skillsOffered: [],
    skillsWanted: [],
    availability: 'Flexible',
    isPublic: true,
    profilePhoto: ''
  });
  const [skillInput, setSkillInput] = useState({ offered: '', wanted: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        location: user.location || '',
        skillsOffered: user.skillsOffered || [],
        skillsWanted: user.skillsWanted || [],
        availability: user.availability || 'Flexible',
        isPublic: user.isPublic !== undefined ? user.isPublic : true,
        profilePhoto: user.profilePhoto || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSkillInputChange = (e) => {
    setSkillInput({
      ...skillInput,
      [e.target.name]: e.target.value
    });
  };

  const addSkill = (type) => {
    const skill = skillInput[type].trim();
    if (skill && !formData[skills${type === 'offered' ? 'Offered' : 'Wanted'}].includes(skill)) {
      setFormData({
        ...formData,
        [skills${type === 'offered' ? 'Offered' : 'Wanted'}]: [
          ...formData[skills${type === 'offered' ? 'Offered' : 'Wanted'}],
          skill
        ]
      });
      setSkillInput({
        ...skillInput,
        [type]: ''
      });
    }
  };

  const removeSkill = (type, index) => {
    const skillType = skills${type === 'offered' ? 'Offered' : 'Wanted'};
    setFormData({
      ...formData,
      [skillType]: formData[skillType].filter((_, i) => i !== index)
    });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData({
          ...formData,
          profilePhoto: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.put('/api/users/profile', formData);
      updateUser(response.data);
      toast.success('Profile updated successfully!');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">My Profile</h2>
              
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={4} className="text-center mb-4">
                    <div className="mb-3">
                      {formData.profilePhoto ? (
                        <img 
                          src={formData.profilePhoto} 
                          alt="Profile"
                          className="profile-photo-large"
                        />
                      ) : (
                        <div 
                          className="profile-photo-large d-flex align-items-center justify-content-center bg-secondary text-white mx-auto"
                          style={{ fontSize: '2rem' }}
                        >
                          {getInitials(formData.name || 'U')}
                        </div>
                      )}
                    </div>
                    
                    <Form.Group>
                      <Form.Label className="btn btn-outline-primary">
                        Upload Photo
                        <Form.Control
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          style={{ display: 'none' }}
                        />
                      </Form.Label>
                    </Form.Group>
                  </Col>
                  
                  <Col md={8}>
                    <Form.Group className="mb-3">
                      <Form.Label>Full Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Location</Form.Label>
                      <Form.Control
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., San Francisco, CA"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Availability</Form.Label>
                      <Form.Select
                        name="availability"
                        value={formData.availability}
                        onChange={handleChange}
                      >
                        <option value="Flexible">Flexible</option>
                        <option value="Weekends">Weekends</option>
                        <option value="Evenings">Evenings</option>
                        <option value="Weekdays">Weekdays</option>
                      </Form.Select>
                    </Form.Group>

                    <Form.Check
                      type="checkbox"
                      name="isPublic"
                      label="Make my profile public"
                      checked={formData.isPublic}
                      onChange={handleChange}
                      className="mb-3"
                    />
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Skills I Offer</Form.Label>
                      <div className="d-flex mb-2">
                        <Form.Control
                          type="text"
                          name="offered"
                          value={skillInput.offered}
                          onChange={handleSkillInputChange}
                          placeholder="Add a skill..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill('offered');
                            }
                          }}
                        />
                        <Button 
                          variant="outline-primary" 
                          onClick={() => addSkill('offered')}
                          className="ms-2"
                        >
                          Add
                        </Button>
                      </div>
                      <div>
                        {formData.skillsOffered.map((skill, index) => (
                          <span key={index} className="skill-tag me-2 mb-2">
                            {skill}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-2"
                              style={{ fontSize: '0.5rem' }}
                              onClick={() => removeSkill('offered', index)}
                            />
                          </span>
                        ))}
                      </div>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Skills I Want</Form.Label>
                      <div className="d-flex mb-2">
                        <Form.Control
                          type="text"
                          name="wanted"
                          value={skillInput.wanted}
                          onChange={handleSkillInputChange}
                          placeholder="Add a skill..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill('wanted');
                            }
                          }}
                        />
                        <Button 
                          variant="outline-primary" 
                          onClick={() => addSkill('wanted')}
                          className="ms-2"
                        >
                          Add
                        </Button>
                      </div>
                      <div>
                        {formData.skillsWanted.map((skill, index) => (
                          <span key={index} className="skill-tag wanted me-2 mb-2">
                            {skill}
                            <button
                              type="button"
                              className="btn-close btn-close-white ms-2"
                              style={{ fontSize: '0.5rem' }}
                              onClick={() => removeSkill('wanted', index)}
                            />
                          </span>
                        ))}
                      </div>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-grid">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? 'Updating...' : 'Update Profile'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfilePage;

// client/src/pages/UserDetailPage.js
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RequestModal from '../components/RequestModal';
import axios from 'axios';

const UserDetailPage = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get(/api/users/${id});
      setUser(response.data);
    } catch (error) {
      setError('User not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = () => {
    if (!currentUser) {
      window.location.href = '/login';
      return;
    }
    setShowRequestModal(true);
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Loading profile...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <Row>
                <Col md={4} className="text-center mb-4">
                  {user.profilePhoto ? (
                    <img 
                      src={user.profilePhoto} 
                      alt={user.name}
                      className="profile-photo-large"
                    />
                  ) : (
                    <div 
                      className="profile-photo-large d-flex align-items-center justify-content-center bg-secondary text-white mx-auto"
                      style={{ fontSize: '2rem' }}
                    >
                      {getInitials(user.name)}
                    </div>
                  )}
                </Col>
                
                <Col md={8}>
                  <h2>{user.name}</h2>
                  
                  {user.location && (
                    <p className="text-muted mb-3">
                      📍 {user.location}
                    </p>
                  )}
                  
                  <div className="mb-3">
                    <Badge bg="info" className="me-