import { visit } from 'unist-util-visit';

/**
 * remark plugin: 将 ```mermaid 代码块转为 <pre class="mermaid"> 原始 HTML 节点。
 * 在 remark 阶段（Shiki 语法高亮之前）执行，避免 Shiki 误处理 mermaid 语法。
 * 客户端由 mermaid.js 渲染为 SVG。
 *
 * 用法: 在 astro.config.mjs 的 markdown.remarkPlugins 中添加此插件。
 */
export default function remarkMermaidPre() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'mermaid' && parent && typeof index === 'number') {
        // 转义 HTML 特殊字符（mermaid 语法含 > < 等）
        const escaped = String(node.value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        // 替换为 raw HTML 节点，Shiki 不会处理 html 类型节点
        parent.children[index] = {
          type: 'html',
          value: `<pre class="mermaid">${escaped}</pre>`,
        };
      }
    });
  };
}
