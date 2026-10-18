const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据目录
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// 数据文件路径
const dataFile = path.join(dataDir, 'shrimp-data.json');

// 默认配方
const defaultRecipes = [
  '丁酸', '驱虫', '芽孢乳', '虾青素', '护肝散', '多维肽', '宝甘灵', '红顶利生',
  '天科(矿)', '利生倍见', '蒜你牛', '活力壮', '快吃猛长', '胆汁酸', '黄金膏', '酵多钙'
].map((name, i) => ({ name, unit: '斤', dose: '', baseQty: '', baseUnit: '斤', sortOrder: i }));

// 默认设置
const defaultSettings = {
  maxShed: 32,
  groupLocation: ''
};

// 加载数据
function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      const data = JSON.parse(raw);
      return {
        records: data.records || [],
        recipes: data.recipes && data.recipes.length ? data.recipes : defaultRecipes,
        settings: { ...defaultSettings, ...(data.settings || {}) },
        lastUpdate: data.lastUpdate || Date.now()
      };
    }
  } catch (e) {
    console.error('加载数据失败:', e.message);
  }
  return {
    records: [],
    recipes: JSON.parse(JSON.stringify(defaultRecipes)),
    settings: { ...defaultSettings },
    lastUpdate: Date.now()
  };
}

// 保存数据（带文件锁，防止并发写入损坏）
let saveQueue = Promise.resolve();
function saveData(data) {
  data.lastUpdate = Date.now();
  saveQueue = saveQueue.then(() => {
    return new Promise((resolve, reject) => {
      const tmpFile = dataFile + '.tmp';
      fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8', err => {
        if (err) return reject(err);
        fs.rename(tmpFile, dataFile, err => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }).catch(err => {
    console.error('保存数据失败:', err.message);
  });
  return saveQueue.then(() => data.lastUpdate);
}

// 当前内存中的数据
let db = loadData();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 获取最新更新时间戳
app.get('/api/last-update', (req, res) => {
  res.json({ lastUpdate: db.lastUpdate });
});

// 获取全部数据（完整同步）
app.get('/api/sync', (req, res) => {
  res.json({
    records: db.records,
    recipes: db.recipes,
    settings: db.settings,
    lastUpdate: db.lastUpdate
  });
});

// 保存/批量更新记录（替换当天某棚的记录）
app.post('/api/records/save', async (req, res) => {
  const { records, date, shed, groupLocation, operator } = req.body;
  if (!date || !shed || !Array.isArray(records)) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const shedNum = Number(shed);
  const now = Date.now();

  // 删除该日该棚现有记录中不在新列表里的餐次
  const newMeals = new Set(records.map(r => Number(r.meal)));
  db.records = db.records.filter(r =>
    !(r.date === date && Number(r.shed) === shedNum && !newMeals.has(Number(r.meal)))
  );

  // 插入/更新新记录
  records.forEach(r => {
    if (!r.feedWeight || Number(r.feedWeight) <= 0) return;
    const idx = db.records.findIndex(x => x.date === date && Number(x.shed) === shedNum && Number(x.meal) === Number(r.meal));
    const record = {
      id: r.id || `${date}-${shedNum}-${r.meal}-${now}`,
      date,
      groupLocation: groupLocation || r.groupLocation || '',
      shed: shedNum,
      meal: Number(r.meal),
      feedWeight: Number(r.feedWeight),
      feedUnit: r.feedUnit || 'KG',
      weight: Number(r.weight),
      adds: r.adds || [],
      addDetails: r.addDetails || [],
      waterPercent: r.waterPercent || '',
      waterAmountJin: Number(r.waterAmountJin || 0),
      note: r.note || '',
      operator: operator || r.operator || '',
      operatedAt: now
    };
    if (idx >= 0) {
      db.records[idx] = record;
    } else {
      db.records.push(record);
    }
  });

  // 更新最大棚号
  if (shedNum > db.settings.maxShed) {
    db.settings.maxShed = shedNum;
  }

  // 更新位置
  if (groupLocation !== undefined) {
    db.settings.groupLocation = groupLocation;
  }

  const updatedAt = await saveData(db);
  res.json({ success: true, updatedAt });
});

// 删除单条记录
app.delete('/api/records/:id', async (req, res) => {
  const { id } = req.params;
  db.records = db.records.filter(r => r.id !== id);
  const updatedAt = await saveData(db);
  res.json({ success: true, updatedAt });
});

// 清空所有记录
app.delete('/api/records', async (req, res) => {
  db.records = [];
  const updatedAt = await saveData(db);
  res.json({ success: true, updatedAt });
});

// 保存配方
app.put('/api/recipes', async (req, res) => {
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) {
    return res.status(400).json({ error: '参数错误' });
  }
  db.recipes = recipes.map((r, i) => ({
    name: r.name,
    unit: r.unit || '斤',
    dose: r.dose ?? '',
    baseQty: r.baseQty ?? '',
    baseUnit: r.baseUnit || '斤',
    sortOrder: i
  }));
  const updatedAt = await saveData(db);
  res.json({ success: true, updatedAt });
});

// 保存设置
app.put('/api/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: '参数错误' });
  db.settings[key] = value;
  const updatedAt = await saveData(db);
  res.json({ success: true, updatedAt });
});

// 导出CSV
app.get('/api/export/csv', (req, res) => {
  const records = db.records.slice().sort((a, b) =>
    b.date.localeCompare(a.date) || Number(a.shed) - Number(b.shed) || Number(a.meal) - Number(b.meal)
  );
  if (!records.length) return res.status(404).json({ error: '暂无记录' });

  const header = '日期,棚所在位置,棚号,餐次,喂餐量,单位,折合KG,动保/水,备注,操作员,操作时间';
  const lines = records.map(r => {
    const adds = r.adds || [];
    const waterName = r.waterPercent ? `水${r.waterPercent}%` : '';
    const names = adds.concat(waterName ? [waterName] : []).join('；');
    const opTime = r.operatedAt ? new Date(r.operatedAt).toLocaleString('zh-CN') : '';
    return [r.date, r.groupLocation || '', r.shed, r.meal, r.feedWeight, r.feedUnit, r.weight, names, r.note || '', r.operator || '', opTime]
      .map(v => `"${String(v).replaceAll('"', '""')}"`).join(',');
  });

  const csv = '\ufeff' + [header].concat(lines).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="养虾投喂记录_${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), records: db.records.length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ========================================
   虾多多 - 云端同步版已启动
   访问地址: http://localhost:${PORT}
   局域网访问: http://<你的IP>:${PORT}
   数据文件: ${dataFile}
  ========================================
  `);
});
