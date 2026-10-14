import { createApp } from './app.js';

const { app, config } = await createApp();
try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info({ webOrigin: config.WEB_ORIGIN, voiceEnabled: config.voiceEnabled }, 'Origine navigateur autorisée');
} catch (error) { app.log.error(error); process.exit(1); }
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close().then(() => process.exit(0)); });
}
