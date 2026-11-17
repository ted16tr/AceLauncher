const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { Client, Authenticator } = require('minecraft-launcher-core');
const axios = require('axios');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const {
  getFabricVersions,
  getForgeVersions,
  installFabric,
  downloadForgeInstaller,
} = require('./services/modloaders');
const { searchModrinth, installModrinthProject } = require('./services/modrinth');
const { searchCurseForge, installCurseForgeProject } = require('./services/curseforge');

const launcher = new Client();
let mainWindow;

const BASE_DIR = path.join(app.getPath('appData'), '.ace-launcher');
const PROFILES_FILE = path.join(BASE_DIR, 'profiles.json');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');

async function ensureDirs() {
  await fs.ensureDir(BASE_DIR);
  await fs.ensureDir(path.join(BASE_DIR, 'instances'));
  if (!(await fs.pathExists(PROFILES_FILE))) {
    await fs.writeJson(PROFILES_FILE, []);
  }
  if (!(await fs.pathExists(CONFIG_FILE))) {
    await fs.writeJson(CONFIG_FILE, { curseforgeApiKey: '' });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 750,
    minWidth: 960,
    minHeight: 640,
    title: 'Ace Launcher',
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
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

// --- CONFIG & PROFILES ---

ipcMain.handle('get-config', async () => {
  return await fs.readJson(CONFIG_FILE);
});

ipcMain.handle('save-config', async (_, newConfig) => {
  const current = await fs.readJson(CONFIG_FILE);
  const updated = { ...current, ...newConfig };
  await fs.writeJson(CONFIG_FILE, updated, { spaces: 2 });
  return updated;
});

ipcMain.handle('get-versions', async () => {
  const res = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  return res.data.versions.filter((v) => v.type === 'release');
});

ipcMain.handle('get-loader-versions', async (_, { loader, mcVersion }) => {
  if (loader === 'fabric') return await getFabricVersions(mcVersion);
  if (loader === 'forge') return await getForgeVersions(mcVersion);
  return [];
});

ipcMain.handle('get-profiles', async () => {
  return await fs.readJson(PROFILES_FILE);
});

ipcMain.handle('create-profile', async (_, { name, version, loader, loaderVersion, ram }) => {
  const profiles = await fs.readJson(PROFILES_FILE);
  const id = uuidv4();
  const gameDir = path.join(BASE_DIR, 'instances', id);
  await fs.ensureDir(gameDir);

  const newProfile = {
    id,
    name,
    version,
    loader: loader || 'vanilla',
    loaderVersion: loaderVersion || null,
    ram: ram || 4,
    gameDir,
    createdAt: new Date().toISOString(),
  };

  profiles.push(newProfile);
  await fs.writeJson(PROFILES_FILE, profiles, { spaces: 2 });
  return newProfile;
});

ipcMain.handle('delete-profile', async (_, profileId) => {
  const profiles = await fs.readJson(PROFILES_FILE);
  const target = profiles.find((p) => p.id === profileId);
  if (target && (await fs.pathExists(target.gameDir))) {
    await fs.remove(target.gameDir);
  }
  const updated = profiles.filter((p) => p.id !== profileId);
  await fs.writeJson(PROFILES_FILE, updated, { spaces: 2 });
  return updated;
});

ipcMain.handle('open-profile-folder', async (_, gameDir) => {
  if (gameDir && (await fs.pathExists(gameDir))) {
    await shell.openPath(gameDir);
  }
});

// --- STORE (MODRINTH & CURSEFORGE) ---

ipcMain.handle('search-content', async (_, { platform, query, projectType, mcVersion, loader }) => {
  try {
    if (platform === 'modrinth') {
      const results = await searchModrinth({ query, projectType, mcVersion, loader });
      return { status: 'ok', results };
    } else if (platform === 'curseforge') {
      const config = await fs.readJson(CONFIG_FILE);
      const results = await searchCurseForge({
        apiKey: config.curseforgeApiKey,
        query,
        projectType,
        mcVersion,
        loader,
      });
      return { status: 'ok', results };
    }
    return { status: 'error', message: 'Geçersiz platform' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

ipcMain.handle('install-content', async (_, { platform, projectId, projectType, profile }) => {
  try {
    const onProgress = (msg) => {
      mainWindow.webContents.send('install-progress', msg);
    };

    if (platform === 'modrinth') {
      const message = await installModrinthProject({
        projectId,
        projectType,
        profile,
        onProgress,
      });
      return { status: 'ok', message };
    } else if (platform === 'curseforge') {
      const config = await fs.readJson(CONFIG_FILE);
      const message = await installCurseForgeProject({
        apiKey: config.curseforgeApiKey,
        projectId,
        projectType,
        profile,
        onProgress,
      });
      return { status: 'ok', message };
    }
    return { status: 'error', message: 'Geçersiz platform' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// --- LAUNCH GAME ---

ipcMain.handle('launch-game', async (_, { profile, username }) => {
  try {
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

    if (profile.loader === 'fabric' && profile.loaderVersion) {
      mainWindow.webContents.send('launch-status', 'Fabric yapılandırılıyor...');
      const customId = await installFabric(profile.gameDir, profile.version, profile.loaderVersion);
      opts.version.custom = customId;
    }

    if (profile.loader === 'forge' && profile.loaderVersion) {
      mainWindow.webContents.send('launch-status', 'Forge installer indiriliyor...');
      const forgeJarPath = await downloadForgeInstaller(profile.gameDir, profile.loaderVersion);
      opts.forge = forgeJarPath;
    }

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
  } catch (err) {
    mainWindow.webContents.send('launch-close', 1);
    return { status: 'error', message: err.message };
  }
});
