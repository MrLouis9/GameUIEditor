import type { Document, NodeRole, SceneNode } from './types';
import { flattenNodes, getActivePage } from './tree';

/** Role → recommended componentKey prefix (P4). */
export const ROLE_KEY_PREFIX: Record<NodeRole, string> = {
  none: '',
  button: 'btn_',
  input: 'input_',
  toggle: 'tog_',
  list: 'list_',
  listItem: 'item_',
  scroll: 'scroll_',
  label: 'txt_',
  image: 'img_',
  panel: 'pnl_',
  icon: 'icon_',
  progress: 'bar_',
  tab: 'tab_',
  other: 'ui_',
};

export type NamingIssueSeverity = 'error' | 'warn';

export interface NamingIssue {
  severity: NamingIssueSeverity;
  nodeId: string;
  nodeName: string;
  code:
    | 'empty_name'
    | 'missing_key'
    | 'invalid_key'
    | 'duplicate_key'
    | 'prefix_mismatch'
    | 'cjk_key';
  message: string;
  suggestion?: string;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;

function slugFromName(name: string): string {
  const ascii = name
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  if (ascii) return ascii.slice(0, 32);

  // CJK / non-latin: stable short hash so 「生成」won't always be btn_unnamed
  const raw = name.trim() || 'node';
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `n${(h >>> 0).toString(36).slice(0, 6)}`;
}

/** Suggest componentKey from role + display name. */
export function suggestComponentKey(
  role: NodeRole,
  displayName: string,
  used?: Set<string>
): string {
  const prefix = ROLE_KEY_PREFIX[role] || 'ui_';
  let base = slugFromName(displayName);
  if (prefix && base.startsWith(prefix)) {
    base = base.slice(prefix.length) || 'unnamed';
  }
  let key = `${prefix}${base}`;
  if (!used) return key;
  if (!used.has(key)) return key;
  let i = 2;
  while (used.has(`${key}_${i}`)) i += 1;
  return `${key}_${i}`;
}

export function isValidComponentKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Lint naming / componentKey conventions across the active page (P4). */
export function lintNaming(doc: Document): NamingIssue[] {
  const page = getActivePage(doc);
  if (!page) return [];
  const nodes = flattenNodes(page.root);
  const issues: NamingIssue[] = [];
  const keyOwners = new Map<string, SceneNode>();

  for (const node of nodes) {
    if (!node.name.trim()) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        nodeName: node.name,
        code: 'empty_name',
        message: '显示名为空',
        suggestion: node.type,
      });
    }

    const key = node.componentKey?.trim();
    const interactive =
      node.role !== 'none' && node.role !== 'label' && node.role !== 'image';

    if (!key) {
      if (interactive || node.role === 'button' || node.role === 'input') {
        issues.push({
          severity: 'warn',
          nodeId: node.id,
          nodeName: node.name,
          code: 'missing_key',
          message: `角色 ${node.role} 建议填写 componentKey`,
          suggestion: suggestComponentKey(node.role, node.name || node.type),
        });
      }
      continue;
    }

    if (/[\u4e00-\u9fff]/.test(key)) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        nodeName: node.name,
        code: 'cjk_key',
        message: 'componentKey 不要使用中文',
        suggestion: suggestComponentKey(node.role, node.name || node.type),
      });
    } else if (!isValidComponentKey(key)) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        nodeName: node.name,
        code: 'invalid_key',
        message: 'componentKey 须为小写字母开头，仅含 a-z 0-9 _',
        suggestion: suggestComponentKey(node.role, node.name || key),
      });
    }

    const prev = keyOwners.get(key);
    if (prev) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        nodeName: node.name,
        code: 'duplicate_key',
        message: `componentKey 与「${prev.name}」重复：${key}`,
        suggestion: suggestComponentKey(
          node.role,
          node.name || node.type,
          new Set(keyOwners.keys())
        ),
      });
    } else {
      keyOwners.set(key, node);
    }

    const prefix = ROLE_KEY_PREFIX[node.role];
    if (prefix && node.role !== 'none' && !key.startsWith(prefix)) {
      issues.push({
        severity: 'warn',
        nodeId: node.id,
        nodeName: node.name,
        code: 'prefix_mismatch',
        message: `角色 ${node.role} 建议前缀 ${prefix}`,
        suggestion: suggestComponentKey(node.role, node.name || key),
      });
    }
  }

  return issues;
}

export function lintNodeIssues(doc: Document, nodeId: string): NamingIssue[] {
  return lintNaming(doc).filter((i) => i.nodeId === nodeId);
}

export function namingConventionMarkdown(): string {
  return `# 组件命名规范

| 角色 role | 前缀 | 示例 |
|-----------|------|------|
| button | btn_ | btn_login |
| input | input_ | input_username |
| toggle | tog_ | tog_sound |
| list | list_ | list_friends |
| listItem | item_ | item_friend |
| scroll | scroll_ | scroll_bag |
| label | txt_ | txt_title |
| image | img_ | img_avatar |
| panel | pnl_ | pnl_dialog |
| icon | icon_ | icon_gold |
| progress | bar_ | bar_hp |
| tab | tab_ | tab_shop |
| other | ui_ | ui_badge |

规则：
1. \`componentKey\` 用小写英文 + 下划线，不要中文
2. 业务逻辑绑定优先用 \`componentKey\`，显示名可本地化
3. 列表重复项用 \`listItem\`，不要为每个格子起完全不同的业务名
`;
}

export function namingIssuesMarkdown(issues: NamingIssue[]): string {
  if (!issues.length) {
    return '# 命名检查\n\n通过：未发现问题。\n';
  }
  const lines = issues.map(
    (i) =>
      `- **[${i.severity}]** \`${i.nodeName || i.nodeId}\` (${i.nodeId}): ${i.message}` +
      (i.suggestion ? ` → 建议 \`${i.suggestion}\`` : '')
  );
  return `# 命名检查\n\n发现 ${issues.length} 项：\n\n${lines.join('\n')}\n`;
}
