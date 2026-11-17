const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Belirli bir MC sürümü için Fabric Loader sürümlerini getir
async function getFabricVersions(mcVersion) {
  try {
    const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
    return res.data.map((item) => ({
      id: item.loader.version,
      stable: item.loader.stable,
    }));
  } catch {
    return [];
  }
}

// Belirli bir MC sürümü için Forge sürümlerini getir
async function getForgeVersions(mcVersion) {
  try {
    const res = await axios.get('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json');
    const allForMc = res.data[mcVersion] || [];
    // En yeniden eskiye sırala
    return allForMc.reverse().map((fullVer) => ({
      id: fullVer.split('-')[1], // Örn: 47.2.0
      fullVersion: fullVer,      // Örn: 1.20.1-47.2.0
    }));
  } catch {
    return [];
  }
}

// Fabric profilini indir ve versions klasörüne kaydet
async function installFabric(gameDir, mcVersion, loaderVersion) {
  const versionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(gameDir, 'versions', versionId);
  const jsonPath = path.join(versionDir, `${versionId}.json`);

  if (await fs.pathExists(jsonPath)) {
    return versionId;
  }

  await fs.ensureDir(versionDir);
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVersion}/profile/json`;
  const res = await axios.get(profileUrl);
  await fs.writeJson(jsonPath, res.data, { spaces: 2 });

  return versionId;
}

// Forge installer jar dosyasını indir (MCLC forge parametresi direkt bu jar'ı çalıştırır)
async function downloadForgeInstaller(gameDir, fullForgeVersion) {
  const installersDir = path.join(gameDir, 'installers');
  await fs.ensureDir(installersDir);

  const jarName = `forge-${fullForgeVersion}-installer.jar`;
  const jarPath = path.join(installersDir, jarName);

  if (await fs.pathExists(jarPath)) {
    return jarPath;
  }

  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullForgeVersion}/${jarName}`;
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  const writer = fs.createWriteStream(jarPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(jarPath));
    writer.on('error', reject);
  });
}

module.exports = {
  getFabricVersions,
  getForgeVersions,
  installFabric,
  downloadForgeInstaller,
};
