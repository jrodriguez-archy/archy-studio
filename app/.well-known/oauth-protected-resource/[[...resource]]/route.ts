import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';

// RFC 9728: tells MCP clients (Claude) which authorization server issues tokens for /mcp.
// Served at /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/mcp.
const metadata = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
});
const cors = metadataCorsOptionsRequestHandler();

export function GET(req: Request) {
  return metadata(req);
}

export function OPTIONS() {
  return cors();
}
