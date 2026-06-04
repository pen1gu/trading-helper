import StockTable from '@/components/StockTable';

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">내 관심 종목</h1>
          <p className="text-slate-500 mt-1">펀더멘털 지표 및 AI 기반 투자 인사이트</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors">
          종목 추가
        </button>
      </header>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <StockTable />
      </div>
    </div>
  );
}
