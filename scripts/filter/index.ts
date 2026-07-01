/**
 * 过滤规则共享模块
 *
 * 使用方式:
 *   import { filterFriends, isJunkEntry, isSelfReference } from "./filter";
 *   import { JUNK_NAME_PATTERNS } from "./filter/names";
 *   import { NON_BLOG_DOMAINS } from "./filter/domains";
 */

export { JUNK_NAME_PATTERNS } from "./names";
export { JUNK_URL_PATTERNS } from "./urls";
export { NON_BLOG_DOMAINS as DOMAINS_HASHED } from "./domains";
export { SENSITIVE_DOMAINS } from "./sensitive";
export { SERVICE_SUBDOMAINS } from "./subdomains";
export { PLATFORM_HOSTS } from "./platforms";
export { WHITELIST_DOMAINS } from "./whitelist";
