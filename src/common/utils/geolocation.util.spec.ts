import { geolocateIp } from './geolocation.util';

describe('geolocateIp', () => {
  it('returns null for missing IPs', () => {
    expect(geolocateIp(null)).toBeNull();
    expect(geolocateIp(undefined)).toBeNull();
    expect(geolocateIp('')).toBeNull();
  });

  it('returns null for private/loopback IPs instead of guessing', () => {
    expect(geolocateIp('127.0.0.1')).toBeNull();
    expect(geolocateIp('::1')).toBeNull();
    expect(geolocateIp('10.0.0.5')).toBeNull();
  });

  it('resolves a public IP to an approximate location', () => {
    const location = geolocateIp('8.8.8.8');

    expect(location).not.toBeNull();
    expect(location?.country).toBe('US');
    expect(typeof location?.latitude).toBe('number');
    expect(typeof location?.longitude).toBe('number');
  });

  it('strips the IPv4-mapped IPv6 prefix (::ffff:) before looking up', () => {
    const direct = geolocateIp('8.8.8.8');
    const mapped = geolocateIp('::ffff:8.8.8.8');

    expect(mapped).toEqual(direct);
  });
});
