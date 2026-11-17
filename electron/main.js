const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client, Authenticator } = require('minecraft-launcher-core');
const axios = require('axios');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const launcher = new Client();
let mainWindow;

// Ace Launcher veri klasörü (%appdata%/.ace-launcher)
const BASE_DIR = path.join(app.getPath('appData'), '.ace-launcher');
const PROFILES_FILE = path.join(BASE_DIR, 'profiles.json');

async function ensureDirs() {
  await fs.ensureDir(BASE_DIR);
  await fs.ensureDir(path.join(BASE_DIR, 'instances'));
  if (!(await fs.pathExists(PROFILES_FILE))) {
    await fs.writeJson(PROFILES_FILE, []);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    title: 'Ace Launcher',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await ensureDirs();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// Mojang resmi ana sürüm listesini çek
ipcMain.handle('get-versions', async () => {
  const res = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  return res.data.versions.filter((v) => v.type === 'release');
});

// Profilleri getir
ipcMain.handle('get-profiles', async () => {
  return await fs.readJson(PROFILES_FILE);
});

// Yeni profil oluştur
ipcMain.handle('create-profile', async (_, { name, version, loader, ram }) => {
  const profiles = await fs.readJson(PROFILES_FILE);
  const id = uuidv4();
  const gameDir = path.join(BASE_DIR, 'instances', id);
  await fs.ensureDir(gameDir);

  const newProfile = {
    id,
    name,
    version,
    loader: loader || 'vanilla',
    ram: ram || 4,
    gameDir,
    createdAt: new Date().toISOString(),
  };

  profiles.push(newProfile);
  await fs.writeJson(PROFILES_FILE, profiles, { spaces: 2 });
  return newProfile;
});

// Oyunu başlat (Aşama 1: Vanilla Offline)
ipcMain.handle('launch-game', async (_, { profile, username }) => {
  const opts = {
    authorization: Authenticator.getAuth(username || 'Player'),
    root: profile.gameDir,
    version: {
      number: profile.version,
      type: 'release',
    },
    memory: {
      max: `${profile.ram}G`,
      min: '1G',
    },
  };

  launcher.removeAllListeners('progress');
  launcher.removeAllListeners('data');
  launcher.removeAllListeners('close');

  launcher.on('progress', (e) => {
    mainWindow.webContents.send('launch-progress', e);
  });

  launcher.on('data', (e) => {
    mainWindow.webContents.send('launch-log', e);
  });

  launcher.on('close', (code) => {
    mainWindow.webContents.send('launch-close', code);
  });

  launcher.launch(opts);
  return { status: 'started' };
});
