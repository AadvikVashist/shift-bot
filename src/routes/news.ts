import { Router } from 'express';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import supabaseService from '../helpers/supabase/client';

const router = Router();

// Attach auth middleware to all routes below
router.use(authMiddleware);

// GET /news/sources - list system sources grouped by platform
router.get('/sources', async (_req, res) => {
  const { data, error } = await supabaseService
    .from('news_sources')
    .select('*')
    .eq('visibility', 'system')
    .eq('is_active', true);

  if (error) return res.status(500).json({ error: error.message });

  // Group by platform for convenience
  const grouped: Record<string, any[]> = {};
  for (const row of data ?? []) {
    grouped[row.platform] = grouped[row.platform] || [];
    grouped[row.platform].push(row);
  }
  return res.json(grouped);
});

// GET /news/sources/search?q=&includeSubscribed=0|1
// Defaults to exclude already-subscribed sources (includeSubscribed=0)
router.get('/sources/search', async (req: AuthedRequest, res) => {
  const q = (req.query.q as string | undefined)?.trim() ?? '';
  const includeSubscribed = (req.query.includeSubscribed as string | undefined) === '1';
  const { userId } = req;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });

  let query = supabaseService
    .from('news_sources')
    .select('*')
    .in('visibility', ['system', 'public'])
    .eq('is_active', true);

  if (!includeSubscribed) {
    query = query.not('id', 'in', `("select source_id from news_source_subscriptions where user_id='${userId}'")`);
  }

  if (q) {
    query = query.or(
      `handle.ilike.%${q}%,title.ilike.%${q}%,source_name.ilike.%${q}%`,
    );
  }

  const { data, error } = await query.limit(25);
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// POST /news/subscriptions { source_id, action }
router.post('/subscriptions', async (req: AuthedRequest, res) => {
  const { source_id, action } = req.body as { source_id: string; action: 'subscribe' | 'unsubscribe' };
  const { userId } = req;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
  if (!source_id || !action) return res.status(400).json({ error: 'Missing parameters' });

  if (action === 'subscribe') {
    const { error } = await supabaseService
      .from('news_source_subscriptions')
      .insert({ user_id: userId, source_id })
      .single();
    if (error && error.code !== '23505') {
      // ignore duplicate key
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true });
  }

  if (action === 'unsubscribe') {
    const { error } = await supabaseService
      .from('news_source_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('source_id', source_id);
    if (error) return res.status(500).json({ error: error.message });

    // Check if source has any remaining subscribers; if none mark inactive (except system sources)
    const { data: subsLeft, error: countErr } = await supabaseService
      .from('news_source_subscriptions')
      .select('user_id', { head: true, count: 'exact' })
      .eq('source_id', source_id);

    if (!countErr && (subsLeft?.length ?? 0) === 0) {
      // Fetch source visibility to decide whether to deactivate
      const { data: srcRow } = await supabaseService
        .from('news_sources')
        .select('visibility')
        .eq('id', source_id)
        .maybeSingle();
      if (srcRow && srcRow.visibility !== 'system') {
        await supabaseService
          .from('news_sources')
          .update({ is_active: false })
          .eq('id', source_id);
      }
    }

    return res.json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
});

// Helper to upsert channel rows
async function registerChannel(params: {
  visibility: 'public' | 'private';
  platform: string;
  source_uid: string;
  handle?: string | null;
  title?: string | null;
  userId: string;
}) {
  const { visibility, platform, source_uid, handle, title, userId } = params;
  return supabaseService.from('news_sources').upsert(
    {
      platform,
      source_uid,
      handle: handle ?? null,
      title: title ?? handle ?? source_uid,
      source_name: handle ? `@${handle}` : title ?? source_uid,
      visibility,
      creator_id: userId,
    },
    { onConflict: 'platform,source_uid' },
  );
}

// POST /news/private-channel
router.post('/private-channel', async (req: AuthedRequest, res) => {
  const { platform, source_uid, handle, title } = req.body as any;
  const { userId } = req;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
  if (!platform || !source_uid) return res.status(400).json({ error: 'Missing parameters' });

  const { data, error } = await registerChannel({
    visibility: 'private',
    platform,
    source_uid,
    handle,
    title,
    userId,
  });
  if (error) return res.status(500).json({ error: error.message });

  // Auto-subscribe creator
  await supabaseService.from('news_source_subscriptions').insert({ user_id: userId, source_id: data![0].id });

  return res.json(data![0]);
});

// POST /news/public-channel
router.post('/public-channel', async (req: AuthedRequest, res) => {
  const { platform, source_uid, handle, title } = req.body as any;
  const { userId } = req;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
  if (!platform || !source_uid) return res.status(400).json({ error: 'Missing parameters' });

  const { data, error } = await registerChannel({
    visibility: 'public',
    platform,
    source_uid,
    handle,
    title,
    userId,
  });
  if (error) return res.status(500).json({ error: error.message });

  // Auto-subscribe creator
  await supabaseService.from('news_source_subscriptions').insert({ user_id: userId, source_id: data![0].id }).onConflict();

  return res.json(data![0]);
});

export default router; 