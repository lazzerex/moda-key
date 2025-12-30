import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD'),
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
  }

  onModuleDestroy() {
    this.disconnect();
  }

  /**
   * Get cached data with JSON parsing
   */
  async getCached<T>(key: string): Promise<T | null> {
    const data = await this.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Set cached data with JSON stringification
   */
  async setCached(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttlSeconds) {
      await this.setex(key, ttlSeconds, stringValue);
    } else {
      await this.set(key, stringValue);
    }
  }

  /**
   * Delete cached data by pattern
   */
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length > 0) {
      return await this.del(...keys);
    }
    return 0;
  }
}
