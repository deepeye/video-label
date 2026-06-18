import { useMemo } from 'react';
import { tokens } from '../../styles/tokens';

interface JsonPreviewProps {
  json: object;
  maxLines?: number;
}

const COLORS = {
  key: '#7C3AED',     // 紫
  string: '#059669',  // 绿
  number: '#2563EB',  // 蓝
  boolean: '#DC2626', // 红
  null: '#71717A',    // 灰
  punct: '#52525B',
  comment: '#A1A1AA',
};

/**
 * 极简 JSON 高亮 — 不引外部库 (避免增加包体积)。
 */
function highlightLine(line: string): string {
  let out = line.replace(/"([^"\\]|\\.)*"(\s*:)?/g, (m, _g, colon) => {
    if (colon) {
      const key = m.slice(0, -colon.length);
      return `<span style="color:${COLORS.key}">${key}</span><span style="color:${COLORS.punct}">${colon}</span>`;
    }
    return `<span style="color:${COLORS.string}">${m}</span>`;
  });
  out = out.replace(/(\b-?\d+\.?\d*\b)(?=[\s,\]}])/g, (m) => `<span style="color:${COLORS.number}">${m}</span>`);
  out = out.replace(/\b(true|false|null)\b/g, (m) => {
    const c = m === 'null' ? COLORS.null : COLORS.boolean;
    return `<span style="color:${c}">${m}</span>`;
  });
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function JsonPreview({ json, maxLines = 80 }: JsonPreviewProps) {
  const { html, hidden } = useMemo(() => {
    const text = JSON.stringify(json, null, 2);
    const lines = text.split('\n');
    const truncated = lines.length > maxLines;
    const shown = truncated ? lines.slice(0, maxLines) : lines;
    return {
      html: shown
        .map((line) => highlightLine(escapeHtml(line)))
        .join('\n'),
      hidden: truncated ? lines.length - maxLines : 0,
    };
  }, [json, maxLines]);

  return (
    <div
      data-testid="json-preview"
      style={{
        background: tokens.color.neutral[900],
        color: tokens.color.neutral[100],
        borderRadius: tokens.radius.md,
        padding: tokens.space[4],
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        lineHeight: 1.6,
        maxHeight: 320,
        overflow: 'auto',
        whiteSpace: 'pre',
      }}
    >
      <pre style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
      {hidden > 0 && (
        <div style={{ marginTop: tokens.space[3], color: COLORS.comment, fontStyle: 'italic' }}>
          // ... 还有 {hidden} 行 (导出 zip 含完整内容)
        </div>
      )}
    </div>
  );
}
