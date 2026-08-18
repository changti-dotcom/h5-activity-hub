// 記憶體陣列 + 落盤到 ~/.h5-data/*.json 的簡易共用資料層。
// 資料量小、流量低的內部工具用途，不需要真正的資料庫。
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.h5-data');
const SEED_DIR = path.join(__dirname, 'seed');

const FILES = {
  ideas: path.join(DATA_DIR, 'ideas.json'),
  activities: path.join(DATA_DIR, 'activities.json'),
};

const SEED_FILES = {
  ideas: path.join(SEED_DIR, 'ideas.seed.json'),
  activities: path.join(SEED_DIR, 'activities.seed.json'),
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadCollection(key) {
  ensureDataDir();
  if (!fs.existsSync(FILES[key])) {
    const seedPath = SEED_FILES[key];
    const seed = fs.existsSync(seedPath) ? fs.readFileSync(seedPath, 'utf8') : '[]';
    fs.writeFileSync(FILES[key], seed);
  }
  return JSON.parse(fs.readFileSync(FILES[key], 'utf8'));
}

function persist(key, list) {
  const tmpPath = FILES[key] + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(list, null, 2));
  fs.renameSync(tmpPath, FILES[key]);
}

const ideas = loadCollection('ideas');
const activities = loadCollection('activities');

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mergeOwnFields(record, data) {
  Object.keys(data).forEach((k) => {
    if (k === 'id') return;
    record[k] = data[k];
  });
  return record;
}

function addIdea(data) {
  const record = {
    id: genId('idea'),
    ideaType: 'h5',
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString(),
    ...data,
  };
  ideas.push(record);
  persist('ideas', ideas);
  return { success: true, id: record.id };
}

function updateIdea(id, data) {
  const record = ideas.find((x) => x.id === id);
  if (!record) return { success: false, error: 'idea not found' };
  mergeOwnFields(record, data);
  persist('ideas', ideas);
  return { success: true };
}

function deleteIdea(id) {
  const idx = ideas.findIndex((x) => x.id === id);
  if (idx === -1) return { success: false, error: 'idea not found' };
  ideas.splice(idx, 1);
  persist('ideas', ideas);
  return { success: true };
}

function addActivity(data) {
  const record = {
    id: genId('act'),
    status: 'published',
    createdAt: new Date().toISOString(),
    ...data,
  };
  activities.push(record);
  persist('activities', activities);
  return { success: true, id: record.id };
}

function updateActivity(id, data) {
  const record = activities.find((x) => x.id === id);
  if (!record) return { success: false, error: 'activity not found' };
  mergeOwnFields(record, data);
  persist('activities', activities);
  return { success: true };
}

module.exports = {
  getIdeas: () => ideas,
  getActivities: () => activities,
  addIdea,
  updateIdea,
  deleteIdea,
  addActivity,
  updateActivity,
};
