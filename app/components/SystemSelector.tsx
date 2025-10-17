'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SystemSelector() {
  const pathname = usePathname();
  
  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">System:</span>
          <Link
            href="/"
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              pathname === '/'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Custom Agents
          </Link>
          <Link
            href="/ai-sdk"
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              pathname === '/ai-sdk'
                ? 'bg-green-100 text-green-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            AI SDK Agents
          </Link>
        </div>
      </div>
    </div>
  );
}
