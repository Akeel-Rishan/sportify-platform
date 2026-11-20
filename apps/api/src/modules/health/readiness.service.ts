import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class ReadinessService implements OnApplicationBootstrap, OnModuleDestroy {
  private initialized = false;
  isReady(): boolean {
    return this.initialized;
  }
  onApplicationBootstrap(): void {
    this.initialized = true;
  }
  onModuleDestroy(): void {
    this.initialized = false;
  }
}
