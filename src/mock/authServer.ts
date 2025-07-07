import express from 'express';
import { Logger } from '../helpers/logger';

const logger = Logger.create('MockAuth');
const app = express();
app.use(express.json());

// In-memory token → user_id mapping
type Mapping = Record<string, string>;
const map: Mapping = {};
let counter = 1;

function nextUuid(): string {
  // Deterministic but unique-ish UUID v4 substitute using counter & hash
  const hex = counter.toString(16).padStart(12, '0');
  counter += 1;
  // 00000000-0000-0000-0000-xxxxxxxxxxxx
  return `00000000-0000-0000-0000-${hex}`;
}

app.post('/introspect', (req, res) => {
  // New contract: token passed via custom header `x-auth-token`
  const token: string | undefined = req.header('x-auth-token');

  if (!token) {
    return res.status(400).json({ error: 'token_missing' });
  }

  // Return existing mapping or create new user id if unseen
  let userId = map[token];
  if (!userId) {
    userId = nextUuid();
    map[token] = userId;
    logger.info('Issued new mock user', { token, userId });
  }

  // Response expected by verifier: `{ userId }`
  res.json({ userId });
});

const PORT = 4000;
app.listen(PORT, () => logger.info(`Mock auth introspect server running on http://localhost:${PORT}`)); 