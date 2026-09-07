import { CancellationGuideData } from '../types';

export const cancellationGuides: Record<string, CancellationGuideData> = {
  netflix: {
    name: 'Netflix',
    url: 'https://www.netflix.com/cancelplan',
    steps: [
      'Inicia sesión en netflix.com',
      'Ve a tu perfil → Cuenta',
      'En "Membresía y facturación", haz clic en "Cancelar membresía"',
      'Confirma la cancelación',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'streaming',
  },
  spotify: {
    name: 'Spotify',
    url: 'https://www.spotify.com/account/subscription/',
    steps: [
      'Ve a spotify.com/account',
      'Haz clic en "Tu plan"',
      'Selecciona "Cambiar plan"',
      'Baja hasta "Cancelar Premium" y confirma',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'música',
  },
  'disney+': {
    name: 'Disney+',
    url: 'https://www.disneyplus.com/account',
    steps: [
      'Inicia sesión en disneyplus.com',
      'Ve a tu perfil → Cuenta',
      'Selecciona tu suscripción',
      'Haz clic en "Cancelar suscripción" y confirma',
    ],
    estimatedTime: '3 minutos',
    emailTemplate: null,
    category: 'streaming',
  },
  'hbo max': {
    name: 'HBO Max',
    url: 'https://www.max.com/account',
    steps: [
      'Inicia sesión en max.com',
      'Ve a Configuración → Suscripción',
      'Selecciona "Cancelar suscripción"',
      'Sigue los pasos de confirmación',
    ],
    estimatedTime: '3 minutos',
    emailTemplate: null,
    category: 'streaming',
  },
  'amazon prime': {
    name: 'Amazon Prime',
    url: 'https://www.amazon.com/hz/mycd/myx#/home/settings/payment',
    steps: [
      'Ve a amazon.com → Cuenta → Prime',
      'Haz clic en "Administrar membresía"',
      'Selecciona "Finalizar membresía"',
      'Confirma la cancelación (se mantiene hasta fin del período)',
    ],
    estimatedTime: '3 minutos',
    emailTemplate: null,
    category: 'streaming',
  },
  'youtube premium': {
    name: 'YouTube Premium',
    url: 'https://www.youtube.com/paid_memberships',
    steps: [
      'Ve a youtube.com/paid_memberships',
      'Haz clic en "Administrar membresía"',
      'Selecciona "Desactivar" o "Cancelar"',
      'Confirma la cancelación',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'streaming',
  },
  'apple tv+': {
    name: 'Apple TV+',
    url: 'https://support.apple.com/es-lamr/HT202039',
    steps: [
      'En tu iPhone: Configuración → [tu nombre] → Suscripciones',
      'En web: appleid.apple.com → Suscripciones',
      'Selecciona Apple TV+',
      'Toca "Cancelar suscripción"',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'streaming',
  },
  'google one': {
    name: 'Google One',
    url: 'https://one.google.com/settings',
    steps: [
      'Ve a one.google.com',
      'Haz clic en Configuración',
      'Selecciona "Cancelar membresía"',
      'Confirma la cancelación',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'almacenamiento',
  },
  icloud: {
    name: 'iCloud+',
    url: 'https://support.apple.com/es-lamr/HT207594',
    steps: [
      'En iPhone: Configuración → [tu nombre] → iCloud → Administrar almacenamiento',
      'Toca "Cambiar plan de almacenamiento"',
      'Selecciona "Reducir" para volver al plan gratuito',
      'Confirma el cambio',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'almacenamiento',
  },
  rappi: {
    name: 'Rappi Prime',
    url: 'https://www.rappi.com.pe',
    steps: [
      'Abre la app de Rappi',
      'Ve a tu perfil → "Rappi Prime"',
      'Selecciona "Cancelar membresía"',
      'Confirma la cancelación',
    ],
    estimatedTime: '3 minutos',
    emailTemplate: null,
    category: 'delivery',
  },
  'chatgpt plus': {
    name: 'ChatGPT Plus',
    url: 'https://chat.openai.com',
    steps: [
      'Inicia sesión en chat.openai.com',
      'Haz clic en tu perfil → "Mi plan"',
      'Selecciona "Administrar mi suscripción"',
      'Haz clic en "Cancelar plan"',
    ],
    estimatedTime: '2 minutos',
    emailTemplate: null,
    category: 'software',
  },
  canva: {
    name: 'Canva Pro',
    url: 'https://www.canva.com/account',
    steps: [
      'Ve a canva.com → Configuración de cuenta',
      'Selecciona "Facturación y planes"',
      'Haz clic en "Cancelar suscripción"',
      'Sigue los pasos de confirmación',
    ],
    estimatedTime: '3 minutos',
    emailTemplate: null,
    category: 'software',
  },
  platzi: {
    name: 'Platzi',
    url: 'https://platzi.com/cuenta/suscripcion/',
    steps: [
      'Inicia sesión en platzi.com',
      'Ve a Configuración → Suscripción',
      'Haz clic en "Cancelar suscripción"',
      'Completa la encuesta y confirma',
    ],
    estimatedTime: '3 minutos',
    emailTemplate: 'Asunto: Solicitud de cancelación de suscripción\n\nHola equipo de Platzi,\n\nSolicito la cancelación de mi suscripción asociada a este correo electrónico.\n\nGracias.',
    category: 'educación',
  },
  movistar: {
    name: 'Movistar',
    url: 'https://www.movistar.com.pe',
    steps: [
      'Llama al *611 o al 0800-00-800',
      'Solicita la cancelación del servicio',
      'También puedes ir a una tienda Movistar con tu DNI',
      'La baja puede demorar hasta 7 días hábiles',
    ],
    estimatedTime: '15-30 minutos',
    emailTemplate: 'Asunto: Solicitud de baja de servicio\n\nEstimados,\n\nPor medio del presente, solicito la baja de mi servicio de telecomunicaciones asociado a la línea [TU NÚMERO].\n\nDNI: [TU DNI]\nTitular: [TU NOMBRE]\n\nAgradezco su atención.\nSaludos.',
    category: 'telecom',
  },
  claro: {
    name: 'Claro',
    url: 'https://www.claro.com.pe',
    steps: [
      'Llama al *123 desde tu línea Claro',
      'Solicita la cancelación del servicio',
      'También puedes acudir a un Centro de Atención',
      'Lleva tu DNI original',
    ],
    estimatedTime: '15-30 minutos',
    emailTemplate: null,
    category: 'telecom',
  },
};

export function findGuide(serviceName: string): CancellationGuideData | null {
  const key = serviceName.toLowerCase().trim();
  return cancellationGuides[key] || null;
}

export function getAllGuideNames(): string[] {
  return Object.values(cancellationGuides).map(g => g.name);
}
