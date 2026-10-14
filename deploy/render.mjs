import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';

function required(key) {
  const value = process.env[key]?.trim();
  if (!value || /CHANGE_ME/i.test(value)) throw new Error(`${key} doit être renseigné.`);
  return value;
}
function domain(key) {
  const value = required(key).toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value) || value.endsWith('.example.com')) {
    throw new Error(`${key} doit être un domaine public réel, sans protocole ni chemin.`);
  }
  return value;
}

/** Pure configuration builder, also usable by deployment preflight tests. */
export function configuration() {
  const appDomain = domain('RENE_DOMAIN');
  const voiceDomain = domain('VOICE_DOMAIN');
  const turnDomain = domain('TURN_DOMAIN');
  if (new Set([appDomain, voiceDomain, turnDomain]).size !== 3) throw new Error('Les trois domaines doivent être distincts.');
  const publicIp = required('PUBLIC_IPV4');
  if (isIP(publicIp) !== 4 || /^(127\.|10\.|192\.168\.|0\.|169\.254\.|203\.0\.113\.|198\.51\.100\.|192\.0\.2\.)/.test(publicIp) || /^172\.(1[6-9]|2\d|3[01])\./.test(publicIp)) {
    throw new Error('PUBLIC_IPV4 doit être l’adresse IPv4 publique du serveur.');
  }
  const email = required('ACME_EMAIL');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('@example.com')) throw new Error('ACME_EMAIL invalide.');
  const apiKey = required('LIVEKIT_API_KEY');
  const secret = required('LIVEKIT_API_SECRET');
  const password = required('POSTGRES_PASSWORD');
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(apiKey)) throw new Error('LIVEKIT_API_KEY doit contenir 6–80 lettres, chiffres, tirets ou underscores.');
  if (!/^[a-f0-9]{64,}$/i.test(secret) || !/^[a-f0-9]{64,}$/i.test(password)) {
    throw new Error('Utiliser openssl rand -hex 32 pour POSTGRES_PASSWORD et LIVEKIT_API_SECRET.');
  }
  const subnet = process.env.RENE_NETWORK_SUBNET || '172.30.92.0/24';
  if (!/^172\.(1[6-9]|2\d|3[01])\.(\d{1,3})\.0\/24$/.test(subnet) || Number(subnet.split('.')[2]) > 255) {
    throw new Error('RENE_NETWORK_SUBNET doit être un /24 privé, par exemple 172.30.92.0/24.');
  }
  const caddy = {
    admin: { disabled: true },
    logging: { logs: { default: { level: 'INFO' } } },
    apps: {
      tls: { certificates: { automate: [appDomain, voiceDomain, turnDomain] },
        automation: { policies: [{ issuers: [{ module: 'acme', email }] }] } },
      http: { servers: { web: {
        listen: [':443'], protocols: ['h1', 'h2'],
        listener_wrappers: [{ wrapper: 'layer4', routes: [{
          match: [{ tls: { sni: [turnDomain] } }],
          handle: [{ handler: 'tls' }, { handler: 'proxy', proxy_protocol: 'v2', upstreams: [{ dial: ['livekit:443'] }] }],
        }] }, { wrapper: 'tls' }],
        routes: [
          { match: [{ host: [appDomain] }], handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'app:8080' }] }], terminal: true },
          { match: [{ host: [voiceDomain] }], handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'livekit:7880' }] }], terminal: true },
        ],
      } } },
    },
  };
  const livekit = {
    port: 7880, bind_addresses: ['0.0.0.0'],
    rtc: { tcp_port: 7881, udp_port: 7882, use_external_ip: false, node_ip: publicIp },
    keys: { [apiKey]: secret },
    turn: { enabled: true, domain: turnDomain, tls_port: 443, udp_port: 3478,
      external_tls: true, proxy_protocol: true, proxy_protocol_trusted_cidrs: [subnet] },
    room: { max_participants: 12, empty_timeout: 60, departure_timeout: 10, enabled_codecs: [{ mime: 'audio/opus' }] },
    logging: { level: 'info', json: true },
  };
  return { caddy, livekit };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { caddy, livekit } = configuration();
    if (process.argv.includes('--check')) {
      console.log('Configuration de production valide. Aucun fichier écrit.');
    } else {
      const directory = new URL('./generated/', import.meta.url);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      // JSON is a YAML subset; serializing avoids injecting env values into config syntax.
      for (const [filename, config] of [['caddy.json', caddy], ['livekit.yaml', livekit]]) {
        const destination = new URL(filename, directory);
        await writeFile(destination, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
        await chmod(destination, 0o600);
      }
      console.log('Configurations écrites dans deploy/generated/. Ne pas les versionner.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Configuration invalide.');
    process.exitCode = 1;
  }
}
