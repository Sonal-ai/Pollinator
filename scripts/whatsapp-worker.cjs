require('dotenv').config({path:process.env.POLLINATOR_ENV_FILE||'.env',quiet:true});
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'}});
require('../src/workers/whatsapp.ts');
