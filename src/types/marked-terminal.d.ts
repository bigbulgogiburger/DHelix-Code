declare module "marked-terminal" {
  import { type MarkedExtension } from "marked";
  interface MarkedTerminalOptions {
    reflowText?: boolean;
    width?: number;
    showSectionPrefix?: boolean;
    tab?: number;
    emoji?: boolean;
  }
  function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;
  export default markedTerminal;
}
