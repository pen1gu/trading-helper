import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-slate-900 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          📊 StockInsight <span className="text-blue-400">AI</span>
        </Link>
        <div className="space-x-6 text-sm font-medium">
          <Link href="/" className="hover:text-blue-400 transition-colors">홈</Link>
          <Link href="/watchlist" className="hover:text-blue-400 transition-colors">관심종목</Link>
          <Link href="/discover" className="hover:text-blue-400 transition-colors">탐색</Link>
          <Link href="/news" className="hover:text-blue-400 transition-colors">뉴스</Link>
          <Link href="/settings" className="hover:text-blue-400 transition-colors">설정</Link>
        </div>
      </div>
    </nav>
  );
}
