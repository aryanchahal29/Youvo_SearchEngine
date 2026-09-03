import { SSRFProtection } from './ssrf-protection';

export class SafeCrawler {
  /**
   * Fetches the content of a URL safely.
   * Includes timeouts, size limits, and SSRF protection.
   */
  static async fetchContent(url: string, timeoutMs: number = 10000): Promise<string> {
    if (!SSRFProtection.isSafeUrl(url)) {
      throw new Error(`URL blocked by SSRF protection: ${url}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'YouVoBot/1.0 (+https://youvo.com)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        signal: controller.signal,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      // Read as text, but could restrict by size if we implemented stream reading
      // For now, Next.js / Cloudflare fetch will read full text.
      const text = await response.text();
      
      if (text.length > 5 * 1024 * 1024) {
        throw new Error('Content too large (exceeds 5MB)');
      }

      return this.sanitizeHtml(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  private static sanitizeHtml(html: string): string {
    // In a real Node/Browser environment, we'd use DOMPurify or cheerio.
    // For now, basic regex stripping of scripts and styles to save tokens
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    return clean;
  }
}
