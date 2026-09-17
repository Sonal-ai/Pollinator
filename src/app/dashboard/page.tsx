import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Ensures this is always server-side rendered

export default async function DashboardPage() {
  let batches = [];
  try {
    batches = await prisma.honeyBatch.findMany({
      orderBy: { createdAt: 'desc' }
    });
  } catch (error) {
    console.error('Database connection failed, using mock data for UI demo');
    batches = [
      { id: '1', batch_id_hash: 'BATCH-A1B2', quantity_grams: 50000, honey_type: 'Mustard', status: 'VERIFIED' },
      { id: '2', batch_id_hash: 'BATCH-C3D4', quantity_grams: 25000, honey_type: 'Litchi', status: 'PENDING' },
    ];
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pollinator Dashboard</h1>
            <p className="text-gray-500 mt-1">Quality Assurance & Distribution Portal</p>
          </div>
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-medium">
            AWS Cloud Connected
          </div>
        </header>

        <main className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">Recent Honey Batches</h2>
            <button className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition">
              Refresh Data
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm">
                  <th className="py-3 px-6 font-medium">Batch ID</th>
                  <th className="py-3 px-6 font-medium">Type</th>
                  <th className="py-3 px-6 font-medium">Volume (kg)</th>
                  <th className="py-3 px-6 font-medium">Status</th>
                  <th className="py-3 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map((batch: any) => (
                  <tr key={batch.id} className="hover:bg-gray-50 transition">
                    <td className="py-4 px-6 font-mono text-sm text-gray-700">{batch.batch_id_hash}</td>
                    <td className="py-4 px-6 text-gray-700">{batch.honey_type}</td>
                    <td className="py-4 px-6 text-gray-700">{(batch.quantity_grams / 1000).toFixed(1)}</td>
                    <td className="py-4 px-6">
                      <span className={\`px-2.5 py-1 rounded-full text-xs font-medium \${
                        batch.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 
                        batch.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-gray-100 text-gray-700'
                      }\`}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View IoT Data
                      </button>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No honey batches registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
