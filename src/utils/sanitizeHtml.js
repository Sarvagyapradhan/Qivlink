/**
 * Safe HTML Sanitizer for Markdown and Document Previews
 * Protects against Stored XSS, script injection, iframe phishing, and protocol smuggling.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
  'code', 'pre', 'blockquote', 'hr',
  'ul', 'ol', 'li', 'task-list-item',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img', 'span', 'div'
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'align'
]);

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * Strips dangerous HTML tags and inline event handlers from rendered markdown
 * @param {string} rawHtml 
 * @returns {string} Sanitized safe HTML
 */
export function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // 1. Remove dangerous script, iframe, object, embed, form tags and their contents
  let clean = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // 2. Parse into temporary DOM in browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(clean, 'text/html');

    function cleanNode(node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tagName = child.tagName.toLowerCase();
          
          if (!ALLOWED_TAGS.has(tagName)) {
            // Strip tag but keep its text content
            const textNode = document.createTextNode(child.textContent || '');
            node.replaceChild(textNode, child);
            continue;
          }

          // Strip disallowed attributes or attributes with javascript: or event handlers (on*)
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const attrName = attr.name.toLowerCase();
            const attrVal = attr.value.trim().toLowerCase();

            if (attrName.startsWith('on') || !ALLOWED_ATTRS.has(attrName)) {
              child.removeAttribute(attr.name);
              continue;
            }

            // Verify safe URLs for href and src
            if (attrName === 'href' || attrName === 'src') {
              if (attrVal.startsWith('javascript:') || attrVal.startsWith('data:') || attrVal.startsWith('vbscript:')) {
                child.removeAttribute(attr.name);
                continue;
              }
              try {
                if (attrVal.includes('://')) {
                  const parsed = new URL(attrVal);
                  if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
                    child.removeAttribute(attr.name);
                    continue;
                  }
                }
              } catch (e) {
                // If invalid URL, strip
                child.removeAttribute(attr.name);
                continue;
              }
            }
          }

          // External links safety
          if (tagName === 'a') {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          }

          // Recursively clean children
          cleanNode(child);
        }
      }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
  }

  // Fallback: Basic regex strip of on* attributes and javascript:
  return clean
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href="#"');
}
