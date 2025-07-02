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

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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

app.use(cors(corsOptions));
app.use(express.json());

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

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Session ID: ${req.sessionID}, User: ${req.session?.user?.username || 'none'}`);
  next();
});

function isAuthenticated(req) {
  return req.session && req.session.user;
}

function isAdminSubdomain(req) {
  return req.hostname.startsWith('admin.');
}

// Basic auth for hudson-deck.html
app.use('/hudson-deck.html', basicAuth({
  users: { 'guest': 'MakeItTogether25!' },
  challenge: true,
  realm: 'Private Deck'
}));

// Static files
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: res => res.setHeader('Cache-Control', 'no-store')
}));
