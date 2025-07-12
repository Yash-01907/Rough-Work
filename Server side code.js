
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
