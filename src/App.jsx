import { useEffect, useState } from 'react';

export default function App() {
  const [versions, setVersions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [username, setUsername] = useState('Player');

  // Yeni profil formu
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.21.4');
  const [loader, setLoader] = useState('vanilla');
  const [loaderVersions, setLoaderVersions] = useState([]);
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState('');
  const [loadingLoaders, setLoadingLoaders] = useState(false);
  const [ram, setRam] = useState(4);

  // Durum / Log
  const [status, setStatus] = useState('Hazır');
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    loadInitialData();

    window.mcAPI.onStatus((msg) => setStatus(msg));
    window.mcAPI.onProgress((p) => {
      setStatus(`İndiriliyor (${p.type}): ${p.task} / ${p.total}`);
    });
    window.mcAPI.onLog((log) => {
      if (log.includes('Setting user:')) setStatus('Oyun açılıyor...');
    });
    window.mcAPI.onClose(() => {
      setIsLaunching(false);
      setStatus('Oyun kapandı.');
    });
  }, []);

  // Sürüm veya Loader değiştiğinde alt sürümleri çek
  useEffect(() => {
    if (loader === 'vanilla') {
      setLoaderVersions([]);
      setSelectedLoaderVersion('');
      return;
    }
    fetchLoaderVersions();
  }, [loader, version]);

  async function fetchLoaderVersions() {
    setLoadingLoaders(true);
    setLoaderVersions([]);
    const list = await window.mcAPI.getLoaderVersions({ loader, mcVersion: version });
    setLoaderVersions(list);
    if (list.length > 0) {
      setSelectedLoaderVersion(loader === 'forge' ? list[0].fullVersion : list[0].id);
    } else {
      setSelectedLoaderVersion('');
    }
    setLoadingLoaders(false);
  }

  async function loadInitialData() {
    const [vers, profs] = await Promise.all([
      window.mcAPI.getVersions(),
      window.mcAPI.getProfiles(),
    ]);
    setVersions(vers);
    if (vers.length > 0) setVersion(vers[0].id);
    setProfiles(profs);
    if (profs.length > 0) setSelectedProfile(profs[0]);
  }

  async function handleCreateProfile(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (loader !== 'vanilla' && !selectedLoaderVersion) return;

    const created = await window.mcAPI.createProfile({
      name,
      version,
      loader,
      loaderVersion: loader === 'vanilla' ? null : selectedLoaderVersion,
      ram: Number(ram),
    });
    const updated = [...profiles, created];
    setProfiles(updated);
    setSelectedProfile(created);
    setName('');
  }

  async function handleDeleteProfile(e, id) {
    e.stopPropagation();
    const updated = await window.mcAPI.deleteProfile(id);
    setProfiles(updated);
    if (selectedProfile?.id === id) {
      setSelectedProfile(updated[0] || null);
    }
  }

  async function handlePlay() {
    if (!selectedProfile || isLaunching) return;
    setIsLaunching(true);
    setStatus('Başlatılıyor...');
    const res = await window.mcAPI.launchGame({ profile: selectedProfile, username });
    if (res?.status === 'error') {
      setStatus(`Hata: ${res.message}`);
      setIsLaunching(false);
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Sol Sidebar: Profiller */}
      <aside className="w-72 bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold tracking-tight text-emerald-400">
              ACE LAUNCHER
            </h1>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              v0.2
            </span>
          </div>

          <div className="mb-5">
            <label className="text-xs text-zinc-400 block mb-1">Oyuncu Adı (Offline)</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <h2 className="text-xs font-semibold uppercase text-zinc-500 mb-2">Profiller</h2>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {profiles.length === 0 && (
              <p className="text-xs text-zinc-500">Henüz profil yok, sağdan oluştur.</p>
            )}
            {profiles.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProfile(p)}
                className={`group flex items-center justify-between w-full text-left px-3 py-2 rounded text-sm cursor-pointer transition ${
                  selectedProfile?.id === p.id
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-zinc-950/50 hover:bg-zinc-800 text-zinc-300 border border-transparent'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-zinc-500 capitalize">
                    {p.version} • {p.loader} • {p.ram}GB
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteProfile(e, p.id)}
                  title="Profili Sil"
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 text-xs px-1.5 py-0.5 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Alt Kısım: Play Butonu */}
        <div className="pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-400 truncate mb-2">{status}</p>
          <button
            onClick={handlePlay}
            disabled={!selectedProfile || isLaunching}
            className="w-full py-3 rounded-lg font-bold bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 transition"
          >
            {isLaunching ? 'ÇALIŞIYOR...' : 'OYNA'}
          </button>
        </div>
      </aside>

      {/* Sağ Ana Ekran: Yeni Profil Oluşturma */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Yeni Profil Oluştur</h2>
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Profil Adı</label>
              <input
                type="text"
                placeholder="Örn: Fabric Optimizasyon 1.21.4"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Minecraft Sürümü</label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Mod Loader Seçimi */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Mod Loader</label>
              <div className="grid grid-cols-3 gap-2">
                {['vanilla', 'fabric', 'forge'].map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setLoader(type)}
                    className={`py-2 rounded text-sm font-medium capitalize border transition ${
                      loader === type
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Fabric / Forge Sürüm Seçimi */}
            {loader !== 'vanilla' && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1 capitalize">
                  {loader} Sürümü
                </label>
                {loadingLoaders ? (
                  <p className="text-xs text-zinc-500 py-2">Sürümler yükleniyor...</p>
                ) : loaderVersions.length === 0 ? (
                  <p className="text-xs text-red-400 py-2">
                    Bu Minecraft sürümü için {loader} bulunamadı.
                  </p>
                ) : (
                  <select
                    value={selectedLoaderVersion}
                    onChange={(e) => setSelectedLoaderVersion(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {loaderVersions.map((lv) => (
                      <option
                        key={lv.id}
                        value={loader === 'forge' ? lv.fullVersion : lv.id}
                      >
                        {lv.id} {lv.stable ? '(Önerilen)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm text-zinc-400 mb-1">RAM Miktarı (GB)</label>
              <input
                type="number"
                min="1"
                max="16"
                value={ram}
                onChange={(e) => setRam(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loader !== 'vanilla' && !selectedLoaderVersion}
              className="px-4 py-2 bg-zinc-100 text-zinc-950 font-medium rounded text-sm hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 transition"
            >
              Profili Kaydet
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
