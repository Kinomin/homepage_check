/**
 * robots.txt の解釈（handoff.md 6章：robots.txt を必ず尊重する）。
 *
 * 拒否されている学校は走査せず、scans.status='blocked' / findings.level='unknown' とする。
 * ここで `none`（欠落）を返してはならない。取得できなかったことを
 * 「情報がない」と表示すると、誤った指摘に化ける（設計原則4）。
 */

export interface RobotsRule {
  type: 'allow' | 'disallow';
  path: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelaySeconds: number | null;
}

export interface RobotsTxt {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export function parseRobotsTxt(text: string): RobotsTxt {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  // 連続する User-agent 行はひとつのグループにまとめる
  let acceptingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    switch (field) {
      case 'user-agent': {
        if (!current || !acceptingAgents) {
          current = { agents: [], rules: [], crawlDelaySeconds: null };
          groups.push(current);
          acceptingAgents = true;
        }
        current.agents.push(value.toLowerCase());
        break;
      }
      case 'allow':
      case 'disallow': {
        if (!current) break;
        acceptingAgents = false;
        current.rules.push({ type: field, path: value });
        break;
      }
      case 'crawl-delay': {
        if (!current) break;
        acceptingAgents = false;
        const seconds = Number.parseFloat(value);
        if (Number.isFinite(seconds)) current.crawlDelaySeconds = seconds;
        break;
      }
      case 'sitemap': {
        if (value) sitemaps.push(value);
        break;
      }
      default:
        break;
    }
  }

  return { groups, sitemaps };
}

/** 自分の User-agent に最も一致するグループ。無ければ `*` のグループ。 */
export function groupForAgent(robots: RobotsTxt, userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase();
  let specific: RobotsGroup | null = null;
  let wildcard: RobotsGroup | null = null;

  for (const group of robots.groups) {
    for (const agent of group.agents) {
      if (agent === '*') {
        wildcard ??= group;
      } else if (ua.includes(agent)) {
        specific ??= group;
      }
    }
  }
  return specific ?? wildcard;
}

/** robots.txt のパスパターン（`*` と末尾 `$`）を照合する */
export function matchesPattern(pattern: string, path: string): boolean {
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp('^' + escaped + (anchored ? '$' : ''));
  return regex.test(path);
}

/**
 * 走査してよい URL か。
 * より長く一致したルールを優先し、同じ長さなら Allow を優先する（一般的な実装に合わせる）。
 */
export function isAllowed(robots: RobotsTxt, userAgent: string, pathname: string): boolean {
  const group = groupForAgent(robots, userAgent);
  if (!group) return true;

  let best: { rule: RobotsRule; length: number } | null = null;
  for (const rule of group.rules) {
    if (rule.type === 'disallow' && rule.path === '') continue; // Disallow: は全許可の意味
    if (!matchesPattern(rule.path, pathname)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.type === 'allow')) {
      best = { rule, length };
    }
  }
  if (!best) return true;
  return best.rule.type === 'allow';
}

/** サイト全体が拒否されているか（走査自体を行わず blocked とする判定） */
export function isSiteBlocked(robots: RobotsTxt, userAgent: string): boolean {
  return !isAllowed(robots, userAgent, '/');
}

export function crawlDelayFor(robots: RobotsTxt, userAgent: string): number | null {
  return groupForAgent(robots, userAgent)?.crawlDelaySeconds ?? null;
}
