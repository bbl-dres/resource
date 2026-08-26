/* =============================================================================
   icons.js — Lucide icons, loaded from assets/icons at boot.

   No build step: the SVG files in assets/icons are the source of truth. They
   are fetched once (listed in assets/icons/icons.json), folded into a single
   in-document <symbol> sprite, and referenced from markup with <use>.

   To add an icon: drop the Lucide SVG into assets/icons and add its name to
   assets/icons/icons.json.
   ============================================================================= */

const ICON_DIR = 'assets/icons';
const symbols = new Map();

/** Pull the drawable children out of a Lucide SVG file. */
function innerMarkup(svgText) {
  const open = svgText.indexOf('>', svgText.indexOf('<svg'));
  const close = svgText.lastIndexOf('</svg>');
  if (open === -1 || close === -1) return '';
  return svgText.slice(open + 1, close).trim();
}

export async function loadIcons() {
  const manifest = await fetch(`${ICON_DIR}/icons.json`, { cache: 'no-cache' }).then(r => r.json());
  await Promise.all(manifest.icons.map(async name => {
    try {
      const text = await fetch(`${ICON_DIR}/${name}.svg`, { cache: 'no-cache' }).then(r => r.text());
      symbols.set(name, innerMarkup(text));
    } catch {
      /* A missing icon must never take the app down — icon() falls back below. */
    }
  }));

  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.setAttribute('class', 'icon-sprite');
  sprite.innerHTML = [...symbols].map(([name, body]) =>
    `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`
  ).join('');
  document.body.prepend(sprite);
  return symbols.size;
}

/**
 * Render an icon reference. The sprite already carries stroke-width 2, which is
 * right for every size the app uses (13–15px on Lucide's 24px grid); `stroke`
 * overrides it for a size far outside that range, where 2px would read heavy.
 */
export function icon(name, size = 16, { stroke, cls = '' } = {}) {
  if (!symbols.has(name)) return '';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" aria-hidden="true"
    ${stroke ? `style="stroke-width:${stroke}"` : ''}><use href="#i-${name}"></use></svg>`;
}
