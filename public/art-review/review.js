const names={hamilton:['汉密尔顿','ALEXANDER HAMILTON'],burr:['伯尔','AARON BURR'],washington:['华盛顿','GEORGE WASHINGTON'],laurens:['劳伦斯','JOHN LAURENS'],lafayette:['拉法耶特','MARQUIS DE LAFAYETTE'],mulligan:['穆利根','HERCULES MULLIGAN'],loyalist:['保皇派撰稿人','LOYALIST'],newsboy:['报童','NEWSBOY'],citizen:['市民','CITIZEN'],revolutionary:['革命群众','REVOLUTIONARY'],soldier:['大陆军士兵','SOLDIER']};
const scenes={opening:['海的另一边','OPENING / ATLANTIC'],arrival:['纽约街头与港口','ARRIVAL / NEW YORK'],tavern:['酒馆','TAVERN'],debate:['公开辩论广场','PUBLIC DEBATE'],washington:['总司令的军营','WASHINGTON / HEADQUARTERS'],yorktown:['约克镇','YORKTOWN / 1781']};
const descriptions={portraits:['对话中的人','基于原卡剧照的服装、发型与部分肖像线索，转换为写实动画人物。所有角色保持相近的半身构图和柔和主光，方便并排比较。',['A · 电影动画式写实','B · 细腻绘画动画','C · 轮廓与色面写实']],backgrounds:['走进真实环境','六个剧情场景各三种生成方向：船甲板、殖民地街巷、酒馆、广场、军营与约克镇。场景使用自然环境构图，预留横向行走和对白的空间。',['A · 电影动画式环境','B · 历史绘景与笔触','C · 大形体绘画写实']],sprites:['小人物，也有性格','保留简洁色块与留白面孔，通过束发、帽子、翻领、长衣摆、背心、袖口和军装配件识别角色。SVG 为可编辑源素材。',['A · 纯色剪影','B · 细线衣褶','C · 清晰轮廓']],references:['原卡剧照参考','以下是本次制作实际查看的剧照来源与人物辨识依据。剧照用于美术参考，生成素材另存为独立文件。',[]]};
let manifest={portraits:[],portraitDrafts:[],backgrounds:[],sprites:[],references:[]};
let current=new URLSearchParams(location.search).get('tab')||'portraits';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node};
const lightbox=document.querySelector('#lightbox');
lightbox.querySelector('.close').onclick=()=>lightbox.close();
lightbox.onclick=(event)=>{if(event.target===lightbox)lightbox.close()};
function showImage(asset,label){const img=lightbox.querySelector('img');img.src=asset.path;img.alt=label;lightbox.querySelector('p').textContent=label;const link=lightbox.querySelector('a');link.href=asset.path;lightbox.showModal()}
function render(){
 if(!descriptions[current])current='portraits';
 document.querySelectorAll('nav button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===current)));
 const [title,copy,directions]=descriptions[current];
 const intro=document.querySelector('#intro');intro.replaceChildren(el('h2','',title),el('p','',copy));const dir=el('div','directions');directions.forEach(text=>dir.append(el('span','',text)));intro.append(dir);
 const gallery=document.querySelector('#gallery');gallery.replaceChildren();
 if(current==='references'){
   const group=el('section','group reference-grid');
   manifest.references.forEach(reference=>{const node=el('article');const image=el('img');image.src=reference.path;image.alt=reference.title;image.loading='lazy';node.append(image,el('h3','',reference.title),el('p','',reference.description));const link=el('a','',reference.sourceLabel||'查看原始来源 ↗');link.href=reference.source;link.target='_blank';link.rel='noopener';node.append(link);group.append(node)});gallery.append(group);return;
 }
 const assets=current==='portraits'?[...manifest.portraits,...(manifest.portraitDrafts||[])]:manifest[current]||[];const key=current==='backgrounds'?'scene':'character';const order=current==='backgrounds'?scenes:names;
 if(current==='portraits'&&manifest.portraits.length<33)intro.append(el('p','status-note',`当前 ${manifest.portraits.length} 张完稿、${manifest.portraitDrafts?.length||0} 张人物草稿。草稿带有合并的棋盘格背景，供比较人物造型；尚未达到可直接接入游戏的标准。目标为 33 张完稿。`));
 if(current==='backgrounds'&&manifest.backgrounds.length<18)intro.append(el('p','status-note',`当前完成 ${manifest.backgrounds.length} / 18 张。内置图片生成额度已用尽，其余方案的提示词已保留。`));
 if(!assets.length){gallery.append(el('p','empty','本组素材正在生成。完成后将出现在这里。'));return}
 for(const [id,[name,en]]of Object.entries(order)){
   const selected=assets.filter(asset=>asset[key]?.toLowerCase()===id).sort((a,b)=>a.variant.localeCompare(b.variant));if(!selected.length)continue;
   const group=el('section','group');group.id=id;const head=el('div','group-head');head.append(el('h2','',name),el('span','',en));group.append(head);
   const variants=el('div','variants');selected.forEach(asset=>{const figure=el('figure','asset');const preview=el('button',`asset-preview ${current}`);preview.setAttribute('aria-label',`放大 ${name} ${asset.variant.toUpperCase()}`);const image=el('img');image.src=asset.path;image.alt=`${name} · ${asset.variant.toUpperCase()} · ${asset.style}`;image.loading='lazy';preview.append(image);preview.onclick=()=>showImage(asset,image.alt);const caption=el('figcaption');const top=el('div','caption-top');const h3=el('h3');h3.append(el('span','variant',asset.variant.toUpperCase()),document.createTextNode(asset.style||asset.title));const original=el('a','','原文件 ↗');original.href=asset.path;original.target='_blank';original.rel='noopener';top.append(h3,original);caption.append(top);if(asset.description)caption.append(el('p','',asset.description));const meta=[asset.width&&asset.height?`${asset.width} × ${asset.height}`:'',asset.alpha===true?'ALPHA / 透明':asset.alpha===false?'RGB / 背景合并':'',asset.format?.toUpperCase()].filter(Boolean).join(' · ');caption.append(el('p','meta',meta));figure.append(preview,caption);variants.append(figure)});group.append(variants);gallery.append(group);
 }
}
document.querySelectorAll('nav button').forEach(button=>button.onclick=()=>{current=button.dataset.tab;history.replaceState(null,'',`?tab=${current}`);render()});
try{const response=await fetch('/art/manifest.json');if(!response.ok)throw new Error('manifest');manifest=await response.json();for(const group of ['portraits','backgrounds','sprites'])document.querySelector(`#${group}-count`).textContent=group==='portraits'?`${manifest.portraits.length} + ${manifest.portraitDrafts?.length||0} 草稿`:manifest[group].length;render()}catch{document.querySelector('#gallery').append(el('p','empty','素材清单尚未完成。请稍后刷新。'))}
