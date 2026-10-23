const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.local-data/firmware-host');
const include=path.join(root,'.local-tools/arduino/user/libraries/ArduinoJson/src');
if(!fs.existsSync(path.join(include,'ArduinoJson.h')))throw new Error('Run scripts/setup-firmware-tools.ps1 before the host firmware tests.');
fs.mkdirSync(output,{recursive:true});
const binary=path.join(output,process.platform==='win32'?'core-driver.exe':'core-driver');
const compiler=process.env.HONEYCHAIN_HOST_CXX||(process.platform==='win32'?'C:/mingw64/bin/g++.exe':'g++');
const args=['-std=c++17','-O2','-Wall','-Wextra','-Werror','-I',include,'firmware/test/core-driver.cpp','firmware/HoneyChainHive/src/honeychain/core.cpp','-o',binary,
  ...(process.platform==='win32'?['-static','-lbcrypt']:['-lcrypto'])];
const result=spawnSync(compiler,args,{cwd:root,stdio:'inherit',windowsHide:true});
if(result.status!==0)process.exitCode=1;else console.log('Host firmware protocol driver compiled. No hardware was accessed.');
