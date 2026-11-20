import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import type { Database } from '@sportify/database';
import { performance } from 'node:perf_hooks';

@Injectable()
export class ReadinessService implements OnApplicationBootstrap, OnModuleDestroy {
  private initialized = false;
  private inFlight: Promise<boolean> | undefined;
  private checkedAt = -Infinity;
  private lastResult = false;
  constructor(
    private readonly database: Pick<Database, 'check' | 'stopAccepting'>,
    private readonly now: () => number = () => performance.now(),
  ) {}
  async isReady(): Promise<boolean> {
    if (!this.initialized) return false;
    if (this.inFlight) return this.inFlight;
    if (this.now() - this.checkedAt < 1000) return this.lastResult;
    this.inFlight = this.database
      .check()
      .catch(() => false)
      .then((result) => {
        this.lastResult = this.initialized && result;
        this.checkedAt = this.now();
        return this.lastResult;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }
  onApplicationBootstrap(): void {
    this.initialized = true;
  }
  onModuleDestroy(): void {
    this.initialized = false;
    this.lastResult = false;
    this.database.stopAccepting();
  }
}
