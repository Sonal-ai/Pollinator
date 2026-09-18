import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Check if the environment variable for Pinata JWT exists
    if (!process.env.PINATA_JWT) {
      return new NextResponse('Pinata JWT is not configured', { status: 500 });
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: {
          name: `pollinator-batch-${data.batchCode || Date.now()}`,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Pinata API Error: ${errorText}`);
    }

    const result = await res.json();
    return NextResponse.json({ cid: result.IpfsHash });
  } catch (error: any) {
    console.error('IPFS Upload Error:', error);
    return new NextResponse(`Error uploading to IPFS: ${error.message}`, { status: 500 });
  }
}
