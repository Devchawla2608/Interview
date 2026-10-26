import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './src/server/routes/auth';
import { catalogRouter } from './src/server/routes/catalog';
import { bookingsRouter } from './src/server/routes/bookings';
import { queueRouter } from './src/server/routes/queue';
import { paymentsRouter } from './src/server/routes/payments';
import { interviewerRouter } from './src/server/routes/interviewer';
import { feedbackRouter } from './src/server/routes/feedback';
import { adminRouter } from './src/server/routes/admin';
import { notificationsRouter } from './src/server/routes/notifications';
import { authenticateToken } from './src/server/middleware/auth';
import { connectMongoDB, isMongoDBConnected } from './src/db/mongodb';
import { store } from './src/server/store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Initialize MongoDB connection (with automatic fallback to in-memory store)
  await connectMongoDB();
  // Sync existing database collections
  await store.syncFromMongoDB();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Attach user context to all requests if valid JWT is present
  app.use(authenticateToken);

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/interviewer', interviewerRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/notifications', notificationsRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: 'Interview Arena',
      database: isMongoDBConnected() ? 'MongoDB' : 'Transactional In-Memory Store (Dev Fallback)',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Interview Arena] Server running on http://0.0.0.0:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('[Interview Arena] Failed to start server:', err);
  process.exit(1);
});
