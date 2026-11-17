const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

const API_BASE = 'https://api.modrinth.com/v2';
const HEADERS = { 'User-Agent': 'AceLauncher/0.3.0 (github.com/ted16tr/AceLauncher)' };

async function searchModrinth({ query, projectType, mcVersion, loader }) {
  const facets = [[`project_type:${projectType}`]];
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  if ((projectType === 'mod' || projectType === 'modpack') && loader && loader !== 'vanilla') {
    facets.push([`categories:${loader}`]);
  }

  const res = await axios.get(`${API_BASE}/search`, {
    headers: HEADERS,
    params: {
      query: query || '',
      facets: JSON.stringify(facets),
      limit: 20,
    },
  });

  return res.data.hits.map((hit) => ({
    id: hit.project_id,
    title: hit.title,
    description: hit.description,
    author: hit.author,
    iconUrl: hit.icon_url,
    downloads: hit.downloads,
    projectType,
    platform: 'modrinth',
  }));
}

async function downloadFile(url, destPath) {
  await fs.ensureDir(path.dirname(destPath));
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: HEADERS,
  });
  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function installModrinthProject({ projectId, projectType, profile, onProgress }) {
  const params = {};
  if (profile.version) params.game_versions = JSON.stringify([profile.version]);
  if ((projectType === 'mod' || projectType === 'modpack') && profile.loader !== 'vanilla') {
    params.loaders = JSON.stringify([profile.loader]);
  }

  const verRes = await axios.get(`${API_BASE}/project/${projectId}/version`, {
    headers: HEADERS,
    params,
  });

  if (!verRes.data || verRes.data.length === 0) {
    throw new Error('Bu profilin sürümü/loaderı ile uyumlu dosya bulunamadı.');
  }

  const latestVersion = verRes.data[0];
  const primaryFile = latestVersion.files.find((f) => f.primary) || latestVersion.files[0];

  if (projectType === 'modpack') {
    if (onProgress) onProgress('Modpack paketi indiriliyor...');
    const tempPackPath = path.join(profile.gameDir, 'temp_pack.mrpack');
    await downloadFile(primaryFile.url, tempPackPath);

    const zip = new AdmZip(tempPackPath);
    const indexEntry = zip.getEntry('modrinth.index.json');
    if (!indexEntry) throw new Error('Geçersiz .mrpack dosyası.');

    const indexData = JSON.parse(indexEntry.getData().toString('utf8'));

    // Overrides klasörünü oyun dizinine çıkart
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.entryName.startsWith('overrides/') && !entry.isDirectory) {
        const relPath = entry.entryName.replace(/^overrides\//, '');
        const targetPath = path.join(profile.gameDir, relPath);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, entry.getData());
      }
    }

    // Modpack içindeki tüm mod/dosyaları indir
    const files = indexData.files || [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (onProgress) onProgress(`Modpack kuruluyor (${i + 1}/${files.length})...`);
      const targetPath = path.join(profile.gameDir, f.path);
      if (f.downloads && f.downloads.length > 0) {
        await downloadFile(f.downloads[0], targetPath);
      }
    }

    await fs.remove(tempPackPath);
    return `${indexData.name || 'Modpack'} kuruldu!`;
  } else {
    const folderMap = {
      mod: 'mods',
      shader: 'shaderpacks',
      resourcepack: 'resourcepacks',
    };
    const targetFolder = folderMap[projectType] || 'mods';
    const destPath = path.join(profile.gameDir, targetFolder, primaryFile.filename);

    if (onProgress) onProgress(`${primaryFile.filename} indiriliyor...`);
    await downloadFile(primaryFile.url, destPath);
    return `${primaryFile.filename} kuruldu!`;
  }
}

module.exports = {
  searchModrinth,
  installModrinthProject,
};
