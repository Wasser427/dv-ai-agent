declare module 'marked-terminal' {
  interface TableChars {
    'top'?: string;
    'top-mid'?: string;
    'top-left'?: string;
    'top-right'?: string;
    'bottom'?: string;
    'bottom-mid'?: string;
    'bottom-left'?: string;
    'bottom-right'?: string;
    'left'?: string;
    'left-mid'?: string;
    'mid'?: string;
    'mid-mid'?: string;
    'right'?: string;
    'right-mid'?: string;
    'middle'?: string;
  }

  interface TerminalRendererOptions {
    tableOptions?: { chars?: TableChars };
    unescape?: boolean;
    showSectionPrefix?: boolean;
  }

  class TerminalRenderer {
    constructor(options?: TerminalRendererOptions);
  }

  export = TerminalRenderer;
}
