import IORedis from 'ioredis';
import { env } from './env.ts';

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, 
});

export default connection;