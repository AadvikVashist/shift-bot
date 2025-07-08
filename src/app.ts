import express from 'express';
import cors from 'cors';
import http from 'http';
import { Logger } from './helpers/logger';
import { startTelegramIngestor } from './ingestors/telegram';
import { startSlackIngestor } from './ingestors/slack';
import { env } from './helpers/config/env';
import engineersRouter from './routes/engineers';


const logger = Logger.create('App');
const port = env.port;

const main = async () => {
  logger.info(`Starting shift-bot on port ${port}...`);

  const app = express();

  app.set('trust proxy', true);

  // Middlewares
  app.use(cors());
  app.use(express.json());

  // Basic health check route
  app.get('/health', (_, res) => res.send('OK'));

  // Engineers management API
  app.use('/engineers', engineersRouter);


  // Initialize HTTP server
  const httpServer = http.createServer(app);

  // Start Telegram ticket ingestor
  void startTelegramIngestor();
  // Start Slack ticket ingestor
  void startSlackIngestor();

  // Graceful shutdown handling
  const shutdown = async () => {
    logger.info('Received shutdown signal, closing resources...');
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

// Global error handlers
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection', {
    error: reason,
    stack: reason?.stack,
    code: reason?.code,
    message: reason?.message,
  });
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error,
    stack: error.stack,
    name: error.name,
    message: error.message,
  });
  process.exit(1);
});

main();
