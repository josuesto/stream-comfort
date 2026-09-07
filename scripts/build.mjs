import {build} from 'esbuild';
import {mkdir, copyFile, writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

await mkdir('dist/icons', {recursive:true});
await build({entryPoints:{background:'src/background.ts',content:'src/content.ts',popup:'src/popup/popup.ts'},
  outdir:'dist',bundle:true,format:'iife',target:'chrome120',minify:false,legalComments:'none'});
await Promise.all([
  copyFile('manifest.json','dist/manifest.json'),
  copyFile('src/popup/popup.html','dist/popup.html'),
  copyFile('src/popup/popup.css','dist/popup.css'),
]);

// Original geometric icon, generated locally. No fonts or downloaded assets.
function crc32(buffer){let crc=0xffffffff;for(const b of buffer){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
for(const size of [16,32,48,128]){
  const pixels=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;const mark=(u>=.27&&u<=.62&&Math.abs(v-.5)<(u-.27)*.75)||(u>.66&&u<.74&&v>.27&&v<.73);
    const color=mark?[255,148,73]:[29,30,32];const off=y*(size*4+1)+1+x*4;
    pixels.set([...color,255],off);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  await writeFile(`dist/icons/${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
}
console.log('Built loadable extension in dist/');
