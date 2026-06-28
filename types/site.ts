export interface Site {
  name: string;
  description: string;
  url: string;
  favicon?: string;
  /** 友链页面路由，如 /links /link /friends /friend 等，不含末尾斜杠（必填） */
  links: string;
  friends: Array<{
    name: string;
    url: string;
    favicon?: string;
  }>;
}
