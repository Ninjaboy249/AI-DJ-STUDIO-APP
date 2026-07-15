'use client';
// src/app/page.tsx — Root route.
// Must be a Client Component so that dynamic(..., { ssr: false }) is allowed.
// AudioContext + Elementary WASM cannot run on the server.

import dynamic from 'next/dynamic';

const App = dynamic(() => import('@/components/App'), {
  ssr: false,
  loading: () => (
    <div className="loading-screen">
      ⬡ AI DJ Studio — Loading…
    </div>
  ),
});

export default function Page() {
  return <App />;
}
