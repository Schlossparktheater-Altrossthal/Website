import { startRealtimeServer } from './createRealtimeServer.js';

const port = Number(process.env.PORT || 4001);

startRealtimeServer({ port }).catch((error) => {
  console.error('[Realtime] Failed to start server', error);
  process.exit(1);
});
