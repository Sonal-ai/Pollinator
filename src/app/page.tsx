import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">🐝</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Pollinator
        </h1>
        <p className="text-xl text-gray-600 mb-3 max-w-2xl mx-auto">
          Blockchain-backed honey supply chain provenance.
          From hive to jar — every step verified on the Polygon blockchain.
        </p>
        <p className="text-sm text-gray-400 mb-10">
          Powered by Polygon · IPFS · WhatsApp Bot · IoT Sensors
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition text-sm shadow-sm"
          >
            📋 Supply Chain Dashboard
          </Link>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''}?text=Hi`}
            target="_blank" rel="noopener noreferrer"
            className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition text-sm shadow-sm"
          >
            📱 WhatsApp Bot for Farmers
          </a>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: '⛓️', title: 'Blockchain Provenance',
              desc: 'Every harvest, lab test, and custody transfer is permanently recorded on Polygon. Immutable and verifiable.'
            },
            {
              icon: '🧪', title: 'Lab Certification',
              desc: 'Lab certificate PDFs are hashed and stored on IPFS. The hash is committed on-chain — tampering is immediately detectable.'
            },
            {
              icon: '📱', title: 'WhatsApp Bot',
              desc: 'Beekeepers register, log harvests, and get Q&A answers in their local language via WhatsApp. No app download needed.'
            },
            {
              icon: '📡', title: 'IoT Hive Monitoring',
              desc: 'ESP32 sensors track temperature, humidity, weight, and battery in real time. Data feeds into harvest metadata.'
            },
            {
              icon: '🔍', title: 'Anti-Clone QR',
              desc: 'Each jar gets a unique HMAC-signed QR. Geographic anomaly detection flags cloned QRs scanned from multiple regions.'
            },
            {
              icon: '✅', title: 'Consumer Verification',
              desc: 'Scan any jar\'s QR to see its full journey — beekeeper, lab results, custody chain — all backed by blockchain.'
            },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Consumer QR Demo */}
      <div className="max-w-5xl mx-auto px-6 pb-20 text-center">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-8 text-white">
          <p className="text-3xl mb-3">📱</p>
          <h2 className="text-xl font-bold mb-2">Bought Pollinator honey?</h2>
          <p className="text-amber-100 text-sm mb-4">
            Scan the QR code on your jar to verify its authenticity and trace its full supply chain journey.
          </p>
          <p className="text-amber-200 text-xs">
            Verification is instant, free, and requires no account.
          </p>
        </div>
      </div>

      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100">
        Pollinator · Built with Next.js, Polygon, IPFS, WhatsApp Cloud API
      </footer>
    </div>
  );
}
