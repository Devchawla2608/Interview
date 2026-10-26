import { Router } from 'express';
import { store } from '../store';

export const notificationsRouter = Router();

notificationsRouter.get('/', (req: any, res) => {
  if (!req.user) {
    return res.json({ notifications: [] });
  }
  const userId = req.user.id;
  const list = store.notifications.filter((n) => n.userId === userId);
  return res.json({ notifications: list });
});

notificationsRouter.post('/:id/read', (req: any, res) => {
  const { id } = req.params;
  const notif = store.notifications.find((n) => n.id === id);
  if (notif) {
    notif.isRead = true;
  }
  return res.json({ success: true, notif });
});

notificationsRouter.post('/read-all', (req: any, res) => {
  if (!req.user) return res.json({ success: true });
  const userId = req.user.id;
  for (const n of store.notifications) {
    if (n.userId === userId) {
      n.isRead = true;
    }
  }
  return res.json({ success: true });
});
