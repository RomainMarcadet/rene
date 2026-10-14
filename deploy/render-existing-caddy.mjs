import { realpathSync } from 'node:fs';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

function required(env, key) {
  const value = env[key]?.trim();
  if (!value || /CHANGE_ME/i.test(value)) throw new Error(`${key} doit être renseigné.`);
  if (value !== env[key]) throw new Error(`${key} ne doit pas contenir d’espaces autour de sa valeur.`);
  return value;
}

function domain(env, key) {
  const value = required(env, key);
  if (value !== value.toLowerCase() || value.length > 253
    || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)
    || /(?:^|\.)(?:example\.(?:com|net|org)|invalid)$/.test(value)) {
    throw new Error(`${key} doit être un domaine réel en minuscules, sans protocole, port ni chemin.`);
  }
  return value;
}

function port(env, key, fallback) {
  const value = env[key] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`${key} doit être un port entre 1 et 65535.`);
  }
  return Number(value);
}

/** Pure builder: validates the env shared with Compose without printing credentials. */
export function configuration(env = process.env) {
  const appDomain = domain(env, 'RENE_DOMAIN');
  const voiceDomain = domain(env, 'VOICE_DOMAIN');
  if (appDomain === voiceDomain) throw new Error('RENE_DOMAIN et VOICE_DOMAIN doivent être distincts.');
  const nodeIp = required(env, 'LIVEKIT_NODE_IP');
  const firstOctet = Number(nodeIp.split('.')[0]);
  if (isIP(nodeIp) !== 4 || firstOctet === 0 || firstOctet === 127 || firstOctet >= 224
    || /^(169\.254\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(nodeIp)) {
    throw new Error('LIVEKIT_NODE_IP doit être une IPv4 LAN ou publique joignable par les joueurs.');
  }
  const apiKey = required(env, 'LIVEKIT_API_KEY');
  const secret = required(env, 'LIVEKIT_API_SECRET');
  const password = required(env, 'POSTGRES_PASSWORD');
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(apiKey)) throw new Error('LIVEKIT_API_KEY doit contenir 6–80 lettres, chiffres, tirets ou underscores.');
  if (!/^[a-f0-9]{64,128}$/i.test(secret) || !/^[a-f0-9]{64,128}$/i.test(password)) {
    throw new Error('Utiliser openssl rand -hex 32 séparément pour POSTGRES_PASSWORD et LIVEKIT_API_SECRET.');
  }
  if (secret === password) throw new Error('Utiliser deux secrets distincts pour PostgreSQL et LiveKit.');

  const subnet = env.RENE_NETWORK_SUBNET || '172.30.93.0/24';
  const subnetIp = subnet.replace(/\/24$/, '');
  if (!subnet.endsWith('.0/24') || isIP(subnetIp) !== 4
    || !/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(subnetIp)) {
    throw new Error('RENE_NETWORK_SUBNET doit être un réseau privé IPv4 /24, par exemple 172.30.93.0/24.');
  }
  const proxy = required(env, 'RENE_TRUST_PROXY').split('/');
  if (proxy.length !== 2 || isIP(proxy[0]) !== 4 || !/^\d+$/.test(proxy[1])
    || Number(proxy[1]) < 16 || Number(proxy[1]) > 32 || proxy[0] === '0.0.0.0') {
    throw new Error('RENE_TRUST_PROXY doit désigner l’IPv4 du proxy (/32) ou son sous-réseau précis (/16 à /32).');
  }
  if (isIP(env.RENE_BIND_ADDRESS || '127.0.0.1') !== 4) throw new Error('RENE_BIND_ADDRESS doit être une IPv4 locale du serveur Docker.');
  const appPort = port(env, 'RENE_HTTP_PORT', 8080);
  const voicePort = port(env, 'LIVEKIT_HTTP_PORT', 7880);
  if (appPort === voicePort || [appPort, voicePort].some(value => [80, 443, 7881].includes(value))) {
    throw new Error('Choisir deux ports HTTP distincts, différents de 80, 443 et 7881 déjà réservés.');
  }
  if (env.CADDY_NETWORK && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(env.CADDY_NETWORK)) {
    throw new Error('CADDY_NETWORK doit être le nom du réseau Docker existant de Caddy.');
  }

  return {
    port: 7880,
    bind_addresses: ['0.0.0.0'],
    rtc: { tcp_port: 7881, udp_port: 7882, node_ip: nodeIp, use_external_ip: false },
    keys: { [apiKey]: secret },
    // HTTP reverse_proxy does not carry TURN/TLS. Never advertise a nonexistent relay.
    turn: { enabled: false },
    room: { max_participants: 12, empty_timeout: 60, departure_timeout: 10, enabled_codecs: [{ mime: 'audio/opus' }] },
    logging: { level: 'info', json: true },
  };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(argument => argument !== '--check')) throw new Error('Option inconnue. Utiliser --check pour valider sans écrire.');
    const livekit = configuration();
    if (process.argv.includes('--check')) {
      console.log('Configuration pour Caddy existant valide. Aucun fichier écrit.');
    } else {
      const directory = new URL('./generated/', import.meta.url);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      const destination = new URL('livekit.existing-caddy.yaml', directory);
      // JSON is a YAML subset; serialize values rather than interpolating YAML text.
      await writeFile(destination, `${JSON.stringify(livekit, null, 2)}\n`, { mode: 0o600 });
      await chmod(destination, 0o600);
      console.log('Configuration écrite dans deploy/generated/livekit.existing-caddy.yaml. Ne pas la versionner.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Configuration invalide.');
    process.exitCode = 1;
  }
}
