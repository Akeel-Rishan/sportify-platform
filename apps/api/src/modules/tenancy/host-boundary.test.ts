import { describe, expect, it } from 'vitest';
import { classifyAuthority } from './host-boundary.js';

const production = { environment: 'production', port: 4000 } as const;
const test = {
  environment: 'test',
  port: 4000,
  localDashboard: new URL('http://127.0.0.1:4500'),
} as const;

describe('request authorities', () => {
  it.each([
    ['sportify.lk', { surface: 'platform' }],
    ['APP.SPORTIFY.LK:443', { surface: 'dashboard' }],
    ['admin.sportify.lk', { surface: 'admin' }],
    ['Venue-9.Sportify.Lk', { surface: 'tenant-website', slug: 'venue-9' }],
  ])('classifies %s', (authority, result) => {
    expect(classifyAuthority(['Host', authority], production)).toEqual(result);
  });

  it.each([
    '',
    'api.sportify.lk',
    'dashboard.sportify.lk',
    'www.sportify.lk',
    'app.sportify.lk.attacker.test',
    'different-sportify.lk',
    'a.b.sportify.lk',
    'app.sportify.lk.',
    'app.sportify.lk:444',
    'app.sportify.lk:0',
    'app.sportify.lk:0443',
    'app.sportify.lk:99999',
    'app.sportify.lk:443:443',
    'app.sportify.lk\n',
    'ap p.sportify.lk',
    ' app.sportify.lk',
    'app.sportify.lk,admin.sportify.lk',
    'name@app.sportify.lk',
    'app.sportify.lk/path',
    'app.sportify.lk?x',
    'app.sportify.lk#x',
    'ශ්‍රී.sportify.lk',
    'xn--venue.sportify.lk',
    '-venue.sportify.lk',
    'venue-.sportify.lk',
    'a'.repeat(64) + '.sportify.lk',
    '127.0.0.1',
    '[::1]',
    'localhost',
  ])('rejects an invalid or unapproved authority %j', (authority) => {
    expect(() => classifyAuthority(['Host', authority], production)).toThrow();
  });

  it('requires one wire Host and ignores replacement headers', () => {
    expect(() => classifyAuthority(['Forwarded', 'host=app.sportify.lk'], production)).toThrow();
    expect(() =>
      classifyAuthority(['Host', 'sportify.lk', 'hOsT', 'sportify.lk'], production),
    ).toThrow();
    expect(
      classifyAuthority(
        [
          'Host',
          'sportify.lk',
          'Forwarded',
          'host=app.sportify.lk',
          'X-Forwarded-Host',
          'admin.sportify.lk',
        ],
        production,
      ),
    ).toEqual({ surface: 'platform' });
  });

  it('limits local probes and explicit local dashboard aliases to loopback peers', () => {
    expect(classifyAuthority(['Host', '127.0.0.1:4500'], test, '::ffff:127.0.0.1')).toEqual({
      surface: 'dashboard',
    });
    expect(classifyAuthority(['Host', '[::1]:5555'], test, '::1')).toEqual({ surface: 'probe' });
    expect(() => classifyAuthority(['Host', '127.0.0.1:4500'], test, '192.0.2.5')).toThrow();
    expect(() =>
      classifyAuthority(
        ['Host', 'localhost:80'],
        { ...test, environment: 'development' },
        '127.0.0.1',
      ),
    ).toThrow();
  });
});
