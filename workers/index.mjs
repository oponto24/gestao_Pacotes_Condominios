/**
 * Worker — placeholder funcional (story 1.2).
 *
 * Sobe um processo Node mantendo-se vivo, com heartbeat a cada 30s.
 * Será substituído pela infra real de BullMQ na story 1.8 e ganhará
 * jobs reais a partir da story 3.5 (extractLabel) e 4.3 (sendWhatsApp).
 */

const HEARTBEAT_INTERVAL_MS = 30_000;

console.log('[worker] iniciado em modo dev. Aguardando jobs...');
console.log(`[worker] node ${process.version} · pid ${process.pid}`);

setInterval(() => {
  const uptimeSec = Math.floor(process.uptime());
  console.log(`[worker] heartbeat · uptime ${uptimeSec}s`);
}, HEARTBEAT_INTERVAL_MS);

// Graceful shutdown — Docker envia SIGTERM no `docker compose down`
const shutdown = (signal) => {
  console.log(`[worker] recebido ${signal}, encerrando.`);
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
