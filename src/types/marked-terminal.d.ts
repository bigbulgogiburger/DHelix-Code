declare module "marked-terminal" {
  interface MarkedTerminalOptions {
    reflowText?: boolean;
    width?: number;
    showSectionPrefix?: boolean;
    tab?: number;
    emoji?: boolean;
  }
  function markedTerminal(options?: MarkedTerminalOptions): unknown;
  export default markedTerminal;
}
