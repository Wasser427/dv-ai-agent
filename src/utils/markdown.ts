import marked from 'marked';
import TerminalRenderer from 'marked-terminal';

const tableOptions = {
  chars: {
    'top': '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+',
    'bottom': '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+',
    'left': '|', 'left-mid': '+', 'mid': '-', 'mid-mid': '+',
    'right': '|', 'right-mid': '+', 'middle': '|'
  }
};

marked.setOptions({
  renderer: new TerminalRenderer({ tableOptions, unescape: true })
});

export function renderMarkdown(md: string): string {
  return '\n' + marked.parse(md).trimEnd() + '\n';
}

export function isMarkdown(text: string): boolean {
  const mdIndicators = [
    /^#{1,6}\s/m,
    /\*\*[^*]+\*\*/,
    /^[\-\*\+]\s/m,
    /^\d+\.\s/m,
    /^```/m,
    /^>\s/m,
    /\[.+?\]\(.+?\)/,
    /`[^`]+`/,
    /^(\*{3,}|-{3,}|_{3,})$/m,
    /\*[^*]+\*/,
    /\|.*\|/m,
  ];
  return mdIndicators.some(r => r.test(text));
}
