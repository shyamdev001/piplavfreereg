import fs from 'fs';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import apiRouter from './routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { sanitizeInput } from './utils/sanitize';

export const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      directives: {
        // blob: lets the document uploader preview a photo before it is uploaded.
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
  }),
);

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Basic NoSQL-injection guard: strips any keys starting with '$' or containing '.'
// from user-controlled input objects before they reach Mongoose queries.
app.use((req, _res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
});

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// In production the API also serves the built frontend (client/dist), so the
// whole app deploys as one service on one origin and auth cookies just work.
// Registered before the rate limiter so page assets don't use up the API quota.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (env.isProduction && fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api(\/|$)|health$).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(generalLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
