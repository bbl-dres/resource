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
  /*
   * Icons must never take the app down — icon() falls back to nothing. That
   * was only true of a single icon: the manifest itself was fetched outside
   * any guard, so a missing icons.json failed the boot, and a 404 page was
   * read as an icon and registered as an empty symbol.
   */
  const text = async url => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url} — HTTP ${res.status}`);
    return res.text();
  };
  let names = [];
  try {
    names = JSON.parse(await text(`${ICON_DIR}/icons.json`)).icons ?? [];
  } catch (error) {
    console.warn('Icons not loaded:', error.message);
  }
  await Promise.all(names.map(async name => {
    try {
      symbols.set(name, innerMarkup(await text(`${ICON_DIR}/${name}.svg`)));
    } catch {
      /* One missing icon is one missing icon. */
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
 * Render an icon reference. The sprite carries stroke-width 2, which is right
 * for every size the app uses (13–15px on Lucide's 24px grid).
 */
export function icon(name, size = 16) {
  if (!symbols.has(name)) return '';
  return `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}
