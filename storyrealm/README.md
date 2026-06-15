# StoryRealm

A full-stack web app with React (Vite) frontend and Node.js + Express backend, powered by Claude AI.

## Setup

1. Copy `.env.example` to `.env` and add your Claude API key:
   ```
   CLAUDE_API_KEY=your_api_key_here
   ```

2. Install root dependencies:
   ```bash
   npm install
   ```

3. Install and build the client:
   ```bash
   npm run build
   ```

## Development

Start the backend server:
```bash
npm run dev
```

In a separate terminal, start the Vite dev server:
```bash
cd client && npm run dev
```

## Production

```bash
npm run build
npm start
```
