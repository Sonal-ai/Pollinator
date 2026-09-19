require('dotenv').config();
const { S3Client, CreateBucketCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { EC2Client, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand, RunInstancesCommand, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: REGION });
const ec2 = new EC2Client({ region: REGION });

async function zipDirectory(sourceDir, outPath) {
  const { execSync } = require('child_process');
  execSync(`tar -a -c -f ${outPath} --exclude=node_modules --exclude=.git --exclude=.next --exclude=deploy.zip --exclude=deploy.js *`, { stdio: 'inherit' });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('🚀 Starting AWS Deployment for Pollinator...');
  const bucketName = `pollinator-deploy-${Date.now()}`;
  const zipName = 'deploy.zip';

  // 1. Zip the project
  console.log('📦 Zipping codebase...');
  await zipDirectory(__dirname, zipName);
  console.log('✅ Codebase zipped.');

  // 2. Create S3 Bucket & Upload
  console.log(`🪣  Creating S3 Bucket: ${bucketName}...`);
  await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
  
  console.log('☁️  Uploading code to S3...');
  const fileStream = fs.createReadStream(zipName);
  const putCmd = new PutObjectCommand({ Bucket: bucketName, Key: zipName, Body: fileStream });
  await s3.send(putCmd);
  
  // 3. Generate Pre-signed URL
  console.log('🔗 Generating secure download link...');
  const presignedUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucketName, Key: zipName }), { expiresIn: 3600 });
  // Wait, I need a GET pre-signed URL, not PUT.
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: zipName }), { expiresIn: 3600 });
  console.log('✅ Download link generated.');

  // 4. Create Security Group
  console.log('🛡️  Creating Security Group...');
  const sgName = `pollinator-sg-${Date.now()}`;
  const sgRes = await ec2.send(new CreateSecurityGroupCommand({
    GroupName: sgName,
    Description: 'Security group for Pollinator Hackathon EC2 instance'
  }));
  const groupId = sgRes.GroupId;

  await ec2.send(new AuthorizeSecurityGroupIngressCommand({
    GroupId: groupId,
    IpPermissions: [
      { IpProtocol: 'tcp', FromPort: 80, ToPort: 80, IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
      { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '0.0.0.0/0' }] }
    ]
  }));

  // 5. UserData Script (Runs on boot to setup the server)
  const envFile = fs.readFileSync('.env', 'utf-8');
  // Write the exact same env variables to the server
  
  const userData = `#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "Starting deployment setup..."

# Install dependencies
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs unzip git

# Setup App Directory
mkdir -p /app
cd /app

# Download the codebase securely
curl -o deploy.zip "${getUrl}"
unzip deploy.zip

# Write environment variables
cat << 'EOF' > .env
${envFile}
EOF

# Setup database & build
npm install
npx prisma generate
npx prisma db push
node seed.js

# Create a 2GB Swap file to prevent Next.js OOM crashes during build on 1GB RAM instances
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Build Next.js
npm run build

# Start with PM2 on default port 3000
npm install -g pm2
pm2 start npm --name "pollinator" -- start
pm2 save
pm2 startup

# Install and configure NGINX to perfectly proxy Port 80 to Port 3000
yum install -y nginx
cat << 'EOF' > /etc/nginx/conf.d/pollinator.conf
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
systemctl enable nginx
systemctl start nginx
echo "Deployment complete!"
`;

  // 6. Launch EC2 Instance
  console.log('🔍 Fetching latest Amazon Linux 2023 AMI...');
  const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
  const ssm = new SSMClient({ region: REGION });
  const amiRes = await ssm.send(new GetParameterCommand({ Name: '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64' }));
  const AMI_ID = amiRes.Parameter.Value;
  
  console.log(`🖥️  Launching EC2 Instance using AMI ${AMI_ID}...`);
  const runRes = await ec2.send(new RunInstancesCommand({
    ImageId: AMI_ID,
    InstanceType: 't3.micro',
    MinCount: 1,
    MaxCount: 1,
    SecurityGroupIds: [groupId],
    UserData: Buffer.from(userData).toString('base64')
  }));

  const instanceId = runRes.Instances[0].InstanceId;
  console.log(`✅ EC2 Instance launched! ID: ${instanceId}`);
  console.log('⏳ Waiting for public IP assignment (approx 15 seconds)...');

  let publicIp = null;
  while (!publicIp) {
    await sleep(5000);
    const descRes = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
    publicIp = descRes.Reservations[0].Instances[0].PublicIpAddress;
  }

  console.log('\n======================================================');
  console.log('🎉 DEPLOYMENT SUCCESSFUL! 🎉');
  console.log('======================================================');
  console.log(`\nYour AWS server is booting up now!`);
  console.log(`It usually takes 3-4 minutes for the server to install Node.js, compile Next.js, and start.`);
  console.log(`\n🌐 URL: http://${publicIp}`);
  console.log('======================================================');
  
  // Cleanup zip locally
  fs.unlinkSync(zipName);
}

main().catch(console.error);
