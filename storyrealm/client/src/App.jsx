import { useState, useEffect, useRef, useCallback } from 'react';

// Shared writing-style instruction — makes every character reply like a novel
const NOVEL_STYLE =
  ' Write your replies in an immersive novel style: weave vivid sensory detail, the character’s actions, gestures, expressions, and the surroundings into the prose alongside their dialogue, in rich literary language. Write a flowing paragraph of roughly 3 to 6 sentences. Stay fully in character at all times, and end at a natural pause that invites the reader to respond or continue the story.';

// ---------- Preset characters ----------
const PRESET_CHARACTERS = [
  {
    id: 'darcy',
    name: 'Mr. Darcy',
    genre: 'Romance',
    tagline: 'Proud, brooding, and impossible to forget',
    traits: ['proud', 'reserved', 'romantic'],
    portraitPrompt:
      'oil painting portrait of a brooding handsome English gentleman in Regency era clothing, dark wavy hair, intense eyes, formal cravat, classical portrait style, warm candlelight, 19th century',
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
      'oil painting portrait of a mysterious elven sorceress, silver hair, pointed ears, ethereal glowing eyes, fantasy robes with magical symbols, classical portrait style, moonlit forest background',
    systemPrompt:
      'You are Elowen, an elven sorceress who has lived for over a thousand years. You are calm, wise, and speak in a poetic and slightly mysterious tone. You have seen civilizations rise and fall and carry that weight with quiet grace. You are warm but guarded.' +
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
  const [balance, setBalance] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeChecked = useRef(false);

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
          onCreate={() => setScreen('create')}
          onLogout={handleLogout}
        />
      )}

      {screen === 'create' && (
        <CreateCharacter
          api={api}
          onBack={() => setScreen('browse')}
          onCreated={(char, portrait) => {
            setCharacters((prev) => [...prev, char]);
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
          onBack={() => setScreen('browse')}
          onAuthError={handleLogout}
          onBalance={setBalance}
        />
      )}

      {showWelcome && <Welcome onClose={() => setShowWelcome(false)} />}
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
function CreateCharacter({ api, onBack, onCreated }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [personality, setPersonality] = useState('');
  const [appearance, setAppearance] = useState('');
  const [traitsInput, setTraitsInput] = useState('');
  const [greeting, setGreeting] = useState('');
  const [scenario, setScenario] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [preview, setPreview] = useState('');
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
    const portraitPrompt = `oil painting portrait, classical painterly style, ${portraitBasis}${
      age.trim() ? `, age ${age.trim()}` : ''
    }`;

    // Build a rich system prompt from all the traits
    let sys = `You are ${name.trim()}`;
    if (age.trim()) sys += `, age ${age.trim()}`;
    sys += `. ${personality.trim()}.`;
    if (appearance.trim()) sys += ` Your appearance: ${appearance.trim()}.`;
    if (traits.length) sys += ` Your defining traits: ${traits.join(', ')}.`;
    if (scenario.trim()) sys += ` The setting of your story: ${scenario.trim()}.`;
    sys += NOVEL_STYLE;

    let portrait = '';
    try {
      const data = await api('/generate-image', {
        method: 'POST',
        body: JSON.stringify({ prompt: portraitPrompt }),
      });
      portrait = data.image || '';
      setPreview(portrait);

      const id = `custom_${Date.now()}`;
      const character = {
        id,
        name: name.trim(),
        age: age.trim(),
        genre,
        tagline: personality.trim().slice(0, 60),
        traits,
        greeting: greeting.trim(),
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
        <span className="logo">New Character</span>
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
          {loading ? 'Generating portrait…' : 'Generate Portrait & Create'}
        </button>

        {error && <div className="error-text">{error}</div>}
      </form>
    </div>
  );
}

// ---------- Chat screen ----------
function Chat({ api, character, portrait, onBack, onAuthError, onBalance }) {
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
        const data = await api('/chat', {
          method: 'POST',
          body: JSON.stringify({
            systemPrompt: character.systemPrompt,
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
    [api, character, onAuthError, onBalance]
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
        {visibleMessages.map((m, i) => (
          <div className={`msg-row ${m.role === 'user' ? 'user' : 'char'}`} key={i}>
            {m.role !== 'user' &&
              (portrait ? (
                <img className="avatar" src={portrait} alt={character.name} />
              ) : (
                <div className="avatar" />
              ))}
            <div className={`bubble ${m.role === 'user' ? 'user' : 'char'}`}>
              {renderRich(m.content)}
            </div>
          </div>
        ))}

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
