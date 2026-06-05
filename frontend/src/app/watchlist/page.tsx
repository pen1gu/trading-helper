import StockTable from '@/components/StockTable';
import { Plus } from 'lucide-react';

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">내 관심 종목</h1>
          <p className="mt-1 text-sm text-neutral-500">펀더멘털 지표 및 AI 기반 투자 인사이트</p>
        </div>
        <button type="button" className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
          <Plus size={18} />
          종목 추가
        </button>
      </header>

      <div className="card-modern overflow-hidden">
        <StockTable />
      </div>
    </div>
  );
}
