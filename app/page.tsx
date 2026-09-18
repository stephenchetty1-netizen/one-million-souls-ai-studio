'use client';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">One Million Souls AI Studio</h1>
        <p className="text-xl text-gray-400 mb-4">Christian Content AI Discernment v59</p>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-700 p-6 hover:bg-gray-900">
            <h2 className="text-xl font-semibold mb-2">Features</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>AI-powered content analysis</li>
              <li>Christian discernment framework</li>
              <li>Real-time processing</li>
            </ul>
          </div>
          
          <div className="rounded-lg border border-gray-700 p-6 hover:bg-gray-900">
            <h2 className="text-xl font-semibold mb-2">Status</h2>
            <p className="text-green-400 font-mono">✓ Backend: Online</p>
            <p className="text-green-400 font-mono">✓ API: 9339/tcp</p>
            <p className="text-green-400 font-mono">✓ v59 Ready</p>
          </div>
        </div>
      </div>
    </main>
  );
}
