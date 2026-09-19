require('dotenv').config();
const { EC2Client, GetConsoleOutputCommand } = require('@aws-sdk/client-ec2');

const REGION = process.env.AWS_REGION || 'us-east-1';
const ec2 = new EC2Client({ region: REGION });

async function main() {
  const instanceId = 'i-018ad2efe1f036081'; // The latest instance
  console.log(`Fetching console output for ${instanceId}...`);
  try {
    const data = await ec2.send(new GetConsoleOutputCommand({ InstanceId: instanceId }));
    if (data.Output) {
      console.log(Buffer.from(data.Output, 'base64').toString('ascii'));
    } else {
      console.log('No output available yet.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
