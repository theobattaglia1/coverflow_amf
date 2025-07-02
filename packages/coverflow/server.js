import basicAuth from 'express-basic-auth';
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === 'production') {
      if (origin.includes('allmyfriendsinc.com')) {
        return callback(null, true);
      }
    } else {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const cookieConfig = {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  domain: process.env.NODE_ENV === 'production' ? '.allmyfriendsinc.com' : undefined
};

console.log('Session cookie configuration:', cookieConfig);
console.log('NODE_ENV:', process.env.NODE_ENV);

app.use(session({
  name: 'amf.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: cookieConfig,
  proxy: process.env.NODE_ENV === 'production'
}));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Session ID: ${req.sessionID}, User: ${req.session?.user?.username || 'none'}`);
  next();
});

// Helper functions
function isAuthenticated(req) {
  return req.session && req.session.user;
}

function isAdminSubdomain(req) {
  return req.hostname.startsWith('admin.');
}

// Routes
// Health check route
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Basic auth for hudson-deck.html - using proper route syntax
app.get('/hudson-deck.html', 
  basicAuth({
    users: { 'guest': 'MakeItTogether25!' },
    challenge: true,
    realm: 'Private Deck'
  }),
  (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'hudson-deck.html'));
  }
);

// Static files for uploads
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: res => res.setHeader('Cache-Control', 'no-store')
}));

// Static files for public directory (excluding hudson-deck.html which has basic auth)
app.use(express.static(PUBLIC_DIR, { 
  extensions: ['html'],
  index: false // Don't serve index.html automatically
}));

// Catch-all route for SPA
app.get('*', (req, res) => {
  // Don't serve index.html for hudson-deck.html
  if (req.path === '/hudson-deck.html') {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});