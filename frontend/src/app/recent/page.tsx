import StockTable from '@/components/StockTable';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function RecentPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">최근 본 종목</h1>
          <p className="mt-1 text-sm text-muted">최근 조회한 종목 목록</p>
        </div>
        <Link
          href="/discover"
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <Compass size={18} strokeWidth={1.5} />
          종목 탐색
        </Link>
      </header>

      <div className="card-modern overflow-hidden">
        <StockTable
          endpoint="/recent-views"
          emptyMessage="최근 조회한 종목이 없습니다."
        />
      </div>
    </div>
  );
}
