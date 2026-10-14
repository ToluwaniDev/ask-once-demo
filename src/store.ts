import { randomUUID } from 'node:crypto';
import { ESCALATION_SECONDS, NEEDS, URGENT_NEEDS } from './config';
import type { BedSettings, CareRequest, Level, Need, RequestEvent } from './types';

export class StoreError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DEFAULT_BED: BedSettings = { fallsRisk: false, largeText: false, readAloud: false };
const BED_KEYS: (keyof BedSettings)[] = ['fallsRisk', 'largeText', 'readAloud'];

export function isActive(r: CareRequest): boolean {
  return r.status === 'open' || r.status === 'accepted' || r.status === 'arrived';
}

// In-memory store: perfect for a demo, resets when the server restarts.
export class Store {
  private requests = new Map<string, CareRequest>();
  private events: RequestEvent[] = [];
  private beds = new Map<string, BedSettings>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private onChange: (r: CareRequest) => void) {}

  list(opts: { bed?: string; active?: boolean } = {}): CareRequest[] {
    return [...this.requests.values()]
      .filter((r) => (!opts.bed || r.bed === opts.bed) && (!opts.active || isActive(r)))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  eventsFor(id: string): RequestEvent[] {
    this.get(id);
    return this.events.filter((e) => e.requestId === id);
  }

  getBed(bed: string): BedSettings {
    return { ...(this.beds.get(bed) ?? DEFAULT_BED) };
  }

  updateBed(bed: string, patch: Partial<Record<keyof BedSettings, unknown>>): BedSettings {
    const next = this.getBed(bed);
    for (const key of BED_KEYS) {
      const value = patch[key];
      if (typeof value === 'boolean') next[key] = value;
    }
    this.beds.set(bed, next);
    return next;
  }

  create(bed: string, need: Need): CareRequest {
    if (!/^[A-Za-z0-9-]{1,10}$/.test(bed)) throw new StoreError(400, 'Bed must be a short code, such as 12.');
    if (!(need in NEEDS)) throw new StoreError(400, 'That request type is not recognised.');
    const settings = this.getBed(bed);
    const urgent = settings.fallsRisk && URGENT_NEEDS.includes(need);
    const r: CareRequest = {
      id: randomUUID(),
      bed,
      need,
      role: NEEDS[need].role,
      status: 'open',
      level: urgent ? 2 : 1,
      fallsRisk: settings.fallsRisk,
      createdAt: Date.now(),
    };
    this.requests.set(r.id, r);
    this.log(r, 'created');
    this.scheduleEscalation(r);
    this.onChange(r);
    return r;
  }

  accept(id: string, name: string): CareRequest {
    const r = this.get(id);
    if (r.status !== 'open') {
      throw new StoreError(409, r.acceptedBy ? `${r.acceptedBy} has already taken this request.` : 'This request is no longer waiting.');
    }
    r.status = 'accepted';
    r.acceptedAt = Date.now();
    r.acceptedBy = name;
    return this.finishStep(r, 'accepted', name);
  }

  // "I'm here": works with or without an earlier accept (corridor-screen mode).
  arrive(id: string, name?: string): CareRequest {
    const r = this.get(id);
    if (r.status !== 'open' && r.status !== 'accepted') throw new StoreError(409, 'This request is not waiting for staff.');
    const now = Date.now();
    r.status = 'arrived';
    r.arrivedAt = now;
    r.acceptedAt ??= now;
    r.acceptedBy ??= name || 'A member of staff';
    return this.finishStep(r, 'arrived', name);
  }

  done(id: string, name?: string): CareRequest {
    const r = this.get(id);
    if (!isActive(r)) throw new StoreError(409, 'This request is already closed.');
    const now = Date.now();
    r.status = 'done';
    r.doneAt = now;
    r.acceptedAt ??= now;
    r.acceptedBy ??= name || 'A member of staff';
    return this.finishStep(r, 'done', name);
  }

  cancel(id: string): CareRequest {
    const r = this.get(id);
    if (!isActive(r)) throw new StoreError(409, 'This request is already closed.');
    r.status = 'cancelled';
    r.cancelledAt = Date.now();
    return this.finishStep(r, 'cancelled');
  }

  reset(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.requests.clear();
    this.events = [];
    this.beds.clear();
  }

  // Fills the dashboard with a plausible finished day of dummy requests.
  seed(): void {
    this.reset();
    const mix: [Need, number][] = [
      ['drink', 9], ['toilet', 8], ['comfort', 5], ['pain', 4],
      ['move', 3], ['jug', 3], ['talk', 2], ['spill', 2],
    ];
    const names = ['Amara', 'Sam', 'Priya', 'Tom', 'Grace', 'Joseph'];
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const now = Date.now();
    for (const [need, count] of mix) {
      for (let i = 0; i < count; i++) {
        const escalated = Math.random() < 0.1;
        const createdAt = now - rand(10 * 60_000, 8 * 3600_000);
        const acceptedAt = createdAt + (escalated ? rand(100, 200) : rand(20, 150)) * 1000;
        const arrivedAt = acceptedAt + rand(30, 120) * 1000;
        const r: CareRequest = {
          id: randomUUID(),
          bed: String(Math.ceil(rand(0.01, 16))),
          need,
          role: NEEDS[need].role,
          status: 'done',
          level: escalated ? 3 : 1,
          fallsRisk: Math.random() < 0.2,
          createdAt,
          acceptedAt,
          arrivedAt,
          doneAt: arrivedAt + rand(120, 600) * 1000,
          acceptedBy: names[Math.floor(Math.random() * names.length)],
        };
        this.requests.set(r.id, r);
      }
    }
  }

  private get(id: string): CareRequest {
    const r = this.requests.get(id);
    if (!r) throw new StoreError(404, 'Request not found. It may have been cleared by a demo reset.');
    return r;
  }

  private finishStep(r: CareRequest, type: RequestEvent['type'], by?: string): CareRequest {
    this.clearTimer(r.id);
    this.log(r, type, by);
    this.onChange(r);
    return r;
  }

  private scheduleEscalation(r: CareRequest): void {
    if (r.level >= 3) return;
    const seconds = ESCALATION_SECONDS[r.level - 1];
    const timer = setTimeout(() => {
      const current = this.requests.get(r.id);
      if (!current || current.status !== 'open') return;
      current.level = (current.level + 1) as Level;
      this.log(current, 'escalated', undefined, `level ${current.level}`);
      this.onChange(current);
      this.scheduleEscalation(current);
    }, seconds * 1000);
    this.timers.set(r.id, timer);
  }

  private clearTimer(id: string): void {
    const t = this.timers.get(id);
    if (t) clearTimeout(t);
    this.timers.delete(id);
  }

  private log(r: CareRequest, type: RequestEvent['type'], by?: string, detail?: string): void {
    this.events.push({ requestId: r.id, type, at: Date.now(), by, detail });
  }
}
