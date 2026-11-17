import { useEffect, useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('profiles'); // 'profiles' | 'store' | 'settings'
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  // Mağaza (Modrinth & CurseForge)
  const [platform, setPlatform] = useState('modrinth');
  const [projectType, setProjectType] = useState('mod');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [installingId, setInstallingId] = useState(null);
  const [storeNotice, setStoreNotice] = useState('');

  // Ayarlar
  const [cfApiKey, setCfApiKey] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Oyun Durum
  const [status, setStatus] = useState('Hazır');
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    loadInitialData();

    window.mcAPI.onStatus((msg) => setStatus(msg));
    window.mcAPI.onInstallProgress((msg) => setStoreNotice(msg));
    window.mcAPI.onProgress((p) => {
      setStatus(`İndiriliyor (${p.type}): ${p.task}/${p.total}`);
    });
    window.mcAPI.onLog((log) => {
      if (log.includes('Setting user:')) setStatus('Oyun başlatılıyor...');
    });
    window.mcAPI.onClose(() => {
      setIsLaunching(false);
      setStatus('Hazır');
    });
  }, []);

  useEffect(() => {
    if (loader === 'vanilla') {
      setLoaderVersions([]);
      setSelectedLoaderVersion('');
      return;
    }
    fetchLoaderVersions();
  }, [loader, version]);

  useEffect(() => {
    if (activeTab === 'store' && selectedProfile) {
      handleSearch();
    }
  }, [activeTab, platform, projectType, selectedProfile]);

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
    const [vers, profs, cfg] = await Promise.all([
      window.mcAPI.getVersions(),
      window.mcAPI.getProfiles(),
      window.mcAPI.getConfig(),
    ]);
    setVersions(vers);
    if (vers.length > 0) setVersion(vers[0].id);
    setProfiles(profs);
    if (profs.length > 0) {
      setSelectedProfile(profs[0]);
    } else {
      setShowCreateForm(true);
    }
    if (cfg?.curseforgeApiKey) setCfApiKey(cfg.curseforgeApiKey);
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
    setShowCreateForm(false);
  }

  async function handleDeleteProfile(e, id) {
    e.stopPropagation();
    const updated = await window.mcAPI.deleteProfile(id);
    setProfiles(updated);
    if (selectedProfile?.id === id) {
      setSelectedProfile(updated[0] || null);
    }
  }

  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!selectedProfile) return;
    setIsSearching(true);
    setStoreNotice('');
    const res = await window.mcAPI.searchContent({
      platform,
      query: searchQuery,
      projectType,
      mcVersion: selectedProfile.version,
      loader: selectedProfile.loader,
    });
    if (res.status === 'ok') {
      setSearchResults(res.results);
    } else {
      setSearchResults([]);
      setStoreNotice(res.message);
    }
    setIsSearching(false);
  }

  async function handleInstall(item) {
    if (!selectedProfile || installingId) return;
    setInstallingId(item.id);
    setStoreNotice(`${item.title} indiriliyor...`);
    const res = await window.mcAPI.installContent({
      platform: item.platform,
      projectId: item.id,
      projectType: item.projectType,
      profile: selectedProfile,
    });
    if (res.status === 'ok') {
      setStoreNotice(res.message);
    } else {
      setStoreNotice(`Hata: ${res.message}`);
    }
    setInstallingId(null);
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    await window.mcAPI.saveConfig({ curseforgeApiKey: cfApiKey.trim() });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
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

  const loaderBadgeStyle = (type) => {
    if (type === 'fabric') return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    if (type === 'forge') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 select-none">
      {/* SOL SIDEBAR */}
      <aside className="w-64 bg-[#0c0c0f] border-r border-white/[0.06] flex flex-col justify-between p-4">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-sm">
                A
              </div>
              <span className="font-bold tracking-tight text-base text-white">
                Ace Launcher
              </span>
            </div>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400">
              v0.3
            </span>
          </div>

          {/* Oyuncu Kutusu */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
            <label className="text-[11px] font-medium text-zinc-500 block mb-1.5">
              Çevrimdışı Hesap
            </label>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                {username ? username[0].toUpperCase() : 'P'}
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Oyuncu Adı"
                className="w-full bg-transparent text-sm font-medium text-zinc-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Kategorize Menü */}
          <nav className="space-y-1">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Menü
            </p>
            {[
              { id: 'profiles', label: 'Profiller & Oyna', count: profiles.length },
              { id: 'store', label: 'İçerik Mağazası' },
              { id: 'settings', label: 'Ayarlar' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/[0.06] text-zinc-400">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Alt Play Alanı */}
        <div className="pt-4 border-t border-white/[0.06] space-y-3">
          {selectedProfile ? (
            <div className="px-1">
              <div className="text-xs font-semibold text-zinc-200 truncate">
                {selectedProfile.name}
              </div>
              <div className="text-[11px] text-zinc-500 capitalize">
                {selectedProfile.version} • {selectedProfile.loader} • {selectedProfile.ram}GB
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 px-1">Profil seçilmedi</div>
          )}

          <button
            onClick={handlePlay}
            disabled={!selectedProfile || isLaunching}
            className="w-full py-3 rounded-xl font-bold text-sm tracking-wide bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] disabled:bg-zinc-800/80 disabled:text-zinc-500 text-zinc-950 transition-all shadow-lg shadow-emerald-500/10"
          >
            {isLaunching ? 'ÇALIŞIYOR...' : 'OYNA'}
          </button>

          <p className="text-[11px] text-zinc-500 truncate text-center">{status}</p>
        </div>
      </aside>

      {/* SAĞ ANA İÇERİK ALANI */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#09090b]">
        {/* Üst Başlık Çubuğu */}
        <header className="h-16 border-b border-white/[0.06] px-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold text-white">
              {activeTab === 'profiles' && 'Oyun Profilleri'}
              {activeTab === 'store' && 'İçerik Mağazası'}
              {activeTab === 'settings' && 'Launcher Ayarları'}
            </h1>
            <p className="text-xs text-zinc-500">
              {activeTab === 'profiles' && 'Sürümlerini ve mod paketlerini tek yerden yönet'}
              {activeTab === 'store' && 'Modrinth ve CurseForge içeriklerini tek tıkla kur'}
              {activeTab === 'settings' && 'API anahtarları ve sistem yapılandırması'}
            </p>
          </div>

          {activeTab === 'profiles' && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition"
            >
              {showCreateForm ? 'Formu Kapat' : '+ Yeni Profil'}
            </button>
          )}

          {activeTab === 'store' && profiles.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Hedef Profil:</span>
              <select
                value={selectedProfile?.id || ''}
                onChange={(e) => {
                  const found = profiles.find((p) => p.id === e.target.value);
                  if (found) setSelectedProfile(found);
                }}
                className="bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.version} - {p.loader})
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* İÇERİK GÖVDESİ */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* 1. PROFİLLER SEKMESİ */}
          {activeTab === 'profiles' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Açılır Yeni Profil Oluşturma Kartı */}
              {showCreateForm && (
                <div className="bg-[#111115] border border-white/[0.08] rounded-2xl p-6 shadow-xl">
                  <h2 className="text-sm font-semibold text-white mb-4">Yeni Profil Oluştur</h2>
                  <form onSubmit={handleCreateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Profil Adı</label>
                      <input
                        type="text"
                        placeholder="Örn: Survival 1.21.4"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Minecraft Sürümü</label>
                      <select
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">Mod Loader</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['vanilla', 'fabric', 'forge'].map((type) => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => setLoader(type)}
                            className={`py-2 rounded-lg text-xs font-semibold capitalize border transition ${
                              loader === type
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                                : 'bg-zinc-950 border-white/[0.06] text-zinc-400 hover:text-white'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {loader !== 'vanilla' ? (
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1.5 capitalize">
                          {loader} Sürümü
                        </label>
                        {loadingLoaders ? (
                          <div className="text-xs text-zinc-500 py-2.5">Sürümler yükleniyor...</div>
                        ) : loaderVersions.length === 0 ? (
                          <div className="text-xs text-red-400 py-2.5">
                            Bu sürüm için {loader} bulunamadı.
                          </div>
                        ) : (
                          <select
                            value={selectedLoaderVersion}
                            onChange={(e) => setSelectedLoaderVersion(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
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
                    ) : (
                      <div>
                        <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                          <span>Bellek (RAM)</span>
                          <span className="text-emerald-400 font-semibold">{ram} GB</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="16"
                          value={ram}
                          onChange={(e) => setRam(e.target.value)}
                          className="w-full accent-emerald-500 mt-2"
                        />
                      </div>
                    )}

                    {loader !== 'vanilla' && (
                      <div className="md:col-span-2">
                        <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                          <span>Bellek (RAM)</span>
                          <span className="text-emerald-400 font-semibold">{ram} GB</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="16"
                          value={ram}
                          onChange={(e) => setRam(e.target.value)}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                    )}

                    <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="submit"
                        disabled={loader !== 'vanilla' && !selectedLoaderVersion}
                        className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-semibold rounded-lg text-xs transition"
                      >
                        Profili Oluştur
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Profil Kartları Grid */}
              {profiles.length === 0 ? (
                <div className="border border-dashed border-white/[0.08] rounded-2xl p-12 text-center">
                  <p className="text-sm text-zinc-400 mb-3">Henüz oluşturulmuş bir profil yok.</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-medium rounded-lg transition"
                  >
                    İlk Profilini Oluştur
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profiles.map((p) => {
                    const isSelected = selectedProfile?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProfile(p)}
                        className={`group rounded-2xl p-5 border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#121614] border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                            : 'bg-[#111115] border-white/[0.06] hover:border-white/[0.14]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-base text-white">{p.name}</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {p.loaderVersion ? `${p.loader} ${p.loaderVersion}` : 'Saf Sürüm'}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                              Seçili
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-300">
                              {p.version}
                            </span>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md border capitalize ${loaderBadgeStyle(
                                p.loader
                              )}`}
                            >
                              {p.loader}
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-zinc-400">
                              {p.ram} GB
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.mcAPI.openProfileFolder(p.gameDir);
                              }}
                              className="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
                            >
                              Klasör
                            </button>
                            <button
                              onClick={(e) => handleDeleteProfile(e, p.id)}
                              className="px-2.5 py-1 rounded-md text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. İÇERİK MAĞAZASI SEKMESİ */}
          {activeTab === 'store' && (
            <div className="max-w-5xl mx-auto space-y-5">
              {!selectedProfile ? (
                <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-8 text-center">
                  <p className="text-sm text-zinc-400 mb-3">
                    İçerik kurmak için önce bir profil oluşturmalısın.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('profiles');
                      setShowCreateForm(true);
                    }}
                    className="px-4 py-2 bg-emerald-500 text-zinc-950 font-semibold rounded-lg text-xs"
                  >
                    Profil Oluştur
                  </button>
                </div>
              ) : (
                <>
                  {/* Kategorize Filtre Çubuğu */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111115] border border-white/[0.06] p-2.5 rounded-xl">
                    {/* Platform Sekmeleri */}
                    <div className="flex bg-zinc-950 p-1 rounded-lg border border-white/[0.04]">
                      <button
                        onClick={() => setPlatform('modrinth')}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                          platform === 'modrinth'
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        Modrinth
                      </button>
                      <button
                        onClick={() => setPlatform('curseforge')}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                          platform === 'curseforge'
                            ? 'bg-orange-500 text-zinc-950'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        CurseForge
                      </button>
                    </div>

                    {/* Kategori Sekmeleri */}
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'mod', label: 'Modlar' },
                        { id: 'shader', label: 'Shader' },
                        { id: 'resourcepack', label: 'Kaynak Paketi' },
                        { id: 'modpack', label: 'Modpack' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setProjectType(cat.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            projectType === cat.id
                              ? 'bg-white/[0.1] text-white'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Arama Çubuğu */}
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`${
                        platform === 'modrinth' ? 'Modrinth' : 'CurseForge'
                      } içinde ara (Sodium, BSL, Iris...)`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-[#111115] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold rounded-xl text-xs transition"
                    >
                      Ara
                    </button>
                  </form>

                  {storeNotice && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 px-4 py-3 rounded-xl">
                      {storeNotice}
                    </div>
                  )}

                  {/* Sonuç Kartları */}
                  {isSearching ? (
                    <div className="text-xs text-zinc-500 py-12 text-center">İçerikler yükleniyor...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-12 text-center">
                      Bu kriterlere uygun sonuç bulunamadı.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {searchResults.map((item) => (
                        <div
                          key={`${item.platform}-${item.id}`}
                          className="bg-[#111115] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-4 flex items-center justify-between gap-4 transition"
                        >
                          <div className="flex items-center gap-3.5 overflow-hidden">
                            {item.iconUrl ? (
                              <img
                                src={item.iconUrl}
                                alt=""
                                className="w-12 h-12 rounded-xl object-cover bg-zinc-950 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-zinc-800/80 shrink-0" />
                            )}
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-white truncate">
                                  {item.title}
                                </h3>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 shrink-0">
                                  {Math.round(item.downloads / 1000)}K
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 mb-1">by {item.author}</p>
                              <p className="text-xs text-zinc-400 line-clamp-1">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleInstall(item)}
                            disabled={installingId !== null}
                            className="shrink-0 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 rounded-lg text-xs font-bold transition"
                          >
                            {installingId === item.id ? 'Kuruluyor' : 'Kur'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 3. AYARLAR SEKMESİ */}
          {activeTab === 'settings' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="bg-[#111115] border border-white/[0.06] rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-white mb-1">CurseForge Entegrasyonu</h2>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                  Modrinth ücretsiz ve anahtarsız çalışır. CurseForge üzerinden indirme yapmak için
                  CurseForge for Studios panelinden aldığın API anahtarını buraya girebilirsin.
                </p>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">API Key</label>
                    <input
                      type="password"
                      placeholder="$2a$10$..."
                      value={cfApiKey}
                      onChange={(e) => setCfApiKey(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg text-xs transition"
                    >
                      Değişiklikleri Kaydet
                    </button>
                    {settingsSaved && (
                      <span className="text-xs text-emerald-400">Ayarlar kaydedildi.</span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
