let index;
const ready = fetch(new URL('../../data/search-index.json', import.meta.url)).then(r => {
  if (!r.ok) throw new Error('Search index unavailable');
  return r.json();
}).then(data => { index=data; return data; });
const normalize = value => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
self.onmessage = async ({data:{query,id,groups}}) => {
  try {
    await ready;
    const tokens = normalize(query).split(' ').filter(Boolean).slice(0,12);
    if (!tokens.length) return postMessage({id,results:[],total:0});
    const candidateSets = tokens.map(token => {
      const ids = new Set(index.postings[token] || []);
      if (token.length >= 3) {
        for (const key of Object.keys(index.postings)) {
          if (key.startsWith(token)) for (const p of index.postings[key]) ids.add(p);
        }
      }
      return ids;
    });
    const candidates = [...candidateSets[0]].filter(i => candidateSets.every(set => set.has(i)));
    const results = candidates.map(i => {
      const page = index.pages[i], group = groups[page.groupId];
      const heading = page.headings.find(h => tokens.some(t => normalize(h).includes(t)));
      const titleHit = tokens.every(t => normalize(group.title).includes(t));
      const text = page.text;
      const lower = text.toLowerCase();
      const offsets = tokens.map(t => lower.indexOf(t)).filter(i=>i>=0);
      const start = offsets.length ? Math.max(0, Math.min(...offsets)-65) : 0;
      const excerpt = (start ? '…' : '') + text.slice(start,start+190) + (text.length>start+190 ? '…' : '');
      const score = (heading ? 35 : 0) + (titleHit ? 20 : 0) + (page.page===1 && titleHit ? 35 : 0)
        + tokens.reduce((sum,t)=>sum+Math.min(8,lower.split(t).length-1),0);
      return {...page, text:undefined, excerpt, heading, score};
    }).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
    postMessage({id, results:results.slice(0,80), total:results.length});
  } catch { postMessage({id,error:'Search is unavailable. Reconnect to download the search index.'}); }
};
