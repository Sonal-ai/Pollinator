require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { EC2Client, RunInstancesCommand, DescribeInstancesCommand, AssociateAddressCommand, DescribeSecurityGroupsCommand, CreateSecurityGroupCommand, AuthorizeSecurityGroupIngressCommand } = require('@aws-sdk/client-ec2');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: REGION });
const ec2 = new EC2Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('🚀 Starting Final AWS Deployment for Pollinator...');

  // 1. Zip
  const zipName = 'deploy-final.zip';
  console.log('📦 Zipping codebase...');
  if (fs.existsSync(zipName)) fs.unlinkSync(zipName);
  execSync(`tar -a -cf "${zipName}" --exclude=node_modules --exclude=.git --exclude=.next --exclude=cache --exclude="*.zip" .`, { stdio: 'inherit' });
  
  // 2. Upload to S3
  const bucketName = 'pollinator-deploy-' + Date.now();
  console.log('☁️ Uploading to S3 bucket...');
  const { CreateBucketCommand } = require('@aws-sdk/client-s3');
  await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
  
  const zipData = fs.readFileSync(zipName);
  await s3.send(new PutObjectCommand({ Bucket: bucketName, Key: zipName, Body: zipData }));
  
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: zipName }), { expiresIn: 3600 });

  // 3. Setup SG
  console.log('🛡️ Creating Security Group...');
  const sgName = 'pollinator-sg-final-' + Date.now();
  const sgRes = await ec2.send(new CreateSecurityGroupCommand({ GroupName: sgName, Description: 'Pollinator SG' }));
  const groupId = sgRes.GroupId;
  await ec2.send(new AuthorizeSecurityGroupIngressCommand({
    GroupId: groupId,
    IpPermissions: [
      { IpProtocol: 'tcp', FromPort: 80, ToPort: 80, IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
      { IpProtocol: 'tcp', FromPort: 443, ToPort: 443, IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
      { IpProtocol: 'tcp', FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: '0.0.0.0/0' }] }
    ]
  }));

  // 4. UserData (Docker + Postgres + Redis + Node 22 + Nginx)
  const envContent = fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.trim() && !l.startsWith('#')).join('\n') + '\n';
  const envB64 = Buffer.from(envContent).toString('base64');

  const userData = `#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "Starting final deploy..."
yum update -y || true
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs unzip docker

systemctl enable docker
systemctl start docker
curl -SL https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

mkdir -p /app
cd /app
curl -o deploy.zip "${getUrl}"
unzip -o deploy.zip

echo "${envB64}" | base64 -d > .env

# Dynamically add the instance's nip.io domain to .env for QR generation
echo -e "\\nNEXT_PUBLIC_APP_URL=\\"https://100.24.80.15.nip.io\\"" >> .env

echo "Starting Docker DBs..."
/usr/local/bin/docker-compose up -d
sleep 15

npm install --legacy-peer-deps 2>&1
npx prisma generate 2>&1
npx prisma db push --accept-data-loss 2>&1 || true
node seed.js 2>&1 || true

fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

npm run build 2>&1
npm install -g pm2 localtunnel
PORT=3000 pm2 start npm --name "pollinator" -- start
pm2 save
pm2 startup 2>&1 || true

yum install -y nginx python3 augeas-libs
cat > /etc/nginx/conf.d/pollinator.conf << 'EOF'
server {
    listen 80 default_server;
    server_name 100.24.80.15.sslip.io 100.24.80.15 localhost;
    client_max_body_size 50M;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
EOF
rm -f /etc/nginx/conf.d/default.conf || true
systemctl enable nginx
systemctl start nginx

echo "Setting up SSL with Certbot and sslip.io..."
python3 -m venv /opt/certbot/
/opt/certbot/bin/pip install --upgrade pip
/opt/certbot/bin/pip install certbot certbot-nginx
ln -sf /opt/certbot/bin/certbot /usr/bin/certbot

# Request genuine Let's Encrypt SSL certificate for sslip.io domain
certbot --nginx -d 100.24.80.15.sslip.io --non-interactive --agree-tos -m sonalkhanak@gmail.com --redirect || echo "Certbot failed, continuing..."

echo "Starting Cloudflare quick tunnel as backup..."
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm -o cloudflared.rpm
rpm -i cloudflared.rpm || true
nohup cloudflared tunnel --url http://127.0.0.1:80 > /var/log/cloudflared.log 2>&1 &

echo "DEPLOYMENT COMPLETE!"
`;

  // 5. AMI & Launch
  const amiRes = await ssm.send(new GetParameterCommand({ Name: '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64' }));
  const AMI_ID = amiRes.Parameter.Value;

  console.log('🖥️ Launching EC2 Instance with SSH Key...');
  const runRes = await ec2.send(new RunInstancesCommand({
    ImageId: AMI_ID, InstanceType: 't3.small', MinCount: 1, MaxCount: 1,
    KeyName: 'pollinator-key',
    SecurityGroupIds: [groupId],
    UserData: Buffer.from(userData).toString('base64')
  }));
  
  const instanceId = runRes.Instances[0].InstanceId;
  console.log(`✅ EC2 Instance launched! ID: ${instanceId}`);
  
  console.log('⏳ Attaching Static Elastic IP...');
  await sleep(6000); // let instance initialize
  
  await ec2.send(new AssociateAddressCommand({ 
    AllocationId: 'eipalloc-06fa689f83b374c2c', // The EIP we allocated earlier (100.24.80.15)
    InstanceId: instanceId,
    AllowReassociation: true
  }));
  
  console.log(`✅ Static IP 100.24.80.15 successfully attached!`);
  
  if (fs.existsSync(zipName)) fs.unlinkSync(zipName);
  
  console.log('\\n🚀 You are fully live! URL: http://100.24.80.15');
}

main().catch(console.error);
