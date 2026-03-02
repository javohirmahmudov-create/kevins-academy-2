'use client';

import { useMemo, useState } from 'react';
import { CreditCard, Copy, Check, ExternalLink, Wallet, Send } from 'lucide-react';

const CARD_NUMBER = process.env.NEXT_PUBLIC_PAYMENT_CARD_NUMBER || '9860 3501 4447 3575';
const CARD_EXPIRES = process.env.NEXT_PUBLIC_PAYMENT_CARD_EXPIRES || '08/30';

export default function PayLandingPage() {
  const [copied, setCopied] = useState(false);

  const paymentText = useMemo(() => {
    return `Kevin's Academy to'lov kartasi: ${CARD_NUMBER}, amal qilish muddati: ${CARD_EXPIRES}`;
  }, []);

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(CARD_NUMBER.replace(/\s+/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const shareToPaymentApp = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Kevin's Academy to'lov",
          text: paymentText,
        });
      }
    } catch {
      // user canceled share
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-cyan-50 px-4 py-10">
      <section className="max-w-xl mx-auto bg-white rounded-3xl border border-emerald-100 shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Karta orqali to'lash</h1>
            <p className="text-sm text-gray-500">Telefoningizdagi to'lov ilovasi orqali to'lov qiling</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <p className="text-sm text-gray-500 mb-2">Karta raqami</p>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xl sm:text-2xl tracking-wide font-semibold text-gray-900">{CARD_NUMBER}</p>
              <p className="text-sm text-gray-500 mt-2">Amal qilish muddati: {CARD_EXPIRES}</p>
            </div>
            <CreditCard className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <button
            onClick={copyCard}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Nusxalandi' : 'Kartani nusxalash'}
          </button>

          <button
            onClick={shareToPaymentApp}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            To'lov ilovasiga ulashish
          </button>

          <a
            href="https://payme.uz/home/main"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Payme ochish
          </a>

          <a
            href="https://my.click.uz/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Click ochish
          </a>
        </div>
      </section>
    </main>
  );
}
