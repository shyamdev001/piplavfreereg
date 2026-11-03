import mongoose from 'mongoose';
import { env } from './env';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('error', (err) => {
    console.error('[mongodb] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[mongodb] disconnected');
  });

  await mongoose.connect(env.mongodbUri);
  console.log(`[mongodb] connected -> ${mongoose.connection.name}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
