// src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { setupRoutes } from './routes';
// import { setupErrorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import rateLimit from 'express-rate-limit';

// Validate environment variables
const validateEnv = () => {
  const required = [
    'BOTPRESS_API_TOKEN',
    'BOTPRESS_BOT_ID',
    'BOTPRESS_WORKSPACE_ID'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  logger.info('Environment validated:', {
    botId: process.env.BOTPRESS_BOT_ID,
    workspaceId: process.env.BOTPRESS_WORKSPACE_ID,
    hasApiToken: !!process.env.BOTPRESS_API_TOKEN,
    nodeEnv: process.env.NODE_ENV
  });
};

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-key', 'Authorization'],
  credentials: true
}));

// Middleware
app.use(express.json());
app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body,
    query: req.query
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV,
      botId: process.env.BOTPRESS_BOT_ID ? 'set' : 'not set',
      workspaceId: process.env.BOTPRESS_WORKSPACE_ID ? 'set' : 'not set',
      apiToken: process.env.BOTPRESS_API_TOKEN ? 'set' : 'not set'
    }
  });
});

// Setup routes
setupRoutes(app);

// Error handler - should be last
// setupErrorHandler(app);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Performing graceful shutdown...');
  // Close server and other connections
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Validate environment before starting
    validateEnv();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info('Environment:', {
        nodeEnv: process.env.NODE_ENV,
        frontendUrl: process.env.FRONTEND_URL,
        botId: process.env.BOTPRESS_BOT_ID ? 'set' : 'not set',
        workspaceId: process.env.BOTPRESS_WORKSPACE_ID ? 'set' : 'not set',
        apiToken: process.env.BOTPRESS_API_TOKEN ? 'set' : 'not set'
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  logger.error('Server startup error:', error);
  process.exit(1);
});

export default app;