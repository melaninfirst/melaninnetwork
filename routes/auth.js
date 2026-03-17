const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'melanin_network_secret_2026';

// Register
router.post('/register', (req, res) => {
  const { username, email, password, display_name } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Username, email and password required' });

  const hash = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [username.toLowerCase().trim(), email.toLowerCase().trim(), hash, display_name || username],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE'))
          return res.status(409).json({ error: 'Username or email already taken' });
        return res.status(500).json({ error: 'Registration failed' });
      }
      const token = jwt.sign({ userId: this.lastID, username }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, userId: this.lastID, username, display_name: display_name || username });
    }
  );
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token, userId: user.id, username: user.username,
      display_name: user.display_name, avatar_color: user.avatar_color,
      is_verified: user.is_verified
    });
  });
});

// Get current user (me)
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { userId } = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    db.get('SELECT id,username,display_name,bio,avatar_color,location,is_verified,is_on_first,follower_count,following_count,post_count FROM users WHERE id=?', [userId], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

module.exports = router;
