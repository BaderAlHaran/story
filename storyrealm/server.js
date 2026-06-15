require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Storage layer
//
// If MONGODB_URI is set, conversations and cached portraits are stored in
// MongoDB (durable across restarts/redeploys). Otherwise we fall back to
// JSON files under data/ so the app still works locally with no database.
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

let db = null; // MongoDB database handle (null = file mode)

async function initStorage() {
  if (process.env.MONGODB_URI) {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('storyrealm');
    // Helpful indexes (no-op if they already exist)
    await db.collection('conversations').createIndex({ characterId: 1 }, { unique: true });
    await db.collection('images').createIndex({ hash: 1 }, { unique: true });
    await db.collection('characters').createIndex({ id: 1 }, { unique: true });
    console.log('Storage: MongoDB connected');
  } else {
    for (const dir of [DATA_DIR, IMAGES_DIR]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    console.log('Storage: local JSON files (set MONGODB_URI to use a database)');
  }
}

// Sanitize characterId so it can't escape the data folder
function safeId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}
function historyPath(characterId) {
  return path.join(DATA_DIR, `${safeId(characterId)}.json`);
}

// --- Storage helpers (work in either MongoDB or file mode) ---
async function getHistory(characterId) {
  const id = safeId(characterId);
  if (db) {
    const doc = await db.collection('conversations').findOne({ characterId: id });
    return doc?.messages || [];
  }
  const file = historyPath(id);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

async function saveHistory(characterId, messages) {
  const id = safeId(characterId);
  if (db) {
    await db.collection('conversations').updateOne(
      { characterId: id },
      { $set: { characterId: id, messages, updatedAt: new Date() } },
      { upsert: true }
    );
    return;
  }
  fs.writeFileSync(historyPath(id), JSON.stringify(messages, null, 2));
}

async function deleteHistory(characterId) {
  const id = safeId(characterId);
  if (db) {
    await db.collection('conversations').deleteOne({ characterId: id });
    return;
  }
  const file = historyPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

async function getCachedImage(hash) {
  if (db) {
    const doc = await db.collection('images').findOne({ hash });
    return doc?.image || null;
  }
  const file = path.join(IMAGES_DIR, `${hash}.txt`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}

async function saveCachedImage(hash, image) {
  if (db) {
    await db.collection('images').updateOne(
      { hash },
      { $set: { hash, image, createdAt: new Date() } },
      { upsert: true }
    );
    return;
  }
  fs.writeFileSync(path.join(IMAGES_DIR, `${hash}.txt`), image);
}

// --- Usage tracking (estimated credit balance) ---
// claude-sonnet-4-6 pricing: $3.00 / 1M input tokens, $15.00 / 1M output tokens.
const PRICE_INPUT_PER_TOKEN = 3.0 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 15.0 / 1_000_000;
const STARTING_CREDIT = parseFloat(process.env.STARTING_CREDIT || '5');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');

async function getSpent() {
  if (db) {
    const doc = await db.collection('meta').findOne({ key: 'usage' });
    return doc?.spent || 0;
  }
  if (!fs.existsSync(USAGE_FILE)) return 0;
  try {
    return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8')).spent || 0;
  } catch {
    return 0;
  }
}

async function addSpent(costDelta) {
  const current = await getSpent();
  const spent = current + costDelta;
  if (db) {
    await db.collection('meta').updateOne(
      { key: 'usage' },
      { $set: { key: 'usage', spent, updatedAt: new Date() } },
      { upsert: true }
    );
  } else {
    fs.writeFileSync(USAGE_FILE, JSON.stringify({ spent }, null, 2));
  }
  return spent;
}

// --- Custom character storage (persists across refreshes/redeploys) ---
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');

async function listCharacters() {
  if (db) {
    return await db.collection('characters').find({}).sort({ createdAt: 1 }).toArray();
  }
  if (!fs.existsSync(CHARACTERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

async function saveCharacter(char) {
  if (db) {
    await db.collection('characters').updateOne(
      { id: char.id },
      { $set: { ...char, createdAt: new Date() } },
      { upsert: true }
    );
    return;
  }
  const all = await listCharacters();
  const next = [...all.filter((c) => c.id !== char.id), char];
  fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(next, null, 2));
}

async function deleteCharacter(id) {
  const cid = safeId(id);
  if (db) {
    await db.collection('characters').deleteOne({ id: cid });
  } else {
    const all = await listCharacters();
    fs.writeFileSync(
      CHARACTERS_FILE,
      JSON.stringify(all.filter((c) => c.id !== cid), null, 2)
    );
  }
}

// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// --- Auth ---
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- POST /api/login ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (
    username === process.env.APP_USERNAME &&
    password === process.env.APP_PASSWORD
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Incorrect username or password' });
});

// --- POST /api/chat ---
app.post('/api/chat', authMiddleware, async (req, res) => {
  const { systemPrompt, messages, characterId } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt || '',
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Claude API error' });
    }

    const reply = data.content?.[0]?.text || '';

    if (characterId) {
      await saveHistory(characterId, [...messages, { role: 'assistant', content: reply }]);
    }

    // Track estimated cost from real token usage
    const usage = data.usage || {};
    const inTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
    const outTokens = usage.output_tokens || 0;
    const cost = inTokens * PRICE_INPUT_PER_TOKEN + outTokens * PRICE_OUTPUT_PER_TOKEN;
    const spent = await addSpent(cost);

    return res.json({
      reply,
      balance: Math.max(0, STARTING_CREDIT - spent),
      spent,
    });
  } catch (err) {
    console.error('Claude API request failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Custom characters ---
app.get('/api/characters', authMiddleware, async (req, res) => {
  const characters = await listCharacters();
  return res.json({ characters });
});

app.post('/api/characters', authMiddleware, async (req, res) => {
  const { character } = req.body || {};
  if (!character || !character.id || !character.name) {
    return res.status(400).json({ error: 'character with id and name is required' });
  }
  character.id = safeId(character.id);
  await saveCharacter(character);
  return res.json({ ok: true, character });
});

app.delete('/api/characters/:id', authMiddleware, async (req, res) => {
  await deleteCharacter(req.params.id);
  await deleteHistory(req.params.id); // also remove its story
  return res.json({ ok: true });
});

// --- GET /api/usage ---
app.get('/api/usage', authMiddleware, async (req, res) => {
  const spent = await getSpent();
  return res.json({
    spent,
    balance: Math.max(0, STARTING_CREDIT - spent),
    starting: STARTING_CREDIT,
  });
});

// --- GET /api/history/:characterId ---
app.get('/api/history/:characterId', authMiddleware, async (req, res) => {
  const messages = await getHistory(req.params.characterId);
  return res.json({ messages });
});

// --- DELETE /api/history/:characterId ---
app.delete('/api/history/:characterId', authMiddleware, async (req, res) => {
  await deleteHistory(req.params.characterId);
  return res.json({ ok: true });
});

// --- POST /api/generate-image ---
app.post('/api/generate-image', authMiddleware, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const hash = crypto.createHash('md5').update(prompt).digest('hex');

  const cached = await getCachedImage(hash);
  if (cached) return res.json({ image: cached, cached: true });

  try {
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Image generation failed: ${errText}` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUri = `data:${contentType};base64,${base64}`;

    await saveCachedImage(hash, dataUri);

    return res.json({ image: dataUri, cached: false });
  } catch (err) {
    console.error('Image generation failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Serve built React app in production ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

initStorage()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize storage:', err);
    process.exit(1);
  });
