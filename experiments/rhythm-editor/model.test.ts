import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createProject, parseProject, serializeProject, exportFileName, changeNote, snapTime, conflicts, History, ProjectError, audioHash, decodeDataUrl, type Note} from './model';
import assets from './assets.json';
const {asset: _asset, ...audioMetadata} = assets['my-shot'];
const audio = {...audioMetadata, durationMs: 333154};
const project = () => createProject('my-shot', '6k', audio);
const note = (patch: Partial<Note> = {}): Note => ({id: 'n1', lane: 2, color: 'B', kind: 'hold', atMs: 1251, durationMs: 603, ...patch});
const rejected = (code: string, patch: (p: any) => void) => { const p = project(); p.notes = [note()]; patch(p); assert.throws(() => parseProject(p), (error: unknown) => error instanceof ProjectError && error.code === code); };
test('portable chart round-trip preserves millisecond timing, hold, independent color and keys', () => {
  const p = project(); p.notes = [note(), note({id:'n2', lane: 5, color:'A', kind:'tap', atMs:1854, durationMs:0})];
  const text = serializeProject(p); assert.equal(JSON.parse(text).notes[0].key, 'F'); assert.equal(JSON.parse(text).notes[1].key, 'L');
  assert.deepEqual(parseProject(text).project, p); assert.match(text, /"units": "milliseconds"/);
});
test('4k uses S D K L; 6k uses S D F J K L', () => { assert.deepEqual(createProject('helpless','4k',audio).keys,['S','D','K','L']); assert.deepEqual(project().keys,['S','D','F','J','K','L']); });
test('head nudging keeps exact integer milliseconds and hold duration', () => { const p = project(); let n = note(); for (let i = 0; i < 100; i++) n = changeNote(n,{atMs:n.atMs+1},p); assert.equal(n.atMs,1351); assert.equal(n.durationMs,603); assert.equal(note().atMs,1251); });
test('tap to hold supplies a usable duration; hold to tap clears duration', () => { const p = project(); const n = note({kind:'tap',durationMs:0}); assert.equal(changeNote(n,{kind:'hold'},p).durationMs,250); assert.equal(changeNote(note(),{kind:'tap'},p).durationMs,0); });
test('editing enforces song bounds, nonnegative hit times and valid lanes', () => { const p = project(); assert.equal(changeNote(note(),{atMs:-99},p).atMs,0); assert.equal(changeNote(note(),{lane:99},p).lane,5); const n = changeNote(note(),{atMs:999999},p); assert.equal(n.atMs+n.durationMs,p.audio.durationMs); });
test('optional grid snapping respects offset and subdivision; free timing remains exact', () => { const grid={bpm:120,offsetMs:125,division:8}; assert.equal(snapTime(394,grid,true),375); assert.equal(snapTime(394,grid,false),394); assert.equal(snapTime(-200,grid,true),0); });
test('undo and redo restore all properties and do not mutate earlier snapshots', () => { const p = project(); p.notes=[note()]; const h=new History(p); const edit=structuredClone(p); edit.notes[0].color='A'; edit.notes[0].atMs=1111; assert.equal(h.commit(edit),true); edit.notes[0].atMs=0; assert.equal(h.current.notes[0].atMs,1111); h.undo(); assert.deepEqual(h.current,p); h.redo(); assert.equal(h.current.notes[0].color,'A'); h.undo(); const branch=structuredClone(h.current); branch.notes=[]; h.commit(branch); assert.equal(h.canRedo,false); });
test('overlap detection handles enclosing holds and same-time taps, but accepts adjacent holds and different lanes', () => { const notes=[note(),note({id:'inside',atMs:1500,kind:'tap',durationMs:0}),note({id:'adjacent',atMs:1854,durationMs:100}),note({id:'other',lane:1,atMs:1251})]; assert.deepEqual([...conflicts(notes)].sort(),['inside','n1']); assert.equal(conflicts([note({kind:'tap',durationMs:0}),note({id:'same',kind:'tap',durationMs:0})]).size,2); });
test('reject unsupported versions and inconsistent key maps', () => { rejected('version',p=>p.version=2); rejected('keys',p=>p.keys=['D','F','J','K']); rejected('keys',p=>p.notes[0].key='L'); });
test('reject duplicate IDs, fractional milliseconds, invalid lanes, colors and hold lengths', () => { rejected('notes',p=>p.notes.push({...p.notes[0]})); rejected('notes',p=>p.notes[0].atMs=.1); rejected('notes',p=>p.notes[0].lane=6); rejected('notes',p=>p.notes[0].color='C'); rejected('notes',p=>p.notes[0].durationMs=0); rejected('notes',p=>p.notes[0].kind='burst'); });
test('reject notes beyond duration and tap notes with hold duration', () => { rejected('bounds',p=>p.notes[0].atMs=333000); rejected('notes',p=>p.notes[0].kind='tap'); });
test('reject invalid grid settings and non-finite numeric inputs', () => { rejected('grid',p=>p.grid.bpm=0); rejected('grid',p=>p.grid.offsetMs=NaN); rejected('grid',p=>p.grid.division=3); });
test('embedded audio round-trip is explicit and checksum can be independently verified', async () => { const bytes=new TextEncoder().encode('audio test').buffer; const hash=await audioHash(bytes); const dataUrl='data:audio/mpeg;base64,'+Buffer.from(bytes).toString('base64'); const p=project(); p.audio={...p.audio,sha256:hash,byteLength:bytes.byteLength}; const result=parseProject(serializeProject(p,dataUrl)); assert.equal(await audioHash(decodeDataUrl(result.embeddedAudio!)),hash); assert.equal('dataUrl' in result.project.audio,false); });
test('project import only accepts embedded audio data, not executable or external URLs', () => { rejected('audio',p=>p.audio.dataUrl='https://example.com/audio.mp3'); rejected('audio',p=>p.audio.dataUrl='data:text/html;base64,PHNjcmlwdD4='); rejected('audio',p=>p.audio.sha256='unverified'); });
test('bundled vocal audio metadata matches exact bytes on disk', () => { for (const asset of Object.values(assets)) { const bytes=readFileSync(new URL('./public/'+asset.asset,import.meta.url)); assert.equal(bytes.length,asset.byteLength); assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256); } });

test('hold tail edits clamp duration without shifting its hit time', () => { const p=project(); const n=changeNote(note(),{durationMs:999999},p); assert.equal(n.atMs,1251); assert.equal(n.durationMs,333154-1251); });

test('returned JSON retains optional charter and is compatible with older projects', () => {
  const p=project(); p.author='Alice 张'; p.notes=[note()];
  const parsed=parseProject(serializeProject(p)).project;
  assert.equal(parsed.author,'Alice 张'); assert.deepEqual(parsed.notes,p.notes);
  assert.equal(parseProject(serializeProject(project())).project.author,undefined);
  assert.equal(exportFileName(p),'My Shot-6k-Alice 张.hamchart.json');
  rejected('format',p=>p.author=42); rejected('format',p=>p.author='a'.repeat(81));
});
test('shareable filename is bounded and strips filesystem separators', () => {
  const p=project();p.name='../Demo:/?*';p.author='A/B\\C';
  assert.equal(exportFileName(p),'Demo-6k-ABC.hamchart.json');p.name='x'.repeat(200);p.author='a'.repeat(80);assert.ok(exportFileName(p).length<160);
});
