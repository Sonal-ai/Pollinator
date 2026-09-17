import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans">
      <main className="flex flex-col items-center max-w-2xl text-center px-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
          Pollinator
        </h1>
        <p className="text-xl text-gray-600 mb-10 leading-relaxed">
          The unified platform connecting beekeepers, quality assurance labs, and consumers.
          Empowering agriculture with real-time IoT monitoring and transparent supply chains.
        </p>
        
        <div className="flex gap-4">
          <Link href="/dashboard" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-sm">
            Open Web Dashboard
          </Link>
          <a href="#whatsapp" className="px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition shadow-sm">
            WhatsApp Bot Info
          </a>
        </div>
      </main>
    </div>
  );
}
