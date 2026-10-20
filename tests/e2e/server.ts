import { createApp } from '../../apps/server/src/app.js';
import { TEST_WORD_PAIRS } from '../wordFixtures.js';

// Test-only entry point. Production never selects a fixture via a request or env flag.
const { app, config } = await createApp({ wordPairs: TEST_WORD_PAIRS });
await app.listen({ host: config.HOST, port: config.PORT });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close().then(() => process.exit(0)); });
