const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'melanin_network.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {

  // Users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar_color TEXT DEFAULT '#7C3AED',
    location TEXT,
    website TEXT,
    is_verified INTEGER DEFAULT 0,
    is_on_first INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Posts
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT,
    image_url TEXT,
    video_url TEXT,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Stories
  db.run(`CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_url TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME DEFAULT (datetime('now', '+24 hours')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Follows
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
  )`);

  // Likes
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
  )`);

  // Comments
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Ad campaigns
  db.run(`CREATE TABLE IF NOT EXISTS ad_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    format TEXT NOT NULL,
    headline TEXT NOT NULL,
    body TEXT,
    cta_url TEXT,
    budget_daily INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    amount_pence INTEGER NOT NULL,
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    status TEXT DEFAULT 'pending',
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    start_date DATETIME,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed sample users if empty
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (row && row.count === 0) {
      const bcrypt = require('bcryptjs');
      const sampleUsers = [
        ['zara_adeyemi',   'zara@example.com',   '#E91E8C', 'Zara Adeyemi',   'London, UK',  1],
        ['king_cuts',      'king@example.com',   '#D4AF37', 'King Cuts',      'Manchester',  0],
        ['naomi_beads',    'naomi@example.com',  '#7C3AED', 'Naomi Beads',    'Birmingham',  0],
        ['chi_jay_music',  'chi@example.com',    '#F97316', 'Chi Jay',        'London, UK',  0],
        ['temi_eats',      'temi@example.com',   '#10B981', 'Temi Eats',      'London, UK',  0],
        ['david_photo',    'david@example.com',  '#3B82F6', 'David Photos',   'Bristol',     0],
      ];
      const hash = bcrypt.hashSync('melanin2026', 10);
      const stmt = db.prepare(`INSERT OR IGNORE INTO users (username, email, password_hash, avatar_color, display_name, location, is_on_first) VALUES (?,?,?,?,?,?,?)`);
      sampleUsers.forEach(([u, e, c, d, l, f]) => stmt.run(u, e, hash, c, d, l, f));
      stmt.finalize();

      // Seed sample posts
      setTimeout(() => {
        db.get("SELECT id FROM users WHERE username='zara_adeyemi'", (e, u) => {
          if (!u) return;
          db.run(`INSERT INTO posts (user_id, content) VALUES (?, ?)`, [u.id, 'Just matched with someone incredible on @melaninfirstuk 🧡 I didn\'t believe it but here we are 🥹 #MelaninFirst #BlackLove #MelaninNetwork']);
          db.run(`UPDATE users SET post_count=1 WHERE id=?`, [u.id]);
        });
        db.get("SELECT id FROM users WHERE username='king_cuts'", (e, u) => {
          if (!u) return;
          db.run(`INSERT INTO posts (user_id, content) VALUES (?, ?)`, [u.id, 'New styles dropping this weekend 💈 Book via @melaninlinksuk — link in bio! #KingCuts #Manchester #BlackBusinesses']);
          db.run(`UPDATE users SET post_count=1 WHERE id=?`, [u.id]);
        });
        db.get("SELECT id FROM users WHERE username='temi_eats'", (e, u) => {
          if (!u) return;
          db.run(`INSERT INTO posts (user_id, content) VALUES (?, ?)`, [u.id, 'Suya night tonight 🔥 Who\'s eating? Drop your location 📍 #SuyaSzn #NigerianFood #LondonEats']);
          db.run(`UPDATE users SET post_count=1 WHERE id=?`, [u.id]);
        });
      }, 500);

      console.log('✅ Sample users seeded');
    }
  });

  console.log('✅ Melanin Network database ready');
});

module.exports = db;
