/** Minimal typings for dompurify 2.x (the package ships none; used by src/components/faqs/FaqHtml.tsx). */
declare module 'dompurify' {
  type HookData = { tagName: string; allowedTags: Record<string, boolean> };
  interface DOMPurifyConfig {
    ADD_TAGS?: string[];
    ADD_ATTR?: string[];
    FORBID_TAGS?: string[];
    FORBID_ATTR?: string[];
    ALLOWED_TAGS?: string[];
    ALLOWED_ATTR?: string[];
  }
  interface DOMPurifyI {
    sanitize(dirty: string, config?: DOMPurifyConfig): string;
    addHook(entryPoint: 'uponSanitizeElement', hook: (node: Node, data: HookData) => void): void;
    addHook(entryPoint: 'afterSanitizeAttributes', hook: (node: Node) => void): void;
  }
  const DOMPurify: DOMPurifyI;
  export default DOMPurify;
}
