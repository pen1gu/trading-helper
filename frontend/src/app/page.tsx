'use client';

export default function Home() {
  return (
    <div className="space-y-10">
      {/* 글로벌 매크로 지표 롤링 티커 (Simulated) */}
      <section className="bg-slate-900 -mx-4 py-3 overflow-hidden whitespace-nowrap">
        <div className="flex space-x-12 animate-marquee text-white text-sm font-medium">
          <span>KOSPI: 2,750.32 <span className="text-red-400">▲ 1.2%</span></span>
          <span>S&P 500: 5,230.15 <span className="text-red-400">▲ 0.8%</span></span>
          <span>USD/KRW: 1,350.50 <span className="text-blue-400">▼ 0.3%</span></span>
          <span>WTI: $78.50 <span className="text-red-400">▲ 2.1%</span></span>
          <span>Gold: $2,350.20 <span className="text-blue-400">▼ 0.1%</span></span>
          {/* Repeat for continuous effect */}
          <span>KOSPI: 2,750.32 <span className="text-red-400">▲ 1.2%</span></span>
          <span>S&P 500: 5,230.15 <span className="text-red-400">▲ 0.8%</span></span>
        </div>
      </section>

      {/* AI 요약 브리핑 */}
      <section className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-600 p-2 rounded-lg">
            <span className="text-white">🤖</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">AI 마켓 브리핑</h2>
        </div>
        <div className="prose prose-slate max-w-none">
          <p className="text-lg text-slate-700 leading-relaxed font-medium">
            오늘 시장은 미국 테크 기업들의 호실적과 금리 인하 기대감이 맞물리며 전반적인 <span className="text-red-600">상승세</span>를 보이고 있습니다.
          </p>
          <ul className="mt-6 space-y-4">
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded mr-3 mt-1 text-xs">핵심</span>
              <span className="text-slate-600">반도체 섹터의 모멘텀이 강화되고 있으며, 특히 온디바이스 AI 관련주들에 대한 관심이 높습니다.</span>
            </li>
            <li className="flex items-start">
              <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded mr-3 mt-1 text-xs">주의</span>
              <span className="text-slate-600">유가 상승에 따른 인플레이션 압력이 일부 존재하므로 환율 변동성을 주시할 필요가 있습니다.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 퀵 액션 카드 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 hover:shadow-md transition-shadow">
          <h3 className="font-bold text-blue-900 mb-2">오늘의 Top 3 Long</h3>
          <p className="text-sm text-blue-700">엔비디아, SK하이닉스, 애플</p>
        </div>
        <div className="bg-red-50 p-6 rounded-xl border border-red-100 hover:shadow-md transition-shadow">
          <h3 className="font-bold text-red-900 mb-2">오늘의 Top 3 Short</h3>
          <p className="text-sm text-red-700">테슬라, 인텔, 보잉</p>
        </div>
        <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 hover:shadow-md transition-shadow text-center flex flex-col justify-center">
          <p className="text-xs text-slate-500 mb-1">다음 리포트 갱신까지</p>
          <p className="text-2xl font-mono font-bold text-slate-800">14:20:45</p>
        </div>
      </section>
    </div>
  );
}
