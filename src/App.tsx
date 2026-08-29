import { useState } from 'react';
import { MiniTradingChart } from './components/MiniTradingChart';
import { TickerData, GoNoGoState } from './types/trading';

// 1. Générateur de fausses données historiques pour le rendu initial
const generateMockCandles = (basePrice: number, count: number) => {
  const candles = [];
  let currentPrice = basePrice;
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateString = date.toISOString().split('T')[0];
    const change = (Math.random() - 0.48) * (basePrice * 0.03);
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * (basePrice * 0.01);
    const low = Math.min(open, close) - Math.random() * (basePrice * 0.01);
    const volume = Math.floor(Math.random() * 500000) + 100000;

    candles.push({ time: dateString, open, high, low, close, volume });
    currentPrice = close;
  }
  return candles;
};

// Injection des actions majeures visibles sur vos captures d'écran
const INITIAL_TICKERS: Partial<TickerData>[] = [
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 265.85, state: 'GO', score: 0.43, volumeChange: 131, ma9: 258.14, ma21: 260.09, rsi: 83.5 },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 320.97, state: 'STRONG_GO', score: 0.97, volumeChange: 108, ma9: 315.66, ma21: 312.99, rsi: 86.9 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 220.18, state: 'GO', score: 0.45, volumeChange: 269, ma9: 222.97, ma21: 216.08, rsi: 39.7 },
  { symbol: 'ONON', name: 'On Holding AG', price: 28.94, state: 'NOGO', score: -0.97, volumeChange: -62, ma9: 29.10, ma21: 28.12, rsi: 39.3 },
  { symbol: 'BABA', name: 'Alibaba Group', price: 118.39, state: 'NOGO', score: -0.35, volumeChange: -39, ma9: 117.34, ma21: 118.43, rsi: 59.4 },
  { symbol: 'CRM', name: 'Salesforce, Inc.', price: 259.88, state: 'STRONG_GO', score: 0.96, volumeChange: -51, ma9: 242.74, ma21: 222.19, rsi: 89.3 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'screener' | 'charts'>('screener');

  // Transformation des tickers avec leur jeu de bougies complet
  const [tickers] = useState<TickerData[]>(() =>
    INITIAL_TICKERS.map(t => ({
      ...t,
      candles: generateMockCandles(t.price!, 30)
    } as TickerData))
  );

  // Fonction utilitaire pour associer les couleurs de badges v4
  const getStateBadgeClass = (state: GoNoGoState) => {
    switch (state) {
      case 'STRONG_GO':
        return 'bg-[var(--color-gonogo-strong-go)] text-white font-bold';
      case 'GO':
        return 'bg-[var(--color-gonogo-go)] text-black font-bold';
      case 'NEUTRAL':
        return 'bg-[var(--color-gonogo-neutral)] text-black font-bold';
      case 'WEAK_NOGO':
        return 'bg-[var(--color-gonogo-weak-no-go)] text-white font-bold';
      case 'NOGO':
        return 'bg-[var(--color-gonogo-no-go)] text-white font-bold';
      default:
        return 'bg-gray-500 text-white';
    }
  };



  return (
    <div className="min-h-screen bg-trading-bg text-gray-200">
      {/* Barre de navigation supérieure de Quoter */}
      <header className="border-b border-trading-border bg-trading-card px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-wider text-white">QUOTER</span>
          <span className="text-xs bg-trading-border px-2 py-1 rounded text-gray-400">v4.0.0-TS</span>
        </div>

        {/* Commutateur de vues */}
        <div className="flex bg-trading-bg p-1 rounded-lg border border-trading-border">
          <button
            onClick={() => setActiveTab('screener')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'screener' ? 'bg-trading-border text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Screener Dashboard
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'charts' ? 'bg-trading-border text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Multi-Chart Grid
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="p-6">
        {activeTab === 'screener' ? (
          <div className="bg-trading-card border border-trading-border rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-trading-border bg-trading-bg/50">
              <h2 className="text-base font-bold text-white">Alertes Bourse — Timeframe 90min</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm table-fixed">
                <thead>
                  <tr className="border-b border-trading-border text-gray-400 uppercase text-xs tracking-wider bg-trading-bg/20">
                    <th className="p-4 w-1/4">Titre</th>
                    <th className="p-4 w-28">Prix</th>
                    <th className="p-4 w-48">GoNoGo Status</th>
                    <th className="p-4 w-32 text-right">Volume (24h)</th>
                    <th className="p-4 w-28 text-right">MA 9</th>
                    <th className="p-4 w-28 text-right">MA 21</th>
                    <th className="p-4 w-24 text-right">RSI (5)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-trading-border/50">
                  {tickers.map((ticker) => (
                    <tr key={ticker.symbol} className="hover:bg-trading-border/30 transition-colors whitespace-nowrap">
                      {/* Colonne Titre avec retour à la ligne maîtrisé */}
                      <td className="p-4 truncate">
                        <div className="font-bold text-white tracking-wide text-sm">{ticker.symbol}</div>
                        <div className="text-xs text-gray-500 font-normal truncate">{ticker.name}</div>
                      </td>

                      {/* Colonne Prix */}
                      <td className="p-4 font-mono font-medium text-gray-300">
                        {ticker.price.toFixed(2)}
                      </td>

                      {/* Colonne GoNoGo avec de vrais badges stylisés (Image 1) */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase tracking-wider inline-flex items-center justify-center min-w-36 text-center ${getStateBadgeClass(ticker.state)}`}>
                          {ticker.state.replace('_', ' ')} ({ticker.score > 0 ? `+${ticker.score.toFixed(2)}` : ticker.score.toFixed(2)})
                        </span>
                      </td>

                      {/* Colonne Volume */}
                      <td className={`p-4 text-right font-mono font-bold ${ticker.volumeChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ticker.volumeChange > 0 ? `+${ticker.volumeChange}%` : `${ticker.volumeChange}%`}
                      </td>

                      {/* Colonnes Indicateurs */}
                      <td className="p-4 text-right font-mono text-emerald-500/90">{ticker.ma9.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-emerald-600/90">{ticker.ma21.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-amber-500/90">{ticker.rsi.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grille Multi-Graphique (Image 2) */
          <div>
            <div className="mb-4 text-xs text-gray-500">
              Affichage en temps réel • Modèle d'affichage Canvas 4 colonnes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tickers.map((ticker) => (
                <MiniTradingChart
                  key={ticker.symbol}
                  symbol={ticker.symbol}
                  data={ticker.candles}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
