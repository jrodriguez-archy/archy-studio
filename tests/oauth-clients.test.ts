import { describe, expect, it } from 'vitest';
import { trustedRedirect } from '@/lib/oauth-clients';

describe('trustedRedirect', () => {
  it('lets Claude through', () => {
    for (const ok of ['claude://claude.ai/mcp-auth-callback/sdk', 'https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback', 'http://localhost:53122/callback', 'http://127.0.0.1:8080/callback']) expect(trustedRedirect(ok), ok).toBe(true);
  });
  it('stops everyone else', () => {
    for (const bad of ['https://evil.example/cb', 'https://claude.ai.evil.example/cb', 'https://evilclaude.ai/cb', 'http://claude.ai/cb', 'claude://evil.example/cb', 'javascript:alert(1)', 'not a url']) expect(trustedRedirect(bad), bad).toBe(false);
  });
});
