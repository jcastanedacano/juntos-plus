import { DetectedSubscription, CutSuggestion } from '../types';

const STREAMING_SERVICES = ['netflix', 'disney+', 'hbo max', 'amazon prime', 'apple tv+', 'paramount+', 'star+', 'crunchyroll'];
const MUSIC_SERVICES = ['spotify', 'youtube premium', 'apple music', 'deezer', 'tidal'];
const STORAGE_SERVICES = ['google one', 'icloud', 'dropbox', 'onedrive'];
const DELIVERY_SERVICES = ['rappi', 'pedidosya', 'glovo', 'uber eats'];

function findServiceCategory(name: string): string | null {
  const lower = name.toLowerCase();
  if (STREAMING_SERVICES.some(s => lower.includes(s))) return 'streaming';
  if (MUSIC_SERVICES.some(s => lower.includes(s))) return 'música';
  if (STORAGE_SERVICES.some(s => lower.includes(s))) return 'almacenamiento';
  if (DELIVERY_SERVICES.some(s => lower.includes(s))) return 'delivery';
  return null;
}

function getMonthlyEquivalent(sub: DetectedSubscription): number {
  switch (sub.frequency) {
    case 'weekly': return sub.estimatedAmount * 4.33;
    case 'monthly': return sub.estimatedAmount;
    case 'quarterly': return sub.estimatedAmount / 3;
    case 'yearly': return sub.estimatedAmount / 12;
  }
}

export function analyzeSavings(subscriptions: DetectedSubscription[]): CutSuggestion[] {
  const active = subscriptions.filter(s => !s.isDismissed);
  const suggestions: CutSuggestion[] = [];
  let suggestionId = 0;

  // 1. Detect duplicate services in same category
  const serviceCategories = new Map<string, DetectedSubscription[]>();
  for (const sub of active) {
    const category = findServiceCategory(sub.normalizedName);
    if (category) {
      if (!serviceCategories.has(category)) serviceCategories.set(category, []);
      serviceCategories.get(category)!.push(sub);
    }
  }

  for (const [category, subs] of serviceCategories) {
    if (subs.length > 1) {
      const totalMonthly = subs.reduce((s, sub) => s + getMonthlyEquivalent(sub), 0);
      const names = subs.map(s => s.normalizedName).join(', ');
      suggestions.push({
        id: `cut_${++suggestionId}`,
        serviceName: names,
        monthlyCost: Math.round(totalMonthly * 100) / 100,
        annualCost: Math.round(totalMonthly * 12 * 100) / 100,
        reason: 'duplicate',
        reasonLabel: `Servicios duplicados de ${category}: ${names}`,
        relatedSubscriptionIds: subs.map(s => s.id),
        isDismissed: false,
        reminderDate: null,
      });
    }
  }

  // 2. Phantom spending: small charges (<20) that sum up to >100/month
  const smallSubs = active.filter(s => getMonthlyEquivalent(s) < 20);
  const totalSmall = smallSubs.reduce((s, sub) => s + getMonthlyEquivalent(sub), 0);
  if (totalSmall > 100 && smallSubs.length >= 3) {
    suggestions.push({
      id: `cut_${++suggestionId}`,
      serviceName: `${smallSubs.length} suscripciones pequeñas`,
      monthlyCost: Math.round(totalSmall * 100) / 100,
      annualCost: Math.round(totalSmall * 12 * 100) / 100,
      reason: 'phantom',
      reasonLabel: `${smallSubs.length} pagos pequeños suman S/ ${totalSmall.toFixed(0)}/mes — ${smallSubs.map(s => s.normalizedName).join(', ')}`,
      relatedSubscriptionIds: smallSubs.map(s => s.id),
      isDismissed: false,
      reminderDate: null,
    });
  }

  // 3. Forgotten subscriptions: small amounts user might not remember
  for (const sub of active) {
    const monthly = getMonthlyEquivalent(sub);
    if (monthly < 15 && sub.confidence === 'medium') {
      suggestions.push({
        id: `cut_${++suggestionId}`,
        serviceName: sub.normalizedName,
        monthlyCost: Math.round(monthly * 100) / 100,
        annualCost: Math.round(monthly * 12 * 100) / 100,
        reason: 'forgotten',
        reasonLabel: `Pago pequeño recurrente que podrías haber olvidado`,
        relatedSubscriptionIds: [sub.id],
        isDismissed: false,
        reminderDate: null,
      });
    }
  }

  // 4. Top expensive subscriptions
  const sorted = [...active].sort((a, b) => getMonthlyEquivalent(b) - getMonthlyEquivalent(a));
  for (const sub of sorted.slice(0, 3)) {
    const monthly = getMonthlyEquivalent(sub);
    if (monthly > 50) {
      suggestions.push({
        id: `cut_${++suggestionId}`,
        serviceName: sub.normalizedName,
        monthlyCost: Math.round(monthly * 100) / 100,
        annualCost: Math.round(monthly * 12 * 100) / 100,
        reason: 'expensive',
        reasonLabel: `Gasto significativo: S/ ${monthly.toFixed(0)}/mes (S/ ${(monthly * 12).toFixed(0)}/año)`,
        relatedSubscriptionIds: [sub.id],
        isDismissed: false,
        reminderDate: null,
      });
    }
  }

  return suggestions;
}

export function getTotalPotentialSavings(suggestions: CutSuggestion[]): { monthly: number; annual: number } {
  const active = suggestions.filter(s => !s.isDismissed);
  // Avoid double-counting by tracking seen subscription IDs
  const seenIds = new Set<string>();
  let monthly = 0;

  for (const suggestion of active) {
    const newIds = suggestion.relatedSubscriptionIds.filter(id => !seenIds.has(id));
    if (newIds.length > 0) {
      // Proportional cost based on new IDs
      const proportion = newIds.length / suggestion.relatedSubscriptionIds.length;
      monthly += suggestion.monthlyCost * proportion;
      newIds.forEach(id => seenIds.add(id));
    }
  }

  return {
    monthly: Math.round(monthly * 100) / 100,
    annual: Math.round(monthly * 12 * 100) / 100,
  };
}
