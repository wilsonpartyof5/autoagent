import { CONFIG } from '../config/env';

/**
 * Get the widget host URL from configuration
 * @deprecated Use CONFIG.widgetHost directly instead
 */
export function getWidgetHost(): string {
  return CONFIG.widgetHost;
}
