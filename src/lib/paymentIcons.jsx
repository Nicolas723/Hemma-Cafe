import { Banknote, CreditCard, Smartphone, Landmark, Zap, Coffee, Wallet, Gift, Coins } from "lucide-react";

/**
 * Íconos vectoriales para los métodos de pago (se ven bien en Windows 7,
 * a diferencia de los emojis). Se elige por nombre y, si no coincide, por emoji.
 */
const BY_NAME = [
    [/efectivo|cash/i, Banknote],
    [/tarjeta|dat[aá]fono|card/i, CreditCard],
    [/nequi/i, Smartphone],
    [/daviplata|banco|transfer/i, Landmark],
    [/bre-?b|llave/i, Zap],
    [/servicio|cortes/i, Coffee],
    [/bono|regalo/i, Gift],
];

const BY_EMOJI = {
    "💵": Banknote,
    "💳": CreditCard,
    "📱": Smartphone,
    "🏦": Landmark,
    "⚡": Zap,
    "☕": Coffee,
    "🎁": Gift,
    "🪙": Coins,
    "💰": Coins,
};

export function paymentIcon(method) {
    const name = typeof method === "string" ? method : method?.name || "";
    for (const [re, Icon] of BY_NAME) if (re.test(name)) return Icon;
    const emoji = typeof method === "object" ? method?.emoji : null;
    return BY_EMOJI[emoji] || Wallet;
}

export function PaymentIcon({ method, size = 18, ...rest }) {
    const Icon = paymentIcon(method);
    return <Icon size={size} {...rest} />;
}

export const DEFAULT_PAYMENT_METHODS = [
    { id: "efectivo", name: "Efectivo", emoji: "💵", order: 1 },
    { id: "tarjeta", name: "Tarjeta", emoji: "💳", order: 2 },
    { id: "bre-b", name: "Bre-B", emoji: "⚡", order: 3 },
    { id: "nequi", name: "Nequi", emoji: "📱", order: 4 },
    { id: "daviplata", name: "Daviplata", emoji: "🏦", order: 5 },
];

/** "Servicio" = consumo interno/cortesía: total en 0. Siempre disponible en caja. */
export const SERVICE_METHOD = { id: "__servicio", name: "Servicio", emoji: "☕", order: 999 };
