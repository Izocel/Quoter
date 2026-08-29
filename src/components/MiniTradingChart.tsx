import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickSeries } from 'lightweight-charts';
import { CandleData } from '../types/trading';

interface ChartProps {
    symbol: string;
    data: CandleData[];
}

export const MiniTradingChart: React.FC<ChartProps> = ({ symbol, data }) => {
    const chartContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart: IChartApi = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 200,
            layout: {
                background: { type: ColorType.Solid, color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1f222d' },
                horzLines: { color: '#1f222d' },
            },
            rightPriceScale: { borderColor: '#242832' },
            timeScale: { borderColor: '#242832', timeVisible: true },
            handleScale: false,
            handleScroll: false,
        });

        // ✅ 2. Nouvelle écriture v5 standardisée : utilisation de addSeries avec CandlestickSeries
        const candlestickSeries: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        const sortedData = [...data].sort((a, b) => a.time.localeCompare(b.time));

        candlestickSeries.setData(
            sortedData.map(c => ({
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }))
        );

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current && chart) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data]);

    return (
        <div className="border border-trading-border bg-trading-card p-4 rounded-xl shadow-lg flex flex-col justify-between transition-all hover:border-gray-700">
            <div className="flex justify-between items-center mb-3">
                <span className="text-white font-bold text-sm tracking-wider">{symbol}</span>
                <span className="text-xs text-gray-500 font-mono">1M • 90m</span>
            </div>
            <div ref={chartContainerRef} className="w-full" />
        </div>
    );
};
