export function getWidgetHost(): string {
  const host = process.env.WIDGET_HOST;
  if (!host) {
    throw new Error('WIDGET_HOST environment variable is required (e.g., https://autoagentmcp-server-production.up.railway.app)');
  }
  return host.replace(/\/$/, '');
}
