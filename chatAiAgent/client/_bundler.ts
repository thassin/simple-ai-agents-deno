
// 20250710 need this for "Deno.xx" functions:
/// <reference lib="deno.ns" />

// https://deno.land/x/esbuild@v0.24.2 
// https://jsr.io/@luca/esbuild-deno-loader 

// the parameters in "buildOptions" are described here:
// https://github.com/esbuild/deno-esbuild/blob/v0.24.2/mod.d.ts 

// about formats: "esm" vs "iife":
// https://esbuild.github.io/faq/#top-level-name-collisions 

import * as esbuild from "https://deno.land/x/esbuild@v0.24.2/mod.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.1";



async function copyFile(fromPath: string, toPath: string): Promise<void> {
  try {
    await Deno.copyFile(fromPath, toPath);
  } catch ( error ) {
    let message = "Unknown Error";
    if (error instanceof Error) message = error.message;
    console.log("file copy failed: " + message);
    return;
  }
  console.log("file copy OK: " + toPath);
}



console.log("BUILD-starting");

const platform: esbuild.Platform = "browser";

const format: esbuild.Format = "esm"; // tee kirjastosta moduuli.

//const format: esbuild.Format = "iife"; // tee kirjastosta perinteinen skripti.
//const globalName: string = "myModule"; // aseta VAIN "iife" formaatille.

const buildOptions: esbuild.BuildOptions = {
  plugins: [ ...denoPlugins() ],
  outdir: "../server/html_in",
  bundle: true,
  platform: platform,

  format: format,
  //globalName: globalName,

  entryPoints: [ "./src/client.ts" ],

  target: "esnext",
  minify: true,
  sourcemap: false,
  treeShaking: true,
};

await esbuild.build(buildOptions);

console.log("BUILD-completed");

await esbuild.stop();

// "esm" -formaatissa useampikin entryPoint ilmeisesti OK?!?
// "iife" -formaatissa kaikille tulee sama globalName mikä jonkinverran ongelma.
// => tarvittaessa kirjastojen globaalinimiä voi vaihtaa jälkikäteen tähän tapaan:
if ( buildOptions.format === "iife" ) {
	const newName = "myAnotherModule"
	console.log( "change another_library.js globalName: " + globalName + " => " + newName );
	try {
		const jsFilePath = "./wwwroot/another_library.js";
		const txt1 = await Deno.readTextFile( jsFilePath );
		
		const find = "var " + globalName + " = (() => {";
		const replace = "var " + newName + " = (() => {";
		
		const txt2 = txt1.replace( find, replace );
		if ( txt1 === txt2 ) throw new Error( "find and replace failed" );
		
		await Deno.writeTextFile( jsFilePath, txt2 );
	} catch ( e ) {
		let msg = "unknown error";
		if ( e instanceof Error ) msg = e.message;
		console.log( "ERROR: " + msg );
		Deno.exit( 1 );
	}
}



// copy the duplicate target files.
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// => HUOM!!! näin pitäs toimia oikein vaikka copyFile() on async.
// => ÄLÄ lähde tekemään .then()/.catch() vaan aina käytä try/catch mieluummin!!!
// https://stackoverflow.com/questions/77761587/marking-a-try-catch-as-async-in-typescript-javascript 

//await copyFile("./some/sourcefile.js", "../another/dir/targetfile.js");



console.log("BUILD-exiting");

