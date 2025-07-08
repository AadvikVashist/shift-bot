import { Router } from 'express';
import { supabaseService } from '../helpers/supabase/client';
import { authMiddleware } from '../middleware/auth';
import { Logger } from '../helpers/logger';

const router = Router();
const logger = Logger.create('EngineersRouter');

// Attach auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /engineers
 * Returns list of engineers with selected fields.
 */
router.get('/', async (_req, res) => {
  const { data, error } = await (supabaseService as any)
    .from('engineers')
    .select('id,name,email,telegram_id,slack_id,phone_number,is_on_call,active');
  if (error) {
    logger.error('Failed to fetch engineers', error);
    return res.status(500).json({ error: 'Failed to fetch engineers' });
  }
  return res.json({ engineers: data });
});

/**
 * POST /engineers/:id/active
 * Body: { active: boolean }
 */
router.post('/:id/active', async (req, res) => {
  const { id } = req.params;
  const { active } = req.body as { active: boolean };
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active boolean required' });
  }

  const { error } = await (supabaseService as any)
    .from('engineers')
    .update({ active })
    .eq('id', id);
  if (error) {
    logger.error('Failed to toggle active', error);
    return res.status(500).json({ error: 'DB update failed' });
  }
  return res.json({ success: true });
});

/**
 * POST /engineers/:id/on_call
 * Body: { is_on_call: boolean }
 * Ensures at least one engineer remains on-call.
 */
router.post('/:id/on_call', async (req, res) => {
  const { id } = req.params;
  const { is_on_call } = req.body as { is_on_call: boolean };
  if (typeof is_on_call !== 'boolean') {
    return res.status(400).json({ error: 'is_on_call boolean required' });
  }

  if (!is_on_call) {
    // Check how many engineers currently on call (excluding this one)
    const { data: others, error: fetchErr } = await (supabaseService as any)
      .from('engineers')
      .select('id')
      .eq('is_on_call', true)
      .neq('id', id);
    if (fetchErr) {
      logger.error('Failed to count on-call engineers', fetchErr);
      return res.status(500).json({ error: 'DB error' });
    }
    if (!others || others.length === 0) {
      return res.status(400).json({ error: 'Must have at least one on-call engineer' });
    }
  }

  const { error } = await (supabaseService as any)
    .from('engineers')
    .update({ is_on_call })
    .eq('id', id);
  if (error) {
    logger.error('Failed to toggle on_call', error);
    return res.status(500).json({ error: 'DB update failed' });
  }
  return res.json({ success: true });
});

export default router; 