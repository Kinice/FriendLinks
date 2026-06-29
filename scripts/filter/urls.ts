/** URL 模式（明文存储） */
export const JUNK_URL_PATTERNS: RegExp[] = [
  /\/rss|\/feed|\/atom|rss\.xml|atom\.xml|\.xml$/i,
  /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp)(\?|$)/i,
  /^mailto:/i,
];
