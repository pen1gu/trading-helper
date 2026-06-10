export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">환경 설정</h1>
        <p className="mt-1 text-sm text-muted">시스템 연동 및 사용자 알림 설정</p>
      </header>

      <div className="card-modern space-y-6 p-8">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">디스코드 Webhook URL</label>
          <input
            type="text"
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-soft)] outline-none transition-all focus:bg-card focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">
            관심 종목 티커 관리 (쉼표로 구분)
          </label>
          <input
            type="text"
            placeholder="AAPL, NVDA, TSLA, 005930"
            className="w-full rounded-2xl bg-surface p-3 text-sm shadow-[var(--shadow-soft)] outline-none transition-all focus:bg-card focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button type="button" className="btn-primary px-6 py-2.5 text-sm">
          설정 저장
        </button>
      </div>
    </div>
  );
}
