const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

const API_BASE = 'https://api.curseforge.com/v1';
const GAME_ID_MINECRAFT = 432;

const CLASS_MAP = {
  mod: 6,
  resourcepack: 12,
  shader: 6552,
  modpack: 4471,
};

const LOADER_MAP = {
  forge: 1,
  fabric: 4,
};

async function searchCurseForge({ apiKey, query, projectType, mcVersion, loader }) {
  if (!apiKey) {
    throw new Error('CurseForge için önce Ayarlar sekmesinden API Key girmelisin.');
  }

  const params = {
    gameId: GAME_ID_MINECRAFT,
    classId: CLASS_MAP[projectType] || 6,
    searchFilter: query || '',
    pageSize: 20,
    sortField: 2, // Popülerliğe göre
    sortOrder: 'desc',
  };

  if (mcVersion) params.gameVersion = mcVersion;
  if ((projectType === 'mod' || projectType === 'modpack') && LOADER_MAP[loader]) {
    params.modLoaderType = LOADER_MAP[loader];
  }

  const res = await axios.get(`${API_BASE}/mods/search`, {
    headers: { 'x-api-key': apiKey },
    params,
  });

  return res.data.data.map((item) => ({
    id: item.id,
    title: item.name,
    description: item.summary,
    author: item.authors?.[0]?.name || 'Bilinmiyor',
    iconUrl: item.logo?.thumbnailUrl || '',
    downloads: item.downloadCount,
    projectType,
    platform: 'curseforge',
  }));
}

async function downloadFile(url, destPath) {
  await fs.ensureDir(path.dirname(destPath));
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function installCurseForgeProject({ apiKey, projectId, projectType, profile, onProgress }) {
  if (!apiKey) {
    throw new Error('CurseForge API Key eksik.');
  }

  const params = { pageSize: 10 };
  if (profile.version) params.gameVersion = profile.version;
  if ((projectType === 'mod' || projectType === 'modpack') && LOADER_MAP[profile.loader]) {
    params.modLoaderType = LOADER_MAP[profile.loader];
  }

  const filesRes = await axios.get(`${API_BASE}/mods/${projectId}/files`, {
    headers: { 'x-api-key': apiKey },
    params,
  });

  const files = filesRes.data.data;
  if (!files || files.length === 0) {
    throw new Error('Bu profilin sürümü/loaderı ile uyumlu CurseForge dosyası bulunamadı.');
  }

  const targetFile = files[0];
  let downloadUrl = targetFile.downloadUrl;

  if (!downloadUrl) {
    const urlRes = await axios.get(
      `${API_BASE}/mods/${projectId}/files/${targetFile.id}/download-url`,
      { headers: { 'x-api-key': apiKey } }
    );
    downloadUrl = urlRes.data.data;
  }

  if (projectType === 'modpack') {
    if (onProgress) onProgress('CurseForge modpack indiriliyor...');
    const tempZipPath = path.join(profile.gameDir, 'temp_cf_pack.zip');
    await downloadFile(downloadUrl, tempZipPath);

    const zip = new AdmZip(tempZipPath);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) throw new Error('Geçersiz CurseForge modpack zip dosyası.');

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    const overridesFolder = manifest.overrides || 'overrides';

    for (const entry of zip.getEntries()) {
      if (entry.entryName.startsWith(`${overridesFolder}/`) && !entry.isDirectory) {
        const relPath = entry.entryName.replace(new RegExp(`^${overridesFolder}/`), '');
        const targetPath = path.join(profile.gameDir, relPath);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, entry.getData());
      }
    }

    const packFiles = manifest.files || [];
    for (let i = 0; i < packFiles.length; i++) {
      const f = packFiles[i];
      if (onProgress) onProgress(`Modpack kuruluyor (${i + 1}/${packFiles.length})...`);
      try {
        const fileInfoRes = await axios.get(
          `${API_BASE}/mods/${f.projectID}/files/${f.fileID}`,
          { headers: { 'x-api-key': apiKey } }
        );
        const modFile = fileInfoRes.data.data;
        let modUrl = modFile.downloadUrl;
        if (!modUrl) {
          const uRes = await axios.get(
            `${API_BASE}/mods/${f.projectID}/files/${f.fileID}/download-url`,
            { headers: { 'x-api-key': apiKey } }
          );
          modUrl = uRes.data.data;
        }
        if (modUrl) {
          await downloadFile(modUrl, path.join(profile.gameDir, 'mods', modFile.fileName));
        }
      } catch {
        // Bazı mod yapımcıları 3. parti API indirmesini kapatmış olabilir, atlayıp devam et
      }
    }

    await fs.remove(tempZipPath);
    return `${manifest.name || 'CurseForge Modpack'} kuruldu!`;
  } else {
    const folderMap = {
      mod: 'mods',
      shader: 'shaderpacks',
      resourcepack: 'resourcepacks',
    };
    const targetFolder = folderMap[projectType] || 'mods';
    const destPath = path.join(profile.gameDir, targetFolder, targetFile.fileName);

    if (onProgress) onProgress(`${targetFile.fileName} indiriliyor...`);
    await downloadFile(downloadUrl, destPath);
    return `${targetFile.fileName} kuruldu!`;
  }
}

module.exports = {
  searchCurseForge,
  installCurseForgeProject,
};
