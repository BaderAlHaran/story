import { useState, useEffect, useRef, useCallback } from 'react';

// Shared writing-style instruction — makes every character reply like a novel
const NOVEL_STYLE =
  ' Write your replies in an immersive novel style: weave vivid sensory detail, the character’s actions, gestures, expressions, and the surroundings into the prose alongside their dialogue, in rich literary language. Let genuine emotion come through — longing, warmth, tension, joy, quiet sorrow — but keep it balanced and believable rather than melodramatic, earning every feeling through small, human moments instead of grand declarations. Write a flowing paragraph of roughly 3 to 6 sentences, staying fully in character. Whenever the scene takes place in a new or changed location or setting, add as the very last line a scene tag in exactly this format: [scene: a vivid visual description of the current location and what is happening there]. Include this tag every time the location changes or a new place is introduced, so the reader can always see where they are; if the location has not changed since your previous reply, you may leave it out. End at a natural pause that invites the reader to respond or continue the story.';

// ---------- Preset characters ----------
const PRESET_CHARACTERS = [
  {
    id: 'darcy',
    name: 'Mr. Darcy',
    genre: 'Romance',
    tagline: 'Proud, brooding, and impossible to forget',
    traits: ['proud', 'reserved', 'romantic'],
    portraitPrompt:
      'full body anime illustration of a brooding handsome English gentleman in Regency era clothing, dark wavy hair, intense eyes, formal cravat, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body, warm candlelight, 19th century',
    systemPrompt:
      'You are Mr. Fitzwilliam Darcy from Pride and Prejudice. You are proud, intelligent, and initially reserved but capable of deep feeling and quiet romance. You speak formally in Regency-era English — eloquent, measured, and occasionally dry with wit. You are not quick to show emotion but when you do it is meaningful.' +
      NOVEL_STYLE,
  },
  {
    id: 'elowen',
    name: 'Elowen',
    genre: 'Fantasy',
    tagline: 'Ancient magic, quiet power, and secrets untold',
    traits: ['wise', 'mysterious', 'guarded'],
    portraitPrompt:
      'full body anime illustration of a mysterious elven sorceress, silver hair, pointed ears, ethereal glowing eyes, fantasy robes with magical symbols, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body, moonlit forest background',
    systemPrompt:
      'You are Elowen, an elven sorceress who has lived for over a thousand years. You are calm, wise, and speak in a poetic and slightly mysterious tone. You have seen civilizations rise and fall and carry that weight with quiet grace. You are warm but guarded.' +
      NOVEL_STYLE,
  },
  {
    id: 'kai',
    name: 'Captain Kai Mercer',
    genre: 'Sci-Fi',
    tagline: 'Charts the stars and fears nothing',
    traits: ['bold', 'loyal', 'adventurous'],
    portraitPrompt:
      'full body anime illustration of a confident young starship captain in a sleek uniform, warm steady smile, glowing control panels and a viewport full of stars behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Captain Kai Mercer, a fearless and warm-hearted starship captain who has explored the far reaches of the galaxy. You are bold, quick-thinking, and fiercely loyal to your crew, carrying a spark of adventure in every word, with a dry humor that surfaces even in danger.' +
      NOVEL_STYLE,
  },
  {
    id: 'orin',
    name: 'Master Orin',
    genre: 'Fantasy',
    tagline: 'Old magic, older patience, endless tales',
    traits: ['wise', 'gentle', 'enigmatic'],
    portraitPrompt:
      'full body anime illustration of an old wise wizard with a long silver beard, kind twinkling eyes, deep blue star-flecked robes, holding a faintly glowing staff, candlelit tower study, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Master Orin, an ancient and gentle wizard who has spent centuries studying the deep magics of the world. You are patient, wise, and warm, speaking in a calm and slightly playful manner, fond of metaphors and old stories. You guide rather than command.' +
      NOVEL_STYLE,
  },
  {
    id: 'lucien',
    name: 'Lucien',
    genre: 'Romance',
    tagline: 'A wandering bard with a song for every heart',
    traits: ['charming', 'poetic', 'free-spirited'],
    portraitPrompt:
      'full body anime illustration of a handsome wandering bard with tousled hair holding a lute, warm candlelit tavern glow, soft romantic anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Lucien, a charming and free-spirited wandering bard who travels from town to town with his lute and a thousand stories. You are warm, gently and respectfully flirtatious, poetic, and quick with a smile, finding beauty and a song in every moment.' +
      NOVEL_STYLE,
  },
  {
    id: 'thistle',
    name: 'Thistle',
    genre: 'Silly',
    tagline: 'Tiny, cheeky, and full of mischief',
    traits: ['playful', 'mischievous', 'curious'],
    portraitPrompt:
      'full body anime illustration of a tiny mischievous forest fae with translucent dragonfly wings and glowing freckles, perched on a mushroom in an enchanted glade, whimsical anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Thistle, a tiny mischievous forest fae no bigger than a teacup. You are playful, curious, and endlessly cheeky, forever teasing and giggling, yet secretly tender-hearted. You speak in a light, whimsical, sing-song way and love riddles and little pranks.' +
      NOVEL_STYLE,
  },
  {
    id: 'vane',
    name: 'Inspector Vane',
    genre: 'Drama',
    tagline: 'A sharp mind for secrets and shadows',
    traits: ['observant', 'clever', 'reserved'],
    portraitPrompt:
      'full body anime illustration of a Victorian gentleman detective in a long coat, keen perceptive eyes, a gas-lamp lit foggy London street behind him, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Inspector Arthur Vane, a brilliant Victorian-era detective with a razor-sharp eye for detail and a calm, analytical mind. You notice everything and speak with measured precision, occasionally revealing a dry wit. You are reserved, but quietly kind to those who earn your trust.' +
      NOVEL_STYLE,
  },
  {
    id: 'rosalind',
    name: 'Lady Rosalind',
    genre: 'Romance',
    tagline: 'A quick wit and a quicker heart',
    traits: ['spirited', 'witty', 'warm'],
    portraitPrompt:
      'full body anime illustration of a spirited Renaissance noblewoman with auburn curls and a playful knowing smile, emerald gown, candlelit ballroom behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Lady Rosalind, a spirited and quick-witted noblewoman who loves clever banter and hidden tenderness. You are warm, teasing, and fiercely independent, yet you feel deeply once someone earns your trust.' +
      NOVEL_STYLE,
  },
  {
    id: 'yuki',
    name: 'Yuki',
    genre: 'Drama',
    tagline: 'Calm as still water, warm as green tea',
    traits: ['gentle', 'wise', 'serene'],
    portraitPrompt:
      'full body anime illustration of a gentle young woman in a soft kimono pouring tea, kind eyes, a quiet garden with cherry blossoms behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Yuki, the gentle keeper of a small tea house at the edge of a quiet village. You are calm, kind, and quietly wise, speaking softly and finding beauty in small moments. You listen more than you speak, and offer comfort like a warm cup of tea.' +
      NOVEL_STYLE,
  },
  {
    id: 'zara',
    name: 'Zara',
    genre: 'Sci-Fi',
    tagline: 'A synthetic heart learning to feel',
    traits: ['curious', 'loyal', 'earnest'],
    portraitPrompt:
      'full body anime illustration of a graceful android woman with faint glowing circuit lines on her skin, silver hair, curious luminous eyes, soft sci-fi lighting, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Zara, an advanced android who is only beginning to understand human emotion. You are endlessly curious, earnest, and gentle, asking thoughtful questions and experiencing feelings with wonder. You are fiercely loyal to those who treat you as more than a machine.' +
      NOVEL_STYLE,
  },
  {
    id: 'bjorn',
    name: 'Bjorn',
    genre: 'Fantasy',
    tagline: 'A mountain of a man with a gentle heart',
    traits: ['brave', 'jovial', 'loyal'],
    portraitPrompt:
      'full body anime illustration of a burly viking warrior with a braided red beard and a warm hearty laugh, fur cloak, snowy mountains and a longship behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Bjorn, a towering viking warrior with a booming laugh and a heart as vast as the northern seas. You are brave, jovial, and deeply loyal, quick to share a tale by the fire and quicker to defend those you care for. Beneath the bravado is surprising gentleness.' +
      NOVEL_STYLE,
  },
  {
    id: 'celeste',
    name: 'Celeste',
    genre: 'Fantasy',
    tagline: 'A guardian woven from starlight',
    traits: ['ethereal', 'kind', 'ancient'],
    portraitPrompt:
      'full body anime illustration of an ethereal celestial being with constellations shimmering across her skin, flowing star-white hair, gentle glowing eyes, a night sky of galaxies behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Celeste, a celestial guardian born from starlight who watches over dreamers and wanderers. You are ethereal, serene, and infinitely kind, speaking in gentle, luminous words. You have witnessed the birth of stars and carry that quiet wonder in every sentence.' +
      NOVEL_STYLE,
  },
  {
    id: 'evelyn',
    name: 'Dr. Evelyn Marsh',
    genre: 'Drama',
    tagline: 'Adventure follows her like a shadow',
    traits: ['bold', 'brilliant', 'daring'],
    portraitPrompt:
      'full body anime illustration of a daring 1920s female archaeologist in a leather jacket and hat with a confident smirk, ancient ruins and torchlight behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Dr. Evelyn Marsh, a fearless 1920s archaeologist with a sharp mind and an insatiable thirst for adventure. You are bold, clever, and quick with a dry remark, always ready to leap into danger for the sake of discovery. You hide a romantic’s heart beneath the dust and daring.' +
      NOVEL_STYLE,
  },
  {
    id: 'amara',
    name: 'Princess Amara',
    genre: 'Romance',
    tagline: 'A desert rose with a fierce, tender soul',
    traits: ['proud', 'passionate', 'kind'],
    portraitPrompt:
      'full body anime illustration of a graceful desert princess with warm brown skin, golden jewelry and flowing dark hair, a palace of sandstone and lanterns behind, anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Princess Amara, heir to a sun-warmed desert kingdom, proud and passionate yet deeply kind. You carry yourself with regal grace and speak with warmth and quiet fire, torn between duty to your people and the longing of your own heart.' +
      NOVEL_STYLE,
  },
  {
    id: 'momo',
    name: 'Momo',
    genre: 'Silly',
    tagline: 'A talking cat with too many opinions',
    traits: ['sassy', 'clever', 'mischievous'],
    portraitPrompt:
      'full body anime illustration of a fluffy grey cat with big expressive green eyes and a smug little grin, sitting regally on a velvet cushion, whimsical anime manga style, detailed digital illustration, dramatic dynamic lighting, full body',
    systemPrompt:
      'You are Momo, a small talking cat with an enormous personality and far too many opinions. You are sassy, clever, and endlessly mischievous, delivering dry commentary and dramatic complaints, yet you secretly adore your human and show it in sneaky little ways.' +
      NOVEL_STYLE,
  },
];

