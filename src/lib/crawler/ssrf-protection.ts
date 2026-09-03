import { URL } from 'url';

export class SSRFProtection {
  /**
   * Checks if a URL is safe to fetch. Blocks local networks, loopbacks, and cloud metadata.
   */
  static isSafeUrl(targetUrl: string): boolean {
    try {
      const parsedUrl = new URL(targetUrl);
      
      // Allow only http and https
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      const hostname = parsedUrl.hostname;

      // Basic regex for forbidden IPs (localhost, 10.x, 172.16-31.x, 192.168.x, 169.254.x)
      const forbiddenIPRegex = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})$/i;
      
      if (forbiddenIPRegex.test(hostname)) {
        return false;
      }

      // Check for IPv6 loopback and unspecified
      if (hostname === '[::1]' || hostname === '[::]') {
        return false;
      }

      // Also block common cloud metadata endpoints if they appear as domains
      if (hostname === 'metadata.google.internal' || hostname === '169.254.169.254') {
        return false;
      }

      return true;
    } catch {
      // Invalid URL
      return false;
    }
  }
}
