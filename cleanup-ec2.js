require('dotenv').config();
const { EC2Client, TerminateInstancesCommand } = require('@aws-sdk/client-ec2');
const REGION = process.env.AWS_REGION || 'us-east-1';
const ec2 = new EC2Client({ region: REGION });

async function main() {
  const instanceId = 'i-0fc86390e91f5d8e6';
  console.log(`Terminating old instance ${instanceId}...`);
  await ec2.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
  console.log('Terminated!');
}
main();
