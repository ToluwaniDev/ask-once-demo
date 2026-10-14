import express, { NextFunction, Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { ESCALATION_SECONDS, NEEDS, ROLES } from './config';
import { Store, StoreError } from './store';
import type { Need } from './types';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Every change is broadcast; each screen filters what it needs.
const store = new Store((r) => io.emit('request:changed', r));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const nameFrom = (body: unknown): string | undefined => {
  const name = (body as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : undefined;
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.json({ needs: NEEDS, roles: ROLES, escalationSeconds: ESCALATION_SECONDS });
});

app.get('/api/requests', (req, res) => {
  const bed = typeof req.query.bed === 'string' ? req.query.bed : undefined;
  res.json(store.list({ bed, active: req.query.active === '1' }));
});

app.post('/api/requests', (req, res) => {
  const { bed, need } = (req.body ?? {}) as { bed?: unknown; need?: unknown };
  res.status(201).json(store.create(String(bed ?? ''), String(need ?? '') as Need));
});

app.get('/api/requests/:id/events', (req, res) => {
  res.json(store.eventsFor(req.params.id));
});

app.post('/api/requests/:id/accept', (req, res) => {
  res.json(store.accept(req.params.id, nameFrom(req.body) ?? 'A colleague'));
});

app.post('/api/requests/:id/arrive', (req, res) => {
  res.json(store.arrive(req.params.id, nameFrom(req.body)));
});

app.post('/api/requests/:id/done', (req, res) => {
  res.json(store.done(req.params.id, nameFrom(req.body)));
});

app.post('/api/requests/:id/cancel', (req, res) => {
  res.json(store.cancel(req.params.id));
});

app.get('/api/beds/:bed', (req, res) => {
  res.json(store.getBed(req.params.bed));
});

app.put('/api/beds/:bed', (req, res) => {
  res.json(store.updateBed(req.params.bed, req.body ?? {}));
});

app.post('/api/demo/reset', (_req, res) => {
  store.reset();
  io.emit('demo:reset');
  res.json({ ok: true });
});

app.post('/api/demo/seed', (_req, res) => {
  store.seed();
  io.emit('demo:reset');
  res.json({ ok: true });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof StoreError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'The server hit an unexpected problem. Try again.' });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Ask once demo running on http://localhost:${port}`);
});
