declare module 'marked' {
  function marked(markdown: string): string;
  namespace marked {
    function setOptions(options: Record<string, any>): void;
    function parse(markdown: string): string;
  }
  export = marked;
}
