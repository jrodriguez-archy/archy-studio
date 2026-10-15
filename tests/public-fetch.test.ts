import { describe, expect, it } from 'vitest';
import { privateAddress, publicFetch } from '@/lib/public-fetch';

describe('public links only', () => {
  it('knows the private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) expect(privateAddress(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '104.18.0.1', '2606:4700::1111']) expect(privateAddress(ip), ip).toBe(false);
  });
  it('refuses the server\'s own network however it is written', async () => {
    for (const url of ['https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://[::1]/a.png', 'https://169.254.169.254/latest/meta-data', 'https://2130706433/a.png', 'https://0x7f000001/a.png', 'http://example.com/a.png']) {
      await expect(publicFetch(url), url).rejects.toThrow(/public address|Only https/);
    }
  });
});
