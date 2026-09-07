/**
 * Normalizes bank transaction descriptions to clean merchant names
 * and suggests categories based on known merchants.
 */

interface NormalizationRule {
  patterns: RegExp[];
  normalizedName: string;
  suggestedCategory: string;
}

const normalizationRules: NormalizationRule[] = [
  // Streaming & Entertainment
  { patterns: [/netflix/i, /NETFLIX\.COM/i], normalizedName: 'Netflix', suggestedCategory: 'subscriptions' },
  { patterns: [/spotify/i, /SPOTIFY\s*\*/i], normalizedName: 'Spotify', suggestedCategory: 'subscriptions' },
  { patterns: [/disney\s*\+/i, /DISNEYPLUS/i, /disney\s*plus/i], normalizedName: 'Disney+', suggestedCategory: 'subscriptions' },
  { patterns: [/hbo\s*max/i, /HBO/i], normalizedName: 'HBO Max', suggestedCategory: 'subscriptions' },
  { patterns: [/amazon\s*prime/i, /AMZN\s*Prime/i, /PRIME\s*VIDEO/i], normalizedName: 'Amazon Prime', suggestedCategory: 'subscriptions' },
  { patterns: [/apple\s*tv/i, /APPLE\.COM\/BILL/i], normalizedName: 'Apple TV+', suggestedCategory: 'subscriptions' },
  { patterns: [/youtube\s*premium/i, /GOOGLE\s*\*YouTube/i], normalizedName: 'YouTube Premium', suggestedCategory: 'subscriptions' },
  { patterns: [/crunchyroll/i], normalizedName: 'Crunchyroll', suggestedCategory: 'subscriptions' },
  { patterns: [/paramount/i], normalizedName: 'Paramount+', suggestedCategory: 'subscriptions' },
  { patterns: [/star\s*\+/i, /starplus/i], normalizedName: 'Star+', suggestedCategory: 'subscriptions' },

  // Transport
  { patterns: [/uber(?!\s*eat)/i, /UBER\s*\*TRIP/i, /PYU\*?UBER/i], normalizedName: 'Uber', suggestedCategory: 'transport' },
  { patterns: [/DLC\*RIDES/i, /DLC\*UBER/i], normalizedName: 'Uber Rides', suggestedCategory: 'transport' },
  { patterns: [/E\s+S\s+EL\s+DERBY/i, /DERBY/i], normalizedName: 'Grifo El Derby', suggestedCategory: 'transport' },
  { patterns: [/uber\s*eat/i, /UBEREATS/i], normalizedName: 'Uber Eats', suggestedCategory: 'food' },
  { patterns: [/didi/i, /DIDI\s*\*/i], normalizedName: 'DiDi', suggestedCategory: 'transport' },
  { patterns: [/cabify/i], normalizedName: 'Cabify', suggestedCategory: 'transport' },
  { patterns: [/beat\s*app/i, /BEAT\s*\*/i], normalizedName: 'Beat', suggestedCategory: 'transport' },
  { patterns: [/indrive/i, /IN\s*DRIVE/i], normalizedName: 'inDrive', suggestedCategory: 'transport' },

  // Food & Delivery
  { patterns: [/rappi/i, /DLCRAPPI/i, /RAPPI\s*\*/i], normalizedName: 'Rappi', suggestedCategory: 'food' },
  { patterns: [/pedidos\s*ya/i, /PEDIDOSYA/i], normalizedName: 'PedidosYa', suggestedCategory: 'food' },
  { patterns: [/glovo/i], normalizedName: 'Glovo', suggestedCategory: 'food' },
  { patterns: [/ifood/i], normalizedName: 'iFood', suggestedCategory: 'food' },
  { patterns: [/mc\s*donald/i, /MCDONALDS/i, /MCD\s*\*/i], normalizedName: "McDonald's", suggestedCategory: 'food' },
  { patterns: [/starbucks/i, /SBUX/i], normalizedName: 'Starbucks', suggestedCategory: 'food' },
  { patterns: [/kfc/i], normalizedName: 'KFC', suggestedCategory: 'food' },
  { patterns: [/burger\s*king/i, /BK\s*\*/i], normalizedName: 'Burger King', suggestedCategory: 'food' },
  { patterns: [/dominos/i, /DOMINO/i], normalizedName: "Domino's", suggestedCategory: 'food' },
  { patterns: [/pizza\s*hut/i], normalizedName: 'Pizza Hut', suggestedCategory: 'food' },

  // Shopping
  { patterns: [/amazon/i, /AMZN/i, /AMZ\s*\*/i], normalizedName: 'Amazon', suggestedCategory: 'shopping' },
  { patterns: [/mercado\s*libre/i, /MELI\s*\*/i, /MERCADOLIBRE/i], normalizedName: 'Mercado Libre', suggestedCategory: 'shopping' },
  { patterns: [/falabella/i, /SAGA\s*FALABELLA/i], normalizedName: 'Falabella', suggestedCategory: 'shopping' },
  { patterns: [/ripley/i], normalizedName: 'Ripley', suggestedCategory: 'shopping' },
  { patterns: [/wong/i], normalizedName: 'Wong', suggestedCategory: 'food' },
  { patterns: [/metro\s*(supermercado|market)?/i], normalizedName: 'Metro', suggestedCategory: 'food' },
  { patterns: [/plaza\s*vea/i, /PLAZAVEA/i], normalizedName: 'Plaza Vea', suggestedCategory: 'food' },
  { patterns: [/tottus/i], normalizedName: 'Tottus', suggestedCategory: 'food' },
  { patterns: [/vivanda/i], normalizedName: 'Vivanda', suggestedCategory: 'food' },

  // Tech & Software
  { patterns: [/google\s*one/i, /GOOGLE\s*\*One/i], normalizedName: 'Google One', suggestedCategory: 'subscriptions' },
  { patterns: [/icloud/i, /APPLE\.COM/i], normalizedName: 'iCloud', suggestedCategory: 'subscriptions' },
  { patterns: [/microsoft\s*365/i, /MSFT\s*\*/i], normalizedName: 'Microsoft 365', suggestedCategory: 'subscriptions' },
  { patterns: [/chatgpt/i, /openai/i], normalizedName: 'ChatGPT Plus', suggestedCategory: 'subscriptions' },
  { patterns: [/canva/i], normalizedName: 'Canva', suggestedCategory: 'subscriptions' },
  { patterns: [/adobe/i], normalizedName: 'Adobe', suggestedCategory: 'subscriptions' },
  { patterns: [/dropbox/i], normalizedName: 'Dropbox', suggestedCategory: 'subscriptions' },
  { patterns: [/slack/i], normalizedName: 'Slack', suggestedCategory: 'subscriptions' },
  { patterns: [/zoom/i, /ZOOM\.US/i], normalizedName: 'Zoom', suggestedCategory: 'subscriptions' },

  // Telecom
  { patterns: [/movistar/i, /TELEFONICA/i], normalizedName: 'Movistar', suggestedCategory: 'bills' },
  { patterns: [/claro/i, /AMERICA\s*MOVIL/i], normalizedName: 'Claro', suggestedCategory: 'bills' },
  { patterns: [/entel/i], normalizedName: 'Entel', suggestedCategory: 'bills' },
  { patterns: [/bitel/i], normalizedName: 'Bitel', suggestedCategory: 'bills' },

  // Utilities
  { patterns: [/luz\s*del\s*sur/i, /ENEL/i], normalizedName: 'Luz del Sur', suggestedCategory: 'bills' },
  { patterns: [/sedapal/i], normalizedName: 'Sedapal', suggestedCategory: 'bills' },
  { patterns: [/calidda/i], normalizedName: 'Calidda', suggestedCategory: 'bills' },

  // Fitness & Health
  { patterns: [/gym/i, /bodytech/i, /smart\s*fit/i], normalizedName: 'Gimnasio', suggestedCategory: 'health' },
  { patterns: [/farmacia/i, /inkafarma/i, /mifarma/i, /botica/i], normalizedName: 'Farmacia', suggestedCategory: 'health' },

  // Education
  { patterns: [/coursera/i], normalizedName: 'Coursera', suggestedCategory: 'education' },
  { patterns: [/udemy/i], normalizedName: 'Udemy', suggestedCategory: 'education' },
  { patterns: [/platzi/i], normalizedName: 'Platzi', suggestedCategory: 'education' },
  { patterns: [/duolingo/i], normalizedName: 'Duolingo', suggestedCategory: 'education' },

  // Peru-specific merchants
  { patterns: [/PATIO\s*CENCOSUD/i, /KF\s*\d+\s*PATIO\s*CENCOSUD/i, /CENCOSUD/i], normalizedName: 'Cencosud', suggestedCategory: 'food' },
  { patterns: [/CLAUDE[\.\s]*AI/i, /CLAUDE\.AI\s*SUB/i], normalizedName: 'Claude AI', suggestedCategory: 'subscriptions' },
  { patterns: [/DLC\*GODADDY/i, /GODADDY/i], normalizedName: 'GoDaddy', suggestedCategory: 'subscriptions' },
  { patterns: [/RESTREAM/i], normalizedName: 'Restream', suggestedCategory: 'subscriptions' },
  { patterns: [/PLIN/i], normalizedName: 'PLIN', suggestedCategory: 'other-expense' },
  { patterns: [/YAPEO\s*A\s*CELULAR/i], normalizedName: 'Yapeo', suggestedCategory: 'other-expense' },
  { patterns: [/PAGO\s*CON\s*QR/i], normalizedName: 'Pago QR', suggestedCategory: 'shopping' },
  { patterns: [/DEVOLUCI[OÓ]N/i], normalizedName: 'Devolución', suggestedCategory: 'other-income' },

  // Gaming
  { patterns: [/steam/i, /STEAMPOWERED/i], normalizedName: 'Steam', suggestedCategory: 'entertainment' },
  { patterns: [/playstation/i, /PSN/i, /PS\s*PLUS/i], normalizedName: 'PlayStation', suggestedCategory: 'entertainment' },
  { patterns: [/xbox/i, /MICROSOFT\s*\*Xbox/i], normalizedName: 'Xbox', suggestedCategory: 'entertainment' },
  { patterns: [/nintendo/i], normalizedName: 'Nintendo', suggestedCategory: 'entertainment' },
];

export interface NormalizationResult {
  originalDescription: string;
  normalizedName: string;
  suggestedCategory: string | null;
  wasNormalized: boolean;
}

export function normalizeDescription(description: string): NormalizationResult {
  const trimmed = description.trim();

  for (const rule of normalizationRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        return {
          originalDescription: trimmed,
          normalizedName: rule.normalizedName,
          suggestedCategory: rule.suggestedCategory,
          wasNormalized: true,
        };
      }
    }
  }

  // Clean up common bank noise if no rule matched
  let cleaned = trimmed
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^(PY|DLC|PAG|COMPRA EN|PAGO A|TRANSF\.?\s*A?)\s*/i, '')
    .trim();

  // Title case
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  return {
    originalDescription: trimmed,
    normalizedName: cleaned || trimmed,
    suggestedCategory: null,
    wasNormalized: cleaned !== trimmed,
  };
}

export function batchNormalize(descriptions: string[]): Map<string, NormalizationResult> {
  const results = new Map<string, NormalizationResult>();
  for (const desc of descriptions) {
    if (!results.has(desc)) {
      results.set(desc, normalizeDescription(desc));
    }
  }
  return results;
}
