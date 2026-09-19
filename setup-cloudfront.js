require('dotenv').config();
const { CloudFrontClient, CreateDistributionCommand } = require('@aws-sdk/client-cloudfront');

const REGION = process.env.AWS_REGION || 'us-east-1';
const client = new CloudFrontClient({ region: REGION });

async function main() {
  console.log('🌐 Creating AWS CloudFront Distribution for HTTPS...');
  
  // Use the EC2 public DNS as the origin
  const originDomain = 'ec2-107-22-149-11.compute-1.amazonaws.com';
  
  const params = {
    DistributionConfig: {
      CallerReference: Date.now().toString(),
      Comment: 'Pollinator Next.js Frontend - Secure CDN',
      Enabled: true,
      Origins: {
        Quantity: 1,
        Items: [
          {
            Id: 'EC2Origin',
            DomainName: originDomain,
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: 'http-only',
              OriginSslProtocols: {
                Quantity: 1,
                Items: ['TLSv1.2']
              }
            }
          }
        ]
      },
      DefaultCacheBehavior: {
        TargetOriginId: 'EC2Origin',
        ViewerProtocolPolicy: 'redirect-to-https',
        TrustedSigners: { Enabled: false, Quantity: 0 },
        TrustedKeyGroups: { Enabled: false, Quantity: 0 },
        MinTTL: 0,
        ForwardedValues: {
          QueryString: true,
          Cookies: { Forward: 'all' },
          Headers: {
            Quantity: 1,
            Items: ['Host']
          }
        }
      }
    }
  };

  try {
    const command = new CreateDistributionCommand(params);
    const response = await client.send(command);
    console.log('✅ CloudFront Distribution Created Successfully!');
    console.log(`\n======================================================`);
    console.log(`🔒 Your secure HTTPS URL is:`);
    console.log(`https://${response.Distribution.DomainName}`);
    console.log(`======================================================`);
    console.log('\n(Note: It takes about 3-5 minutes for AWS to deploy the CDN globally)');
  } catch (error) {
    console.error('❌ Error creating CloudFront distribution:', error.message);
  }
}

main();
