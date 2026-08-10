import geoip from 'geoip-lite';

export interface GeoLocation {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Aproximado, no exacto — geolocalizar por IP ubica al proveedor de
 * internet/gateway, no al usuario (en datos móviles puede marcar la
 * ciudad donde el operador tiene su NAT, no la del teléfono). Para IPs
 * privadas/loopback (127.0.0.1, 10.x, 192.168.x, ::1 — el caso normal en
 * dev) no hay nada que geolocalizar, devuelve null a propósito en vez de
 * inventar un dato.
 */
export function geolocateIp(ip: string | null | undefined): GeoLocation | null {
  if (!ip) {
    return null;
  }

  // IPv4 mapeada en IPv6 (::ffff:1.2.3.4), común detrás de un proxy/nginx.
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  const result = geoip.lookup(normalized);
  if (!result) {
    return null;
  }

  return {
    country: result.country || null,
    region: result.region || null,
    city: result.city || null,
    latitude: result.ll?.[0] ?? null,
    longitude: result.ll?.[1] ?? null,
  };
}
