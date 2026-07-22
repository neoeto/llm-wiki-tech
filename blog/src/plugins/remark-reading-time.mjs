import getReadingTime from 'reading-time';

export default function remarkReadingTime() {
  return function (tree, file) {
    const text = extractText(tree);
    file.data.astro.frontmatter.readingTime = getReadingTime(text).text;
  };
}

function extractText(node) {
  let text = '';
  if (node.type === 'text' || node.type === 'inlineCode') {
    text += node.value;
  }
  if (node.children) {
    for (const child of node.children) {
      text += extractText(child);
    }
  }
  return text;
}
