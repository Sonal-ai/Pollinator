# Pollinator Architecture (AWS Native)

This project has been rebuilt from scratch to run natively on the AWS Cloud.

## Services Used:
- **AWS App Runner**: Hosts the Next.js full-stack application (both the Web Dashboard and the Next.js API Routes which serve as the WhatsApp Webhook).
- **Amazon Bedrock**: Powers the AI conversational logic, intent recognition, and translation. Replaces traditional 3rd-party LLM APIs with AWS-native models (e.g., Anthropic Claude 3 Haiku).
- **Amazon RDS (PostgreSQL)**: Serves as the primary relational database to store Beekeeper profiles and Honey Batch data, managed via Prisma.
- **Amazon ElastiCache (Redis)**: Manages the Finite State Machine (FSM) for the WhatsApp bot's conversational flow.

## Deployment Instructions (AWS App Runner)
1. Connect this GitHub repository to AWS App Runner.
2. Set the build command: \`npm run build\`
3. Set the start command: \`npm start\`
4. Provide the following environment variables in the App Runner console:
   - \`DATABASE_URL\` (pointing to your RDS instance)
   - \`REDIS_URL\` (pointing to your ElastiCache node)
   - \`WHATSAPP_VERIFY_TOKEN\`
   - \`WHATSAPP_APP_SECRET\`
   - \`WHATSAPP_PHONE_ID\`
   - \`WHATSAPP_ACCESS_TOKEN\`
5. Deploy and copy the resulting \`*.awsapprunner.com\` URL into your Meta App Dashboard as the Webhook URL.
