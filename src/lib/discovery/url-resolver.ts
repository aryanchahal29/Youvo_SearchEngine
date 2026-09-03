export class UrlResolver {
  private static PLATFORM_DOMAINS = [
    'zapier.com',
    'zite.com',
    'medium.com',
    'reddit.com',
    'youtube.com',
    'xda-developers.com',
    'figma.com',
    'producthunt.com',
    'github.com',
    'linkedin.com',
    'twitter.com',
    'facebook.com',
    'uxplanet.org'
  ];

  /**
   * Identifies the true official domain for a tool, bypassing affiliate links,
   * directory proxy URLs, or tracking links.
   */
  static resolveOfficialUrl(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Block content/platform domains from being treated as official tool URLs
      const isPlatform = this.PLATFORM_DOMAINS.some(domain => 
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
      
      if (isPlatform) {
        throw new Error(`Rejected platform domain: ${parsed.hostname}`);
      }
      
      // Strip common tracking parameters (utm_*)
      const cleanUrl = new URL(parsed.origin + parsed.pathname);
      parsed.searchParams.forEach((value, key) => {
        if (!key.startsWith('utm_') && key !== 'ref') {
          cleanUrl.searchParams.append(key, value);
        }
      });
      
      return cleanUrl.toString();
    } catch {
      return url;
    }
  }

  /**
   * Follows redirects to find the final official URL.
   */
  static async followRedirects(url: string, timeoutMs: number = 3000): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal
      });
      return this.resolveOfficialUrl(response.url);
    } catch {
      return this.resolveOfficialUrl(url);
    } finally {
      clearTimeout(timeout);
    }
  }
}