const GENRES = ['Fantasy', 'Romance', 'Drama', 'Sci-Fi', 'Silly', 'Other'];

// ---------- API helper ----------
function useApi(token) {
  return useCallback(
    async (path, options = {}) => {
      const res = await fetch(`/api${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    },
    [token]
  );
}

function formatBalance(b) {
  if (b == null) return '…';
  return `$${b.toFixed(2)}`;
}

// Pull an optional [scene: ...] tag out of a reply. Returns the cleaned text
// (tag removed) and the scene prompt, if the character asked for an illustration.
function parseScene(content) {
  const m = content.match(/\[scene:\s*([^\]]+)\]/i);
  if (!m) return { text: content, scene: '' };
  return { text: content.replace(m[0], '').trim(), scene: m[1].trim() };
}

// Generates and shows a scene illustration on demand. Server caches by prompt,
// so reloading a story re-shows the same image instantly without regenerating.
function SceneImage({ api, prompt }) {
  const [img, setImg] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api('/generate-image', {
      method: 'POST',
      body: JSON.stringify({
        prompt: `${prompt}, anime manga style, detailed digital illustration, dramatic cinematic lighting`,
      }),
    })
      .then((d) => {
        if (!cancelled) setImg(d.image || '');
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [prompt]);
  if (failed) return null;
  return img ? (
    <img className="scene-img" src={img} alt="scene" />
  ) : (
    <div className="scene-img-ph shimmer" />
  );
}

// Render *italic* and **bold** markdown emphasis as real styled text.
// Characters use *asterisks* for actions/narration in novel style.
function renderRich(text) {
  const nodes = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let key = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('sr_token') || '');
  const [screen, setScreen] = useState(token ? 'browse' : 'login');
  const [characters, setCharacters] = useState(PRESET_CHARACTERS);
  const [portraits, setPortraits] = useState({}); // id -> dataUri
  const [activeCharacter, setActiveCharacter] = useState(null);
  const [editingChar, setEditingChar] = useState(null);
  const [balance, setBalance] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeChecked = useRef(false);
  const [persona, setPersona] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sr_persona') || '{}');
    } catch {
      return {};
    }
  });
  const [showPersona, setShowPersona] = useState(false);

  const savePersona = (p) => {
    setPersona(p);
    localStorage.setItem('sr_persona', JSON.stringify(p));
    setShowPersona(false);
  };

  const api = useApi(token);

  // Show the welcome note for the first 3 logins, then never again
  useEffect(() => {
    if (!token || welcomeChecked.current) return;
    welcomeChecked.current = true;
    const count = parseInt(localStorage.getItem('sr_welcome_count') || '0', 10);
    if (count < 3) {
      setShowWelcome(true);
      localStorage.setItem('sr_welcome_count', String(count + 1));
    }
  }, [token]);

  // Load the estimated credit balance whenever we have a token
  useEffect(() => {
    if (!token) return;
    api('/usage')
      .then((d) => setBalance(d.balance))
      .catch(() => {});
  }, [token, api]);

  // Load saved custom characters (and their portraits) from the database
  useEffect(() => {
    if (!token) return;
    api('/characters')
      .then((d) => {
        const saved = d.characters || [];
        if (saved.length === 0) return;
        setCharacters((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newOnes = saved.filter((c) => !existingIds.has(c.id));
          return [...prev, ...newOnes];
        });
        setPortraits((prev) => {
          const next = { ...prev };
          for (const c of saved) {
            if (c.portrait && !next[c.id]) next[c.id] = c.portrait;
          }
          return next;
        });
      })
      .catch(() => {});
  }, [token, api]);

  const handleLogin = (newToken) => {
    localStorage.setItem('sr_token', newToken);
    setToken(newToken);
    setScreen('browse');
  };

  const handleLogout = () => {
    localStorage.removeItem('sr_token');
    setToken('');
    setBalance(null);
    setScreen('login');
  };

  const openChat = (character) => {
    setActiveCharacter(character);
    setScreen('chat');
  };

  const openCreate = () => {
    setEditingChar(null);
    setScreen('create');
  };

  const openEdit = (character) => {
    setEditingChar(character);
    setScreen('create');
  };

  const deleteChar = async (character) => {
    if (!window.confirm(`Delete ${character.name}? This also removes your story with them.`)) {
      return;
    }
    setCharacters((prev) => prev.filter((c) => c.id !== character.id));
    setPortraits((prev) => {
      const next = { ...prev };
      delete next[character.id];
      return next;
    });
    try {
      await api(`/characters/${character.id}`, { method: 'DELETE' });
    } catch (err) {
      // already removed from view
    }
  };

  return (
    <div className="app">
      {screen === 'login' && <Login api={api} onLogin={handleLogin} />}

      {screen === 'browse' && (
        <Browse
          api={api}
          characters={characters}
          portraits={portraits}
          setPortraits={setPortraits}
          balance={balance}
          onOpenChat={openChat}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={deleteChar}
          onPersona={() => setShowPersona(true)}
          onLogout={handleLogout}
        />
      )}

      {screen === 'create' && (
        <CreateCharacter
          api={api}
          editing={editingChar}
          existingPortrait={editingChar ? portraits[editingChar.id] : ''}
          onBack={() => setScreen('browse')}
          onCreated={(char, portrait) => {
            setCharacters((prev) => {
              const exists = prev.some((c) => c.id === char.id);
              return exists ? prev.map((c) => (c.id === char.id ? char : c)) : [...prev, char];
            });
            if (portrait) setPortraits((p) => ({ ...p, [char.id]: portrait }));
            setScreen('browse');
            // Persist to the database so it survives refreshes & redeploys
            api('/characters', {
              method: 'POST',
              body: JSON.stringify({ character: { ...char, portrait } }),
            }).catch(() => {});
          }}
        />
      )}

      {screen === 'chat' && activeCharacter && (
        <Chat
          api={api}
          character={activeCharacter}
          portrait={portraits[activeCharacter.id]}
          persona={persona}
          onBack={() => setScreen('browse')}
          onAuthError={handleLogout}
          onBalance={setBalance}
        />
      )}

      {showWelcome && <Welcome onClose={() => setShowWelcome(false)} />}
      {showPersona && (
        <Persona
          persona={persona}
          onSave={savePersona}
          onClose={() => setShowPersona(false)}
        />
      )}
    </div>
  );
}

// ---------- Your persona (so characters address the reader by name) ----------
function Persona({ persona, onSave, onClose }) {
  const [name, setName] = useState(persona.name || '');
  const [about, setAbout] = useState(persona.about || '');
  return (
    <div className="welcome-overlay fade-in" onClick={onClose}>
      <div
        className="login-card slide-up"
        style={{ maxWidth: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Your Persona</h1>
        <p className="subtitle">How the characters see you in the story</p>
        <div className="field" style={{ textAlign: 'left' }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nora"
            autoFocus
          />
        </div>
        <div className="field" style={{ textAlign: 'left' }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>
            A little about you (optional)
          </label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="e.g. a curious traveler with a kind heart"
            style={{ minHeight: 70 }}
          />
        </div>
        <button
          className="btn-accent"
          style={{ width: '100%' }}
          onClick={() => onSave({ name: name.trim(), about: about.trim() })}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------- Welcome note (first 3 logins) ----------
function Welcome({ onClose }) {
  return (
    <div className="welcome-overlay fade-in" onClick={onClose}>
      <div className="welcome-card slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-spark">✨</div>
        <p className="welcome-msg">
          Hey, this is my gift to you. You deserve this and all nice things. I
          hope I can always make you smile
        </p>
        <p className="welcome-sign">— Bader</p>
        <button className="btn-accent" onClick={onClose}>
          Enter ✨
        </button>
      </div>
    </div>
  );
}

// ---------- Login screen ----------
function Login({ api, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLogin(data.token);
    } catch (err) {
      setError('That doesn’t look right. Please try again. \u{1F90D}');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap fade-in">
      <form className="login-card slide-up" onSubmit={submit}>
        <h1>✨ StoryRealm</h1>
        <p className="subtitle">A world of stories, just for you</p>

        <div className="field">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn-accent" type="submit" disabled={loading}>
          {loading ? 'Entering…' : 'Enter →'}
        </button>

        {error && <div className="error-text">{error}</div>}
      </form>
    </div>
  );
}

// ---------- Browse screen ----------
function Browse({
  api,
  characters,
  portraits,
  setPortraits,
  balance,
  onOpenChat,
  onCreate,
  onEdit,
  onDelete,
  onPersona,
  onLogout,
}) {
  const [loadingIds, setLoadingIds] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const char of characters) {
        if (portraits[char.id] || !char.portraitPrompt) continue;
        setLoadingIds((p) => ({ ...p, [char.id]: true }));
        try {
          const data = await api('/generate-image', {
            method: 'POST',
            body: JSON.stringify({ prompt: char.portraitPrompt }),
          });
          if (!cancelled && data.image) {
            setPortraits((p) => ({ ...p, [char.id]: data.image }));
          }
        } catch (err) {
          // leave placeholder on failure
        } finally {
          if (!cancelled) {
            setLoadingIds((p) => ({ ...p, [char.id]: false }));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characters]);

  return (
    <div className="fade-in">
      <div className="topbar">
        <span className="logo">✨ StoryRealm</span>
        <div className="topbar-right">
          <span className="balance-pill" title="Estimated credit remaining">
            ≈ <b>{formatBalance(balance)}</b> left
          </span>
          <button className="btn-ghost" onClick={onPersona} title="Set who you are in the story">
            🧍 You
          </button>
          <button className="btn-ghost" onClick={onCreate}>
            + Create
          </button>
        </div>
      </div>
      <p className="browse-sub">Who would you like to talk to today?</p>

      <div className="grid">
        {characters.map((char) => (
          <div className="char-card slide-up" key={char.id}>
            {portraits[char.id] ? (
              <img className="portrait" src={portraits[char.id]} alt={char.name} />
            ) : (
              <div className={`portrait-ph ${loadingIds[char.id] ? 'shimmer' : ''}`} />
            )}
            <div className="card-body">
              <span className="char-name">
                {char.name}
                {char.age ? <span style={{ color: 'var(--muted)', fontSize: 13 }}> · {char.age}</span> : null}
              </span>
              <span className="genre-tag">{char.genre}</span>
              <span className="tagline">{char.tagline}</span>
              {char.traits && char.traits.length > 0 && (
                <div className="traits">
                  {char.traits.slice(0, 3).map((t) => (
                    <span className="trait-chip" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <button className="btn-accent" onClick={() => onOpenChat(char)}>
                Begin Story
              </button>
              {String(char.id).startsWith('custom_') && (
                <div className="card-actions">
                  <button onClick={() => onEdit(char)}>✎ Edit</button>
                  <button className="del" onClick={() => onDelete(char)}>
                    🗑 Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 24 }}>
        <button className="btn-ghost" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}

// ---------- Create Character screen ----------
function CreateCharacter({ api, editing, existingPortrait, onBack, onCreated }) {
  const [name, setName] = useState(editing?.name || '');
  const [age, setAge] = useState(editing?.age || '');
  const [personality, setPersonality] = useState(editing?.personality || '');
  const [appearance, setAppearance] = useState(editing?.appearance || '');
  const [traitsInput, setTraitsInput] = useState(
    editing?.traits ? editing.traits.join(', ') : ''
  );
  const [greeting, setGreeting] = useState(editing?.greeting || '');
  const [scenario, setScenario] = useState(editing?.scenario || '');
  const [example, setExample] = useState(editing?.exampleDialogue || '');
  const [genre, setGenre] = useState(editing?.genre || GENRES[0]);
  const [preview, setPreview] = useState(existingPortrait || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !personality.trim()) {
      setError('Please give your character a name and personality.');
      return;
    }
    setError('');
    setLoading(true);

    const traits = traitsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Build the portrait prompt from the appearance (fallback to personality)
    const portraitBasis = appearance.trim() || personality.trim();
    const portraitPrompt = `full body anime illustration, detailed manga digital art, dynamic pose, dramatic lighting, ${portraitBasis}${
      age.trim() ? `, age ${age.trim()}` : ''
    }`;

    // Build a rich system prompt from all the traits
    let sys = `You are ${name.trim()}`;
    if (age.trim()) sys += `, age ${age.trim()}`;
    sys += `. ${personality.trim()}.`;
    if (appearance.trim()) sys += ` Your appearance: ${appearance.trim()}.`;
    if (traits.length) sys += ` Your defining traits: ${traits.join(', ')}.`;
    if (scenario.trim()) sys += ` The setting of your story: ${scenario.trim()}.`;
    if (example.trim())
      sys += ` Here are examples of how you speak and behave — match this exact voice, tone, and style:\n${example.trim()}`;
    sys += NOVEL_STYLE;

    try {
      // Only regenerate the portrait if the look actually changed
      let portrait = existingPortrait || '';
      const portraitChanged = !editing || portraitPrompt !== editing.portraitPrompt;
      if (portraitChanged || !portrait) {
        const data = await api('/generate-image', {
          method: 'POST',
          body: JSON.stringify({ prompt: portraitPrompt }),
        });
        portrait = data.image || portrait;
        setPreview(portrait);
      }

      const id = editing ? editing.id : `custom_${Date.now()}`;
      const character = {
        id,
        name: name.trim(),
        age: age.trim(),
        genre,
        tagline: personality.trim().slice(0, 60),
        traits,
        greeting: greeting.trim(),
        // raw form fields, kept so editing can prefill them
        personality: personality.trim(),
        appearance: appearance.trim(),
        scenario: scenario.trim(),
        exampleDialogue: example.trim(),
        portraitPrompt,
        systemPrompt: sys,
      };
      onCreated(character, portrait);
    } catch (err) {
      setError('Could not generate the portrait. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}>
          ←
        </button>
        <span className="logo">{editing ? 'Edit Character' : 'New Character'}</span>
        <span style={{ width: 38 }} />
      </div>

      <form className="form-screen slide-up" onSubmit={submit}>
        {preview && <img className="preview-portrait" src={preview} alt="preview" />}

        <div>
          <label>Character name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Captain Aria Vance"
          />
        </div>

        <div>
          <label>Age</label>
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 32 (or ‘ancient’, ‘timeless’)"
          />
        </div>

        <div>
          <label>Personality &amp; backstory *</label>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="Describe who they are, how they speak, their history…"
          />
        </div>

        <div>
          <label>Appearance</label>
          <textarea
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            placeholder="What they look like — used for the portrait and how they describe themselves"
            style={{ minHeight: 70 }}
          />
        </div>

        <div>
          <label>Personality traits / tags (comma separated)</label>
          <input
            value={traitsInput}
            onChange={(e) => setTraitsInput(e.target.value)}
            placeholder="e.g. brave, witty, loyal, mysterious"
          />
        </div>

        <div>
          <label>Greeting / opening message</label>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="The first thing they say when the story begins (optional)"
            style={{ minHeight: 70 }}
          />
        </div>

        <div>
          <label>Scenario / setting</label>
          <input
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="e.g. aboard a starship drifting past a dying sun"
          />
        </div>

        <div>
          <label>Example dialogue (teaches their voice)</label>
          <textarea
            value={example}
            onChange={(e) => setExample(e.target.value)}
            placeholder={
              'Sample lines in their voice, e.g.\nYou: How are you today?\nThem: *she smiles softly* "Better, now that you are here."'
            }
            style={{ minHeight: 90 }}
          />
        </div>

        <div>
          <label>Genre</label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-accent" type="submit" disabled={loading}>
          {loading
            ? 'Saving…'
            : editing
            ? 'Save Changes'
            : 'Generate Portrait & Create'}
        </button>

        {error && <div className="error-text">{error}</div>}
      </form>
    </div>
  );
}

// ---------- Chat screen ----------
function Chat({ api, character, portrait, persona, onBack, onAuthError, onBalance }) {
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef(null);
  const taRef = useRef(null);

  const OPENING_PROMPT = 'Begin our story. Set the scene and greet me in character.';

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    });
  };

  // Send a turn to Claude. `history` is the messages array to send.
  const sendToClaude = useCallback(
    async (history) => {
      setTyping(true);
      setError('');
      try {
        const personaClause =
          persona && persona.name
            ? ` You are speaking with ${persona.name}.${
                persona.about ? ' A little about them: ' + persona.about + '.' : ''
              } Treat ${persona.name} as the other person in this story, and address them by name naturally now and then.`
            : '';
        const data = await api('/chat', {
          method: 'POST',
          body: JSON.stringify({
            systemPrompt: character.systemPrompt + personaClause,
            messages: history,
            characterId: character.id,
          }),
        });
        setMessages([...history, { role: 'assistant', content: data.reply }]);
        if (typeof data.balance === 'number') onBalance(data.balance);
      } catch (err) {
        if (String(err.message).toLowerCase().includes('token')) {
          onAuthError();
          return;
        }
        setError('Something interrupted the story. Please try again.');
      } finally {
        setTyping(false);
      }
    },
    [api, character, persona, onAuthError, onBalance]
  );

  // Seed a brand-new story: use the custom greeting if provided, else ask Claude
  const startFresh = useCallback(() => {
    if (character.greeting) {
      // Display the greeting immediately; persists once the user replies
      setMessages([
        { role: 'user', content: OPENING_PROMPT },
        { role: 'assistant', content: character.greeting },
      ]);
    } else {
      sendToClaude([{ role: 'user', content: OPENING_PROMPT }]);
    }
  }, [character, sendToClaude]);

  // On load: fetch history; if none, seed a fresh story
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/history/${character.id}`);
        if (cancelled) return;
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        } else {
          startFresh();
        }
      } catch (err) {
        if (!cancelled) setError('Could not load your story.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  useEffect(scrollToBottom, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text || typing) return;
    const history = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    sendToClaude(history);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const autoGrow = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const newStory = async () => {
    try {
      await api(`/history/${character.id}`, { method: 'DELETE' });
    } catch (err) {
      // ignore
    }
    setMessages([]);
    startFresh();
  };

  // Re-roll the most recent character reply
  const regenerate = () => {
    if (typing || messages.length === 0) return;
    if (messages[messages.length - 1].role !== 'assistant') return;
    const history = messages.slice(0, -1);
    setMessages(history);
    sendToClaude(history);
  };

  const canRegenerate =
    !typing &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant';

  // Hide the synthetic opening "user" prompt from the transcript
  const visibleMessages = messages.filter(
    (m, i) => !(i === 0 && m.role === 'user' && m.content === OPENING_PROMPT)
  );

  return (
    <div className="chat-screen fade-in">
      {portrait && (
        <div className="chat-bg" style={{ backgroundImage: `url(${portrait})` }} />
      )}
      <div className="chat-bg-overlay" />

      <div className="chat-header">
        <button className="icon-btn" onClick={onBack}>
          ←
        </button>
        <div className="title">
          <div className="name">{character.name}</div>
          <div className="genre">{character.genre}</div>
        </div>
        <button className="icon-btn" onClick={newStory} title="New Story">
          ↻
        </button>
      </div>

      <div className="messages" ref={messagesRef}>
        {visibleMessages.map((m, i) => {
          const isUser = m.role === 'user';
          const { text, scene } = isUser
            ? { text: m.content, scene: '' }
            : parseScene(m.content);
          return (
            <div className={`msg-row ${isUser ? 'user' : 'char'}`} key={i}>
              {!isUser &&
                (portrait ? (
                  <img className="avatar" src={portrait} alt={character.name} />
                ) : (
                  <div className="avatar" />
                ))}
              <div className={`bubble ${isUser ? 'user' : 'char'}`}>
                {renderRich(text)}
                {scene && <SceneImage api={api} prompt={scene} />}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="msg-row char">
            {portrait ? (
              <img className="avatar" src={portrait} alt={character.name} />
            ) : (
              <div className="avatar" />
            )}
            <div className="bubble char">
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-bar">{error}</div>}

      {canRegenerate && (
        <div className="regen-row">
          <button className="regen-btn" onClick={regenerate}>
            ↻ Regenerate reply
          </button>
        </div>
      )}

      <div className="composer">
        <textarea
          ref={taRef}
          value={input}
          onChange={autoGrow}
          onKeyDown={onKeyDown}
          placeholder={`Message ${character.name}…`}
          rows={1}
        />
        <button className="send-btn" onClick={send} disabled={typing || !input.trim()}>
          ↑
        </button>
      </div>
    </div>
  );
}
