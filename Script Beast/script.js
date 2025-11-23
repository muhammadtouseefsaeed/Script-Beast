// Helper functions
function splitScenes(text){
  return text.split(/\n\s*\n|(?=^Scene\b)/im).map(s=>s.trim()).filter(Boolean);
}

function summarizeTitle(script){
  const lines = script.split(/\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return 'Untitled Script';
  const first = lines[0].slice(0,70);
  return first + (first.length<60 ? ' — A short visual story' : '');
}

function extractKeywords(script, limit=8){
  const stop = new Set(['the','a','an','and','or','to','of','in','on','with','that','is','are','it','he','she','they','we','i','you','as','for','by','at','from','this','then','but']);
  const words = script.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>!stop.has(w) && w.length>2);
  const freq = {};
  words.forEach(w=>freq[w]=(freq[w]||0)+1);
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(a=>a[0]);
}

function makeHashtags(keywords){
  return keywords.map(k=>'#'+k.replace(/[^a-z0-9]/gi,'')).slice(0,10);
}

function detectMood(text){
  if(/sad|lonely|dark|cold|angry|tense|scared|fear|sorrow|gloom/i.test(text)) return 'somber, moody';
  if(/happy|joy|celebrate|excited|bright|hope/i.test(text)) return 'bright, hopeful';
  return 'dramatic, cinematic';
}

function makeScenePrompts(sceneText, idx){
  const sentences = sceneText.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  const core = sentences[0] || sceneText.slice(0,120);
  const kw = extractKeywords(sceneText,6);
  const mood = detectMood(sceneText);
  const imagePrompt = `${core} — detailed, cinematic, ${mood}. Include ${kw.slice(0,4).join(', ')}. Ultra-detailed, photorealistic, 4k, cinematic lighting`;
  const visualPrompt = `Scene ${idx+1}: camera: wide-angle; lens: 35mm; framing: rule-of-thirds; movement: smooth tracking; mood: ${mood}; color grade: teal & orange`;
  return {imagePrompt, visualPrompt};
}

function makeVoiceoverForScene(sceneText, idx){
  const s = sceneText.replace(/\n+/g,' ').trim();
  const short = s.split(/(?<=[.!?])\s+/)[0] || s.slice(0,120);
  return `Scene ${idx+1} — ${short}\n\n(VO suggestion: Calm, clear pace. Duration: 8-18s)`;
}

// UI Actions
const scriptInput = document.getElementById('scriptInput');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const titleArea = document.getElementById('titleArea');
const keywordsArea = document.getElementById('keywordsArea');
const voiceArea = document.getElementById('voiceArea');
const scenesList = document.getElementById('scenesList');
const copyVoice = document.getElementById('copyVoice');
const downloadJson = document.getElementById('downloadJson');

function escapeHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function copyText(text){
  navigator.clipboard.writeText(text).then(()=>alert('Copied!')).catch(()=>alert('Copy failed'));
}
window.copyText = copyText;

function generateAll(){
  const text = scriptInput.value.trim();
  if(!text){alert('Please paste your script first.');return}
  const scenes = splitScenes(text);
  const title = summarizeTitle(text);
  const keywords = extractKeywords(text,10);
  const hashtags = makeHashtags(keywords);

  let voiceFull = '';
  const scenesData = scenes.map((s,i)=>{
    const prompts = makeScenePrompts(s,i);
    const vo = makeVoiceoverForScene(s,i);
    voiceFull += vo + "\n\n";
    return {index:i+1, text:s, imagePrompt:prompts.imagePrompt, visualPrompt:prompts.visualPrompt, voice:vo};
  });

  // Render Title
  titleArea.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><h3 style="margin:0">${escapeHtml(title)}</h3><button class="copy-btn" onclick='copyText(${JSON.stringify(title)})'>Copy</button></div>`;

  // Render keywords
  keywordsArea.innerHTML = '';
  keywords.forEach(k=>{
    const el = document.createElement('div');
    el.className='chip'; el.textContent=k;
    keywordsArea.appendChild(el);
  });
  const tagsEl = document.createElement('div');
  tagsEl.className='small'; tagsEl.style.marginTop='8px';
  tagsEl.textContent = hashtags.join(' ');
  keywordsArea.appendChild(tagsEl);

  // Render voice
  voiceArea.textContent = voiceFull.trim();

  // Render scenes
  scenesList.innerHTML = '';
  scenesData.forEach(s=>{
    const div = document.createElement('div'); div.className='scene';
    div.innerHTML = `<strong>Scene ${s.index}</strong>
      <div class="small" style="margin-top:6px;margin-bottom:6px">Preview text: ${escapeHtml(s.text.slice(0,180))}${s.text.length>180? '...':''}</div>
      <div style="display:flex;gap:8px;margin-bottom:6px"><button class="copy-btn" onclick='copyText(${JSON.stringify(s.imagePrompt)})'>Copy Image Prompt</button><button class="copy-btn" onclick='copyText(${JSON.stringify(s.visualPrompt)})'>Copy Visual Prompt</button></div>
      <div class="small">Image Prompt:</div><div style="margin-top:6px;white-space:pre-wrap">${escapeHtml(s.imagePrompt)}</div>
      <div class="small" style="margin-top:8px">Visual Prompt:</div><div style="margin-top:6px;white-space:pre-wrap">${escapeHtml(s.visualPrompt)}</div>
      <div class="small" style="margin-top:8px">Voiceover:</div><div style="margin-top:6px;white-space:pre-wrap">${escapeHtml(s.voice)}</div>`;
    scenesList.appendChild(div);
  });

  downloadJson.dataset.payload = JSON.stringify({title,keywords,hashtags,voice:voiceFull,scenes:scenesData},null,2);
}

processBtn.addEventListener('click',()=>generateAll());
clearBtn.addEventListener('click',()=>{
  scriptInput.value=''; titleArea.innerHTML=''; keywordsArea.innerHTML=''; voiceArea.textContent=''; scenesList.innerHTML=''; downloadJson.removeAttribute('data-payload');
});
copyVoice.addEventListener('click',()=>copyText(voiceArea.textContent));
downloadJson.addEventListener('click',()=>{
  const payload = downloadJson.dataset.payload;
  if(!payload){alert('Nothing to download — generate first.'); return;}
  const blob = new Blob([payload],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='scriptbeast-output.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Ctrl+Enter to generate
scriptInput.addEventListener('keydown', e=>{if(e.ctrlKey && e.key==='Enter'){generateAll()}});
