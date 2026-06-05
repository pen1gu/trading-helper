'use client';

import { Bell, MessageSquare, Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          placeholder="종목, 뉴스 검색..."
          className="w-72 rounded-xl border border-neutral-200 bg-white py-3 pl-11 pr-4 text-sm text-neutral-900 shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white transition-colors hover:bg-neutral-50"
        >
          <Bell size={18} className="text-neutral-600" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[9px] font-bold text-white">
            3
          </span>
        </button>
        <button
          type="button"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white transition-colors hover:bg-neutral-50"
        >
          <MessageSquare size={18} className="text-neutral-600" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[9px] font-bold text-white">
            2
          </span>
        </button>
        <div className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-sm font-semibold text-white">
          U
        </div>
      </div>
    </header>
  );
}
