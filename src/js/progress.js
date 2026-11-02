export const STORAGE_KEY = 'pilot-path-flight.reader.v1';
export const EMPTY = () => ({version:1, pages:{}, positions:{}, last:null, selected:'chapter-01'});
export function isCompleted(record) {
  return record?.manual === true || (record?.manual !== false && record?.auto === true);
}
export function completeAutomatically(state, pageId) {
  const previous = state.pages[pageId] || {};
  state.pages[pageId] = {...previous, auto:true};
}
export function setManual(state, pageId, completed) {
  state.pages[pageId] = {...(state.pages[pageId] || {}), manual:completed};
}
export function countCompleted(state, ids) {
  return ids.reduce((sum,id) => sum + Number(isCompleted(state.pages[id])), 0);
}
export class ProgressStore {
  constructor(onError=()=>{}) {
    this.onError = onError;
    this.state = EMPTY();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.version === 1 && saved.pages && saved.positions) {
        this.state = {...this.state,...saved};
      }
    } catch { onError('Reading history could not be loaded.'); }
  }
  save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state)); }
    catch { this.onError('Device storage is unavailable. Reading progress cannot be saved.'); }
  }
  auto(id) { completeAutomatically(this.state,id); this.save(); }
  manual(id,value) { setManual(this.state,id,value); this.save(); }
  position(groupId,page) {
    this.state.last = {groupId,page};
    this.state.positions[groupId] = page;
    this.state.selected = groupId;
    this.save();
  }
  count(ids) { return countCompleted(this.state,ids); }
  completed(id) { return isCompleted(this.state.pages[id]); }
}
