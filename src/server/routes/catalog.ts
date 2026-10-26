import { Router } from 'express';
import { store } from '../store';

export const catalogRouter = Router();

// GET all catalog items: Tiers, Tracks, and Rounds
catalogRouter.get('/', (req, res) => {
  const tiers = Array.from(store.tiers.values()).sort((a, b) => a.order - b.order);
  const tracks = Array.from(store.companyTracks.values()).filter((t) => t.isActive);
  const rounds = Array.from(store.roundTemplates.values()).filter((r) => r.isActive);

  return res.json({
    tiers,
    tracks,
    rounds,
    platformNotice: store.settings.platformNotice,
  });
});
