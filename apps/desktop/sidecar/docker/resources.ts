import type { ResourceLimits } from "./manager";

// Default per-server resource limits
const DEFAULT_MAX_CPUS = 4;
const DEFAULT_MAX_MEMORY_MB = 2048;
const DEFAULT_MAX_PLUGINS = 10;

interface ServerLimits {
  maxCpus: number;
  maxMemoryMb: number;
  maxPlugins: number;
}

interface ResourceUsage {
  cpus: number;
  memoryMb: number;
  pluginCount: number;
}

export class ResourceEnforcer {
  private serverLimits: ServerLimits;
  private currentUsage: ResourceUsage = { cpus: 0, memoryMb: 0, pluginCount: 0 };

  constructor(limits?: Partial<ServerLimits>) {
    this.serverLimits = {
      maxCpus: limits?.maxCpus ?? DEFAULT_MAX_CPUS,
      maxMemoryMb: limits?.maxMemoryMb ?? DEFAULT_MAX_MEMORY_MB,
      maxPlugins: limits?.maxPlugins ?? DEFAULT_MAX_PLUGINS,
    };
  }

  validateAndReserve(requested: ResourceLimits): { allowed: boolean; reason?: string } {
    const cpus = requested.cpus ?? 1;
    const memoryMb = requested.memoryMb ?? 512;

    if (this.currentUsage.pluginCount >= this.serverLimits.maxPlugins) {
      return { allowed: false, reason: `Maximum plugin count (${this.serverLimits.maxPlugins}) reached` };
    }

    if (this.currentUsage.cpus + cpus > this.serverLimits.maxCpus) {
      return {
        allowed: false,
        reason: `CPU limit exceeded: ${this.currentUsage.cpus + cpus} > ${this.serverLimits.maxCpus}`,
      };
    }

    if (this.currentUsage.memoryMb + memoryMb > this.serverLimits.maxMemoryMb) {
      return {
        allowed: false,
        reason: `Memory limit exceeded: ${this.currentUsage.memoryMb + memoryMb}MB > ${this.serverLimits.maxMemoryMb}MB`,
      };
    }

    // Reserve resources
    this.currentUsage.cpus += cpus;
    this.currentUsage.memoryMb += memoryMb;
    this.currentUsage.pluginCount++;

    return { allowed: true };
  }

  release(resources: ResourceLimits): void {
    this.currentUsage.cpus = Math.max(0, this.currentUsage.cpus - (resources.cpus ?? 1));
    this.currentUsage.memoryMb = Math.max(0, this.currentUsage.memoryMb - (resources.memoryMb ?? 512));
    this.currentUsage.pluginCount = Math.max(0, this.currentUsage.pluginCount - 1);
  }

  getUsage(): ResourceUsage {
    return { ...this.currentUsage };
  }

  getLimits(): ServerLimits {
    return { ...this.serverLimits };
  }
}
