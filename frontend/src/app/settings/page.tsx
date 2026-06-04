export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">환경 설정</h1>
        <p className="text-slate-600">시스템 연동 및 사용자 알림 설정</p>
      </header>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">디스코드 Webhook URL</label>
          <input 
            type="text" 
            placeholder="https://discord.com/api/webhooks/..." 
            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">관심 종목 티커 관리 (쉼표로 구분)</label>
          <input 
            type="text" 
            placeholder="AAPL, NVDA, TSLA, 005930" 
            className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors">
          설정 저장
        </button>
      </div>
    </div>
  );
}
