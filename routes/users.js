const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'melanin_network_secret_2026';

function getUser(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    return jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
  } catch { return null; }
}

// GET /api/users/suggested
router.get('/suggested', (req, res) => {
  const user = getUser(req);
  const excludeId = user ? user.userId : 0;
  db.all(
    `SELECT id, username, display_name, avatar_color, is_verified, is_on_first, location, follower_count
     FROM users WHERE id != ? ORDER BY follower_count DESC, RANDOM() LIMIT 8`,
    [excludeId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed' });
      res.json(rows);
    }
  );
});

// GET /api/users/stories
router.get('/stories', (req, res) => {
  db.all(
    `SELECT s.*, u.username, u.display_name, u.avatar_color, u.is_on_first
     FROM stories s JOIN users u ON s.user_id=u.id
     WHERE s.expires_at > datetime('now')
     ORDER BY s.created_at DESC LIMIT 15`,
    [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed' });
      res.json(rows);
    }
  );
});

// GET /api/users/:username
router.get('/:username', (req, res) => {
  db.get(
    `SELECT id, username, display_name, bio, avatar_color, location, website,
            is_verified, is_on_first, follower_count, following_count, post_count, created_at
     FROM users WHERE username=?`,
    [req.params.username], (err, user) => {
      if (err || !user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    }
  );
});

// GET /api/users/:username/posts
router.get('/:username/posts', (req, res) => {
  db.all(
    `SELECT p.* FROM posts p JOIN users u ON p.user_id=u.id
     WHERE u.username=? ORDER BY p.created_at DESC LIMIT 20`,
    [req.params.username], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed' });
      res.json(rows);
    }
  );
});

// POST /api/users/:username/follow
router.post('/:username/follow', (req, res) => {
  const me = getUser(req);
  if (!me) return res.status(401).json({ error: 'Login required' });

  db.get('SELECT id FROM users WHERE username=?', [req.params.username], (err, target) => {
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === me.userId) return res.status(400).json({ error: 'Cannot follow yourself' });

    db.get('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?', [me.userId, target.id], (err, row) => {
      if (row) {
        // Unfollow
        db.run('DELETE FROM follows WHERE follower_id=? AND following_id=?', [me.userId, target.id], () => {
          db.run('UPDATE users SET follower_count=MAX(0,follower_count-1) WHERE id=?', [target.id]);
          db.run('UPDATE users SET following_count=MAX(0,following_count-1) WHERE id=?', [me.userId]);
          res.json({ following: false });
        });
      } else {
        // Follow
        db.run('INSERT INTO follows (follower_id, following_id) VALUES (?,?)', [me.userId, target.id], () => {
          db.run('UPDATE users SET follower_count=follower_count+1 WHERE id=?', [target.id]);
          db.run('UPDATE users SET following_count=following_count+1 WHERE id=?', [me.userId]);
          res.json({ following: true });
        });
      }
    });
  });
});

// GET /api/users/search?q=
router.get('/search', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  db.all(
    `SELECT id, username, display_name, avatar_color, is_verified FROM users
     WHERE username LIKE ? OR display_name LIKE ? LIMIT 10`,
    [q, q], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed' });
      res.json(rows);
    }
  );
});

module.exports = router;
