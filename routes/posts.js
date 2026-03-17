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

// GET /api/posts — feed
router.get('/', (req, res) => {
  const user = getUser(req);
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  const sql = user
    ? `SELECT p.*, u.username, u.display_name, u.avatar_color, u.is_verified, u.is_on_first, u.location,
              EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) as liked_by_me
       FROM posts p JOIN users u ON p.user_id=u.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    : `SELECT p.*, u.username, u.display_name, u.avatar_color, u.is_verified, u.is_on_first, u.location,
              0 as liked_by_me
       FROM posts p JOIN users u ON p.user_id=u.id
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;

  const params = user ? [user.userId, limit, offset] : [limit, offset];
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to load posts' });
    res.json(rows);
  });
});

// POST /api/posts — create post
router.post('/', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required' });
  const { content, image_url } = req.body;
  if (!content && !image_url) return res.status(400).json({ error: 'Post content required' });

  db.run(
    'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
    [user.userId, content || '', image_url || null],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to create post' });
      db.run('UPDATE users SET post_count = post_count + 1 WHERE id = ?', [user.userId]);
      db.get('SELECT p.*, u.username, u.display_name, u.avatar_color, u.is_verified, u.is_on_first FROM posts p JOIN users u ON p.user_id=u.id WHERE p.id=?', [this.lastID], (e, row) => {
        res.json(row);
      });
    }
  );
});

// POST /api/posts/:id/like
router.post('/:id/like', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required' });
  const postId = req.params.id;

  db.get('SELECT 1 FROM likes WHERE post_id=? AND user_id=?', [postId, user.userId], (err, row) => {
    if (row) {
      // Unlike
      db.run('DELETE FROM likes WHERE post_id=? AND user_id=?', [postId, user.userId], () => {
        db.run('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id=?', [postId]);
        res.json({ liked: false });
      });
    } else {
      // Like
      db.run('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [postId, user.userId], () => {
        db.run('UPDATE posts SET like_count = like_count + 1 WHERE id=?', [postId]);
        res.json({ liked: true });
      });
    }
  });
});

// GET /api/posts/:id/comments
router.get('/:id/comments', (req, res) => {
  db.all(
    `SELECT c.*, u.username, u.display_name, u.avatar_color FROM comments c
     JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at ASC`,
    [req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load comments' });
      res.json(rows);
    }
  );
});

// POST /api/posts/:id/comments
router.post('/:id/comments', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Login required' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Comment required' });

  db.run(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
    [req.params.id, user.userId, content],
    function (err) {
      if (err) return res.status(500).json({ error: 'Failed to post comment' });
      db.run('UPDATE posts SET comment_count = comment_count + 1 WHERE id=?', [req.params.id]);
      res.json({ id: this.lastID, content, username: user.username });
    }
  );
});

module.exports = router;
