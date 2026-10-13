import fs from 'node:fs/promises';
const refs=JSON.parse(await fs.readFile(new URL('./asset-sources.json',import.meta.url),'utf8'));
await fs.mkdir(new URL('./public/assets/',import.meta.url),{recursive:true});
for(const [key,url] of Object.entries(refs)){const response=await fetch(url);if(!response.ok)throw new Error(`${key}: ${response.status}`);await fs.writeFile(new URL(`./public/assets/${key}.${url.split('.').pop()}`,import.meta.url),Buffer.from(await response.arrayBuffer()));}
console.log(`Downloaded ${Object.keys(refs).length} Figma assets`);
