// 同源提供靜態網頁 + /api，取代原本每個瀏覽器各自存 localStorage 的示範模式。
// 前端 js/api.js 已經內建這個合約（GET ?type=ideas|activities，POST {action, data}），
// 這裡只要照著實作對應的 action 就好，前端完全不用改。
const path = require('path');
const express = require('express');
const store = require('./store');

const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.text({ type: () => true, limit: '5mb' }));

app.all('/api', (req, res) => {
  if (req.method === 'GET') {
    const type = req.query.type;
    if (type === 'ideas') return res.json(store.getIdeas());
    if (type === 'activities') return res.json(store.getActivities());
    return res.status(400).json({ success: false, error: 'unknown type' });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = JSON.parse(req.body || '{}');
    } catch (e) {
      return res.status(400).json({ success: false, error: 'invalid JSON body' });
    }
    const { action, data } = body;
    switch (action) {
      case 'addIdea':
        return res.json(store.addIdea(data));
      case 'updateIdea':
        return res.json(store.updateIdea(data.id, data));
      case 'deleteIdea':
        return res.json(store.deleteIdea(data.id));
      case 'addActivity':
        return res.json(store.addActivity(data));
      case 'updateActivity':
        return res.json(store.updateActivity(data.id, data));
      default:
        return res.status(400).json({ success: false, error: 'unknown action: ' + action });
    }
  }

  res.status(405).end();
});

app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`h5-idea-hub server listening on port ${PORT}`);
});
