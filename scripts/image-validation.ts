/**
 * Image URL Validation - Filtre les images génériques, logos et placeholders
 *
 * Utilisé par curate.ts et synthesize.ts pour garantir que seules
 * des images éditoriales réelles sont associées aux stories.
 */

/**
 * Patterns dans les noms de fichier/chemin qui indiquent une image générique
 */
const GENERIC_FILENAME_PATTERNS = [
  /logo/i,
  /placeholder/i,
  /default[_-]?image/i,
  /default[_-]?thumb/i,
  /avatar/i,
  /no[_-]?image/i,
  /missing[_-]?image/i,
  /fallback/i,
  /blank/i,
  /spacer/i,
  /pixel\.(?:gif|png)/i,
  /logoarticle/i,
];

/**
 * Dimensions minimales détectables dans l'URL (certains CDN incluent les dimensions)
 * Les images < 200x200 sont probablement des icônes/logos
 */
const MIN_DIMENSION = 200;

/**
 * Extensions de fichier non-image qui passent parfois par les flux RSS
 */
const INVALID_EXTENSIONS = ['.svg', '.ico', '.gif'];

/**
 * Vérifie si une URL d'image est une vraie image éditoriale
 * (pas un logo, placeholder, ou image générique)
 *
 * @param url - URL de l'image à valider
 * @returns true si l'image semble être une vraie image éditoriale
 */
export function isValidEditorialImage(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const filename = pathname.split('/').pop() || '';

    // Rejeter les extensions non-image
    for (const ext of INVALID_EXTENSIONS) {
      if (filename.endsWith(ext)) {
        return false;
      }
    }

    // Rejeter les patterns de nom de fichier génériques
    for (const pattern of GENERIC_FILENAME_PATTERNS) {
      if (pattern.test(filename) || pattern.test(pathname)) {
        return false;
      }
    }

    // Détecter les images trop petites via les dimensions dans l'URL
    // Pattern courant dans les CDN: /WIDTHxHEIGHT/ ou /w:WIDTH/ ou /WIDTH/HEIGHT/
    const dimensionMatch = pathname.match(/\/(\d+)x(\d+)\//);
    if (dimensionMatch) {
      const width = parseInt(dimensionMatch[1], 10);
      const height = parseInt(dimensionMatch[2], 10);
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        return false;
      }
    }

    // Détecter les images trop anciennes dans les CDN qui incluent la date dans le chemin
    // Pattern: /YYYY/MM/DD/ dans le chemin
    const dateMatch = pathname.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch) {
      const imageYear = parseInt(dateMatch[1], 10);
      const currentYear = new Date().getFullYear();
      // Rejeter les images de plus de 3 ans (probablement des assets génériques recyclés)
      if (currentYear - imageYear > 3) {
        return false;
      }
    }

    return true;
  } catch {
    // URL malformée
    return false;
  }
}
