import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { composeFor, id, options, reportError, root } from './operations.mjs';

async function main() {
  const opts = options(process.argv.slice(2));
  const compose = await composeFor(opts['env-file'], { overrides: ['deploy/compose.verify.yaml'] });
  if (!/^(nepomiluu|portfolio)-(infra-check|restore-test)[a-z0-9-]*$/.test(compose.config.name)) throw new Error('Use an explicitly isolated infra-check or restore-test Compose project');
  for (const service of ['mongo', 'api', 'web', 'nginx']) if (compose.config.services[service].ports?.length) throw new Error(`Smoke must not publish host ports: ${service}`);
  await compose.exec(['up', '-d', '--no-build', '--wait', 'mongo', 'api', 'web', 'nginx'], { timeout: 300000 });
  const program = String.raw`
import assert from 'node:assert/strict';
import {request as httpsRequest} from 'node:https';
import {request as httpRequest} from 'node:http';
import {createRequire} from 'node:module';
const domain=process.argv[2]; const origin=process.argv[3];
const read=(path,{method='GET',tls=true}={})=>new Promise((resolve,reject)=>{
  const request=(tls?httpsRequest:httpRequest)({hostname:'nginx',port:tls?443:80,path,method,servername:domain,rejectUnauthorized:false,headers:{Host:domain},timeout:15000},response=>{
    let body='';response.setEncoding('utf8');response.on('data',chunk=>{body+=chunk;if(body.length>3000000)request.destroy(new Error('Response exceeds smoke limit'));});
    response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body}));response.on('error',reject);
  });request.on('error',reject);request.on('timeout',()=>request.destroy(new Error('Smoke HTTP timeout')));request.end();
});
assert.equal((await read('/nginx-health',{tls:false})).status,200);
const redirect=await read('/ru',{tls:false});assert.equal(redirect.status,308);assert.equal(redirect.headers.location,'https://'+domain+'/ru');
const pages=[];
for(const locale of ['ru','en']){const page=await read('/'+locale);assert.equal(page.status,200,'Home '+locale);assert.ok(page.body.includes('text/html')||page.body.includes('<html'));assert.ok(page.body.includes(origin+'/'+locale),'Runtime canonical '+locale);pages.push(page.body);}
assert.equal((await read('/admin')).status,200);
const nextAssets=new Set(pages.join('').match(/\/_next\/static\/[^"\s<>]+?\.(?:css|js)/g)||[]);assert.ok(nextAssets.size,'HTML must reference Next static assets');
for(const path of [...nextAssets].slice(0,4))assert.equal((await read(path)).status,200,'Standalone asset '+path);
const fonts=await read('/fonts/fonts.css');assert.equal(fonts.status,200);assert.ok(fonts.body.includes('@font-face'));
assert.equal((await read('/fonts/inter-normal-latin.woff2',{method:'HEAD'})).status,200);
assert.equal((await read('/assets/fomina-home.webp',{method:'HEAD'})).status,200);
const cv=await read('/Uliana_Nepomilueva_UX_UI_Product_Designer_CV.pdf',{method:'HEAD'});assert.equal(cv.status,200);assert.ok(cv.headers['content-type'].includes('application/pdf'));
const robots=await read('/robots.txt');assert.equal(robots.status,200);assert.ok(robots.body.includes('Sitemap: '+origin+'/sitemap.xml'),'Runtime robots origin');
const sitemap=await read('/sitemap.xml');assert.equal(sitemap.status,200);assert.ok(sitemap.body.includes(origin+'/ru'),'Runtime sitemap origin');assert.ok(!sitemap.body.includes(origin+'//'),'Single-slash metadata URLs');
assert.equal((await read('/api/internal/backup/lock')).status,404);
assert.equal((await read('/api/internal/revalidate')).status,404);
assert.equal((await read('/api/admin/session')).status,401);
const routesResponse=await read('/api/public/routes');assert.equal(routesResponse.status,200);const routes=JSON.parse(routesResponse.body);
const require=createRequire('/app/apps/api/package.json');const connection=await require('mongoose').createConnection(process.env.MONGODB_URI).asPromise();
let projects;let media;try{projects=await connection.db.collection('projects').find({},{projection:{slug:1,publishedSnapshot:1}}).toArray();media=await connection.db.collection('media').find({},{projection:{_id:1}}).toArray();}finally{await connection.close();}
assert.ok(routes.length,'Smoke requires at least one published project');
const publicMedia=new Set();const walk=value=>{if(!value||typeof value!=='object')return;if(typeof value.mediaId==='string'&&!value.mediaId.startsWith('builtin:'))publicMedia.add(value.mediaId);for(const child of Object.values(value))if(typeof child==='object')walk(child);};
for(const project of projects){if(project.publishedSnapshot){assert.ok(routes.some(route=>route.slug===project.slug));walk(project.publishedSnapshot);for(const locale of ['ru','en']){assert.equal((await read('/'+locale+'/projects/'+encodeURIComponent(project.slug))).status,200);assert.ok(sitemap.body.includes(origin+'/'+locale+'/projects/'+project.slug));}}else{assert.ok(!routes.some(route=>route.slug===project.slug));assert.ok(!sitemap.body.includes('/projects/'+project.slug));assert.equal((await read('/api/public/projects/'+encodeURIComponent(project.slug))).status,404);assert.equal((await read('/ru/projects/'+encodeURIComponent(project.slug))).status,404);}}
let privateMedia=0;for(const item of media){const visible=publicMedia.has(item._id);if(!visible)privateMedia++;for(const variant of ['thumb','page','full']){const response=await read('/api/media/'+encodeURIComponent(item._id)+'/'+variant,{method:'HEAD'});assert.equal(response.status,visible?200:404,'Media authorization '+item._id+'/'+variant);if(visible){assert.ok(response.headers['content-type'].startsWith('image/webp'));assert.ok(Number(response.headers['content-length'])>0);}}}
process.stdout.write(JSON.stringify({result:'passed',locales:['ru','en'],publishedProjects:routes.length,draftProjects:projects.length-routes.length,publicMedia:publicMedia.size,privateMedia,nextStaticAssets:nextAssets.size,https:true,selfSignedTestCertificateAccepted:true,hostPortsPublished:false,runtimeOrigin:origin,checks:['standalone static/public files','RU/EN and published cases','runtime canonical/robots/sitemap','HTTPS redirect','internal routes blocked','unauthenticated CMS rejected','draft routes and media hidden']}));
`;
  const result = JSON.parse(await compose.exec(['exec', '-T', 'api', 'node', '--input-type=module', '-', compose.config.services.nginx.environment.DOMAIN, compose.config.services.web.environment.PUBLIC_ORIGIN.replace(/\/$/, '')], { input: program, timeout: 180000 }));
  const output = resolve(opts['output-dir'] || join(root, '.data', `production-smoke-${id()}`));
  await mkdir(output, { recursive: true });
  const report = { ...result, verifiedAt: new Date().toISOString(), project: compose.config.name, images: JSON.parse(await compose.exec(['images', '--format', 'json'])).map(image => ({ container: image.ContainerName, imageId: image.ID })) };
  const path = join(output, 'verification.json');
  await writeFile(path, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ ...report, report: path }, null, 2));
}
main().catch(reportError);
