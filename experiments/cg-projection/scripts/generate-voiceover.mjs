/** Official ElevenLabs CLI batch runner. Credentials stay inside the official CLI. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/voiceover');
const audioDir = path.join(root, 'public/audio/en');
const cli = process.env.HAMILTON_ELEVENLABS_CLI || 'elevenlabs';
const settings = { stability: .5, similarity_boost: .75, style: 0, speed: 1, use_speaker_boost: true };
const model = 'eleven_multilingual_v2';
const voices = JSON.parse(fs.readFileSync(path.join(dir, 'voice-map.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
// George only speaks source dialogue; UI copy must never enter generation or playback.
const playable = c => c.speaker !== 'narrator' || c.kind === 'dialogue';
const selected = manifest.cues.filter(c => c.chapter !== 'Demo' && voices[c.speaker] && playable(c));
const dynamicFile = path.join(dir, 'dynamic-variants.json');
const dynamic = fs.existsSync(dynamicFile) ? JSON.parse(fs.readFileSync(dynamicFile, 'utf8')).cues.filter(playable) : [];
const source = [...selected.filter(c => !c.dynamic), ...dynamic];
const jobs = new Map();
const links = [];
for (const cue of source) {
  const voice = voices[cue.speaker];
  if (!voice?.voice_id || !cue.text.en.trim() || /\{\d+\}/.test(cue.text.en)) throw Error(`Unresolved voice or text: ${cue.id}`);
  const request = {text:cue.text.en,model_id:model,voice_settings:settings};
  const signature = crypto.createHash('sha256').update(JSON.stringify({voice_id:voice.voice_id, output_format:'mp3_44100_128', ...request})).digest('hex');
  const filename = `${cue.speaker}-${signature.slice(0,20)}.mp3`;
  const cueRef={id:cue.id,templateId:cue.templateId,parameters:cue.parameters};
  if (jobs.has(filename)) jobs.get(filename).cues.push(cueRef);
  else jobs.set(filename,{filename,signature,speaker:cue.speaker,voiceName:voice.voice_name,voiceId:voice.voice_id,request,cues:[cueRef]});
  links.push({...cueRef,speaker:cue.speaker,chapter:cue.chapter,kind:cue.kind,text:cue.text,src:`/audio/en/${filename}`});
}
fs.mkdirSync(audioDir,{recursive:true});
const statusFile = path.join(dir,'generation-en-status.json');
const status = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile,'utf8')) : {schemaVersion:1, method:'official-elevenlabs-cli',files:{}};
function save(){fs.writeFileSync(statusFile+'.tmp',JSON.stringify(status,null,2)+'\n');fs.renameSync(statusFile+'.tmp',statusFile);}
function inspect(file){
  const info=spawnSync('/usr/bin/afinfo',[file],{encoding:'utf8'});
  const duration=Number(info.stdout?.match(/estimated duration:\s*([\d.]+)/)?.[1]);
  if(info.status!==0 || !duration || !info.stdout.includes('44100 Hz') || !info.stdout.includes('.mp3'))throw Error(`Invalid MP3: ${path.basename(file)}`);
  return {durationSeconds:duration,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
}
function complete(job,file,origin){status.files[job.filename]={status:'complete',signature:job.signature,voiceId:job.voiceId,voiceName:job.voiceName,speaker:job.speaker,origin,cues:job.cues,...inspect(file),completedAt:new Date().toISOString()};save();}
// Reuse the earlier user-requested Hamilton sample and the first George generation.
for(const [id,file] of [['opening-letter-base-3',path.join(dir,'samples/hamilton-opening-en-v1.mp3')],['opening-letter-base-1','/tmp/hamilton-george-pilot.mp3']]){
  const job=[...jobs.values()].find(j=>j.cues.some(c=>c.id===id));
  if(job && !status.files[job.filename] && fs.existsSync(file)){
    // Verify source text for the manually generated pilot; both settings and voice were verified at creation.
    const expected=id.endsWith('-3')?JSON.parse(fs.readFileSync(path.join(dir,'samples/hamilton-opening-en-v1.json'))).text.en:"He came from the Caribbean. A merchant's ledgers taught him to reckon; storms at sea taught him that a life could be rewritten overnight.";
    if(job.request.text!==expected)throw Error('Pilot transcript changed; cannot reuse');
    inspect(file);fs.copyFileSync(file,path.join(audioDir,job.filename));complete(job,path.join(audioDir,job.filename),'reused-approved-generation');
  }
}
function writeIfChanged(file, value){
  const content=JSON.stringify(value,null,2)+'\n';
  if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==content)fs.writeFileSync(file,content);
}
function writeIndex(){
  const output=links.map(c=>({...c,generated:status.files[path.basename(c.src)]?.status==='complete'}));
  writeIfChanged(path.join(audioDir,'manifest.json'),{schemaVersion:1,language:'en',model,voiceSettings:settings,cues:output});
  writeIfChanged(path.join(root,'src/data/voiceover-catalog.json'),output.map(c=>({id:c.id,speaker:c.speaker,text:c.text.en,src:c.src,generated:c.generated})));

}
const pending=[...jobs.values()].filter(j=>status.files[j.filename]?.status!=='complete');
for(const job of jobs.values()){
  const entry=status.files[job.filename];
  if(entry?.status==='complete'){
    const result=inspect(path.join(audioDir,job.filename));
    if(entry.signature!==job.signature || result.sha256!==entry.sha256)throw Error(`Cache mismatch: ${job.filename}`);
  }
}
writeIndex();
const plan={language:'en',model,method:'official-elevenlabs-cli',sourceCues:selected.length,fixedCues:selected.filter(c=>!c.dynamic).length,dynamicTemplates:selected.filter(c=>c.dynamic).map(c=>({id:c.id,text:c.text})),expandedDynamicCues:dynamic.length,uniqueAudioFiles:jobs.size,completed:jobs.size-pending.length,pending:pending.length,pendingCharacters:pending.reduce((s,j)=>s+j.request.text.length,0),bySpeaker:Object.fromEntries(Object.keys(voices).map(s=>[s,[...jobs.values()].filter(j=>j.speaker===s).length]))};
fs.writeFileSync(path.join(dir,'generation-en-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify(plan,null,2));
if(!process.argv.includes('--generate'))process.exit(0);
for(const j of pending){
 if(['running','uncertain'].includes(status.files[j.filename]?.status)||fs.existsSync(path.join(audioDir,j.filename+'.part')))throw Error(`Uncertain earlier request: ${j.filename}; inspect provider history before retrying.`);
}
let cursor=0,done=jobs.size-pending.length,stop=false;
const limitArg=process.argv.find(a=>a.startsWith('--limit='));
const limit=limitArg?Number(limitArg.split('=')[1]):pending.length;
if(!Number.isInteger(limit)||limit<0)throw Error('Invalid limit');
async function generate(job){
 const dest=path.join(audioDir,job.filename),part=dest+'.part';
 status.files[job.filename]={status:'running',signature:job.signature,voiceId:job.voiceId,speaker:job.speaker,cues:job.cues,startedAt:new Date().toISOString()};save();
 const args=['text-to-speech','convert','--voice-id',job.voiceId,'--output-format','mp3_44100_128','--json','-','--output',part,'--no-retry'];
 await new Promise((resolve,reject)=>{
  const child=spawn(cli,args,{cwd:root,env:{...process.env,ELEVENLABS_TIMEOUT_SECS:'90'},stdio:['pipe','pipe','pipe']});
  let stderr='';child.stderr.on('data',b=>{stderr+=b.toString();});child.stdout.on('data',()=>{});
  child.on('error',reject);child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(job.request));
  child.on('close',code=>code===0?resolve():reject(Error(`CLI exit ${code}: ${stderr.slice(0,1200)}`)));
 });
 inspect(part);fs.renameSync(part,dest);complete(job,dest,'official-elevenlabs-cli');
 console.log(`COMPLETE ${++done}/${jobs.size} ${job.speaker} ${job.cues[0].id}`);
}
async function worker(){
 while(!stop&&cursor<Math.min(pending.length,limit)){
  const job=pending[cursor++];
  try{await generate(job);}catch(error){stop=true;status.files[job.filename]={...status.files[job.filename],status:'uncertain',error:String(error),failedAt:new Date().toISOString()};save();console.error(`STOPPED ${job.filename}: ${error}`);}
 }
}
await Promise.all([worker(),worker()]);
writeIndex();
console.log(`Completed ${done}/${jobs.size}; total bytes ${Object.values(status.files).reduce((s,e)=>s+(e.bytes||0),0)}`);
if(stop)process.exitCode=1;
