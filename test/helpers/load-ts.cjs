const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
module.exports=function loadTs(file,mocks={}) {
 const filename=path.resolve(file),unit=new Module(filename,module);unit.filename=filename;unit.paths=Module._nodeModulePaths(path.dirname(filename));
 unit.require=function(specifier){if(Object.hasOwn(mocks,specifier))return mocks[specifier];return Module.prototype.require.call(this,specifier);};
 unit._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
 return unit.exports;
};
