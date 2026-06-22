/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase.js";
import { StreamItem, UserConfig, PlaybackLog } from "../types.js";
import {
  Tv,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Sparkles,
  Settings,
  ListVideo,
  Activity,
  LogOut,
  Info,
  Check,
  Search,
  Video,
  Clapperboard,
  Link,
  HelpCircle,
  FileJson,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AddonConfiguratorProps {
  user: any;
  onLogout: () => void;
}

export default function AddonConfigurator({ user, onLogout }: AddonConfiguratorProps) {
  // Configurações Gerais do Manifesto
  const [manifestName, setManifestName] = useState("Seu Addon Pessoal");
  const [manifestDesc, setManifestDesc] = useState("Playlist sincronizada via Firebase e inteligência artificial.");
  const [customHostUrl, setCustomHostUrl] = useState("");

  // Lista de Streams Cadastrados
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [analyticsLogs, setAnalyticsLogs] = useState<PlaybackLog[]>([]);

  // Formulário de Cadastro de novo Stream
  const [newStream, setNewStream] = useState<Partial<StreamItem>>({
    name: "",
    type: "movie",
    url: "",
    ytId: "",
    infoHash: "",
    imdbId: "",
    description: "",
    poster: "",
    genre: "Canais Livres"
  });

  // Estados de Interface e Modais
  const [activeTab, setActiveTab] = useState<"streams" | "config" | "analytics">("streams");
  const [formMode, setFormMode] = useState<"manual" | "gemini">("manual");
  const [geminiPrompt, setGeminiPrompt] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHttp, setCopiedHttp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // URLs do Addon para o Stremio (Resolvido dinamicamente se houver Host Customizado como Vercel)
  const appUrl = customHostUrl 
    ? (customHostUrl.startsWith("http") ? customHostUrl : `https://${customHostUrl}`).replace(/\/$/, "")
    : window.location.origin;
  const stremioInstallLink = `stremio://${appUrl.replace(/^https?:\/\//, "")}/api/user/${user.uid}/manifest.json`;
  const stremioManifestHttp = `${appUrl}/api/user/${user.uid}/manifest.json`;

  // Carregar configurações do banco Firebase Firestore ao iniciar
  const loadUserConfigAndAnalytics = async () => {
    try {
      setLoadingConfig(true);
      setErrorMsg(null);
      
      const docRef = doc(db, "user_configs", user.uid);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (e: any) {
        handleFirestoreError(e, OperationType.GET, `user_configs/${user.uid}`);
        throw e;
      }

      if (docSnap.exists()) {
        const data = docSnap.data() as UserConfig;
        setManifestName(data.customManifestName || "Meu Addon Premium");
        setManifestDesc(data.customDescription || "Catálogo IPTV e streams em altíssima qualidade.");
        setCustomHostUrl(data.customHostUrl || "");
        setStreams(data.streams || []);
      } else {
        // Criar dados iniciais de exemplo para o usuário não ficar com catálogo completamente vazio no início
        const initialStreams: StreamItem[] = [
          {
            id: "fb-strem-welcome",
            name: "Bem-vindo ao Addon Hub!",
            type: "movie",
            ytId: "dQw4w9WgXcQ", // Vídeo de exemplo no YouTube
            description: "Este é um item de exemplo criado automaticamente. Você já pode apagá-lo e cadastrar suas próprias fontes do Drive, IPTV M3U8 ou Torrents!",
            genre: "Ajuda & Tutoriais",
            poster: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400",
            createdAt: new Date().toISOString()
          }
        ];
        
        const initialConfig: UserConfig = {
          uid: user.uid,
          customManifestName: "Playlist Premium de " + (user.displayName || "Usuário"),
          customDescription: "Canais, trailers e conteúdos curados diretamente do meu painel Firebase.",
          streams: initialStreams,
          updatedAt: new Date().toISOString()
        };

        try {
          await setDoc(docRef, initialConfig);
        } catch (e: any) {
          handleFirestoreError(e, OperationType.WRITE, `user_configs/${user.uid}`);
          throw e;
        }
        setManifestName(initialConfig.customManifestName);
        setManifestDesc(initialConfig.customDescription);
        setStreams(initialStreams);
      }

      // Buscar os logs de playback analítica
      fetchAnalytics();
    } catch (e: any) {
      console.error("Erro ao carregar do Firestore:", e);
      setErrorMsg("Falha ao sincronizar com o Firebase Cloud. Recarregue.");
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const q = query(
        collection(db, "playback_logs"),
        where("uid", "==", user.uid),
        orderBy("playedAt", "desc"),
        limit(25)
      );
      const snaps = await getDocs(q);
      const list: PlaybackLog[] = [];
      snaps.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as PlaybackLog);
      });
      setAnalyticsLogs(list);
    } catch (err: any) {
      console.warn("Direct firestore analytics failed, trying backend fallback...", err);
      // Fallback to Express backend
      try {
        const response = await fetch(`/api/user/${user.uid}/analytics`);
        if (response.ok) {
          const data = await response.json();
          setAnalyticsLogs(data.logs || []);
        } else {
          handleFirestoreError(err, OperationType.LIST, "playback_logs");
        }
      } catch (fallbackErr) {
        handleFirestoreError(err, OperationType.LIST, "playback_logs");
      }
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadUserConfigAndAnalytics();
    }
  }, [user.uid]);

  // Função para salvar a configuração do usuário no Firestore
  const saveUserData = async (updatedStreams: StreamItem[], forceUpdateGeneral: boolean = false) => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      const docRef = doc(db, "user_configs", user.uid);
      try {
        await setDoc(docRef, {
          uid: user.uid,
          customManifestName: manifestName,
          customDescription: manifestDesc,
          customHostUrl: customHostUrl,
          streams: updatedStreams,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e: any) {
        handleFirestoreError(e, OperationType.WRITE, `user_configs/${user.uid}`);
        throw e;
      }

      setStreams(updatedStreams);
      setSuccessMsg("Sincronização com o Firebase concluída!");
      
      // Auto-dimiss success msg
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error("Erro ao salvar:", e);
      setErrorMsg("Ocorreu um erro ao gravar suas alterações no Firebase.");
    } finally {
      setSaving(false);
    }
  };

  // Tratador dinâmico de colagem e digitação de hash ou link magnet torrent
  const handleHashChange = (val: string) => {
    let cleanHash = val.trim();
    if (cleanHash.startsWith("magnet:") || cleanHash.includes("btih:")) {
      const match = cleanHash.match(/btih:([a-fA-F0-9]{40})/i) || cleanHash.match(/btih:([a-fA-F0-9]{32})/i);
      if (match) {
        cleanHash = match[1].toLowerCase();
        setSuccessMsg("Link Magnético detectado por Regex! InfoHash extraído.");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    }
    setNewStream(prev => ({ ...prev, infoHash: cleanHash }));
  };

  // Cadastrar novos links de forma manual
  const handleAddStreamManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStream.name) {
      setErrorMsg("Insira o nome do Stream/Filme.");
      return;
    }

    const itemToAdd: StreamItem = {
      id: `fb-strem-${Date.now()}`,
      name: newStream.name,
      type: (newStream.type as "movie" | "series") || "movie",
      url: newStream.url || undefined,
      ytId: newStream.ytId || undefined,
      infoHash: newStream.infoHash || undefined,
      imdbId: newStream.imdbId || undefined,
      description: newStream.description || "Criado via painel Firebase.",
      poster: newStream.poster || undefined,
      genre: newStream.genre || "Geral",
      createdAt: new Date().toISOString()
    };

    const nextList = [itemToAdd, ...streams];
    saveUserData(nextList);

    // Reset formulário
    setNewStream({
      name: "",
      type: "movie",
      url: "",
      ytId: "",
      infoHash: "",
      imdbId: "",
      description: "",
      poster: "",
      genre: "Canais Livres"
    });
  };

  // Gerar metadados inteligentes com Gemini AI
  const handleGeminiGeneration = async () => {
    if (!geminiPrompt.trim()) {
      setErrorMsg("Digite o que você quer que o Gemini crie para você.");
      return;
    }
    setErrorMsg(null);
    setAiGenerating(true);

    try {
      const response = await fetch("/api/generate-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: geminiPrompt })
      });

      if (!response.ok) {
        let errMsg = "Serviço de IA instável temporariamente.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const parsedResult = await response.json();
      
      // Preencher o formulário manual com os dados sugeridos pela IA
      setNewStream({
        name: parsedResult.name || "",
        type: parsedResult.type || "movie",
        description: parsedResult.description || "",
        genre: parsedResult.genre || "IA Curated",
        poster: parsedResult.poster || "",
        ytId: parsedResult.ytId || "",
        url: "",
        infoHash: "",
        imdbId: ""
      });

      setFormMode("manual"); // muda o formulário para manual para o usuário revisar e salvar
      setSuccessMsg("Metadados gerados pela IA! Revise abaixo e salve.");
    } catch (e: any) {
      console.error("Erro do Gemini:", e);
      setErrorMsg(e.message || "Erro de rede ao conectar com o Gemini.");
    } finally {
      setAiGenerating(false);
    }
  };

  // Excluir streams existentes
  const handleDeleteStream = (id: string) => {
    if (confirm("Tem certeza de que deseja remover este item de seu catálogo Stremio?")) {
      const update = streams.filter(s => s.id !== id);
      saveUserData(update);
    }
  };

  // Cópia de links para a área de transferência
  const copyToClipboard = (text: string, type: "link" | "http") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedHttp(true);
      setTimeout(() => setCopiedHttp(false), 2000);
    }
  };

  if (loadingConfig) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center font-sans text-white">
        <div className="w-12 h-12 border-4 border-purple-900 border-t-purple-500 rounded-full animate-spin" />
        <p className="mt-4 text-neutral-400 text-sm animate-pulse tracking-wide">Sincronizando Firebase Cloud Engine...</p>
      </div>
    );
  }

  return (
    <div id="add-on-main-layout" className="min-h-screen bg-neutral-950 text-white font-sans antialiased">
      {/* Dynamic notifications bar */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 bg-indigo-600/95 border border-indigo-400 text-white font-medium px-6 py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2.5 z-50 text-sm backdrop-blur"
          >
            <Check className="w-5 h-5 text-indigo-200 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-950/95 border border-red-500/40 text-red-100 font-medium px-6 py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2.5 z-50 text-sm backdrop-blur"
          >
            <Info className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="border-b border-neutral-900 bg-neutral-900/40 sticky top-0 backdrop-blur z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-neutral-100 flex items-center gap-1.5">
                Stremio Addon Hub
                <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/40 font-mono">
                  v1.0.0
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User credentials identifier */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs text-neutral-400 font-medium">{user.email}</span>
            </div>
            <button
              onClick={onLogout}
              id="btn-logout"
              title="Encerrar sessão"
              className="text-neutral-400 hover:text-red-400 p-2 hover:bg-neutral-800/50 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner with integration guidelines */}
      <section className="bg-gradient-to-b from-purple-950/20 via-neutral-950 to-neutral-950 py-10 border-b border-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-neutral-900/40 border border-neutral-850 p-6 sm:p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[40%] h-[150%] bg-purple-600/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs px-3 py-1.5 rounded-full font-bold">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                CONEXÃO STREMIO INSTANTÂNEA
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-500 bg-gradient-to-r from-purple-200 via-white to-neutral-200 bg-clip-text text-transparent">
                Adicione no Stremio com 1 clique!
              </h1>
              <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                As streams cadastradas neste painel são transmitidas dinamicamente do Firebase Firestore direto para o seu player Stremio!
              </p>

              {/* Install and configure links */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={stremioInstallLink}
                  id="btn-install-stremio"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-purple-600/20 active:scale-[0.99] transition-all duration-200"
                >
                  <Tv className="w-5 h-5 shrink-0" />
                  Instalar Addon no Stremio
                </a>
                <button
                  onClick={() => copyToClipboard(stremioManifestHttp, "http")}
                  className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 py-3 px-5 rounded-xl font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {copiedHttp ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Copiado com sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Copiar link do Manifesto</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-neutral-800/60 pt-6 lg:pt-0 lg:pl-8 space-y-4">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Como configurar</span>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex gap-3 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-bold text-purple-400 border border-neutral-800">1</span>
                  <span>Cadastre canais ou filmes no formulário abaixo (links de vídeo, youtube ou trailers).</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-bold text-purple-400 border border-neutral-800">2</span>
                  <span>Clique em <strong>Instalar no Stremio</strong> acima para sincronizar instantaneamente.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-neutral-950 flex items-center justify-center text-[10px] font-bold text-purple-400 border border-neutral-800">3</span>
                  <span>Abra a seção de <strong className="text-purple-300">Complementos Instalados</strong> se quiser conferir.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* App Body and Tab Menu */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Main Controls Panel (Left columns or single) */}
          <section className="lg:col-span-8 space-y-8">
            {/* Tabs selector */}
            <div className="flex border-b border-neutral-900 bg-neutral-900/10 p-1 rounded-2xl gap-1">
              <button
                onClick={() => { setActiveTab("streams"); fetchAnalytics(); }}
                className={`flex-1 py-3 text-center rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                  activeTab === "streams"
                    ? "bg-purple-900/30 text-purple-200 border border-purple-800/40"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
                }`}
              >
                <ListVideo className="w-4 h-4" />
                <span>Playlists ({streams.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("config")}
                className={`flex-1 py-3 text-center rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                  activeTab === "config"
                    ? "bg-purple-900/30 text-purple-200 border border-purple-800/40"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Customização</span>
              </button>

              <button
                onClick={() => { setActiveTab("analytics"); fetchAnalytics(); }}
                className={`flex-1 py-3 text-center rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                  activeTab === "analytics"
                    ? "bg-purple-900/30 text-purple-200 border border-purple-800/40"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900/50"
                }`}
              >
                <Activity className="w-4 h-4 animate-pulse text-purple-400" />
                <span>Métricas / Logs</span>
              </button>
            </div>

            {/* TAB CONTENTS */}
            <AnimatePresence mode="wait">
              {activeTab === "streams" && (
                <motion.div
                  key="tab-streams"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-8"
                  id="tab-streams-wrapper"
                >
                  {/* Grid of existing items in catalog */}
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-lg font-bold text-neutral-200">Seus Itens Cadastrados</h2>
                      <span className="text-xs text-purple-400 font-bold bg-purple-950/40 px-3 py-1.5 rounded-full border border-purple-900">
                        {streams.length} Itens Ativos
                      </span>
                    </div>

                    {streams.length === 0 ? (
                      <div className="text-center py-16 bg-neutral-900/30 border border-dashed border-neutral-800 rounded-3xl" id="empty-streams">
                        <Video className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                        <h3 className="font-bold text-neutral-300">Nenhum stream cadastrado ainda</h3>
                        <p className="text-neutral-400 text-sm mt-1 max-w-xs mx-auto">
                          Preencha o painel de cadastro ao lado para popular o seu addon do Stremio.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" id="streams-catalog-grid">
                        {streams.map((item) => (
                          <motion.div
                            key={item.id}
                            layout
                            className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-3xl flex gap-4 hover:border-neutral-800 hover:bg-neutral-900/60 transition-all duration-200 shadow-lg relative group"
                          >
                            <img
                              src={item.poster || "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&q=80&w=200"}
                              alt={item.name}
                              className="w-20 h-28 object-cover rounded-xl shrink-0 bg-neutral-950 border border-neutral-850"
                            />
                            
                            <div className="flex flex-col justify-between flex-1 py-1 min-w-0">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg border ${
                                    item.type === "movie"
                                      ? "bg-purple-900/20 text-purple-300 border-purple-800/40"
                                      : "bg-indigo-900/20 text-indigo-300 border-indigo-800/40"
                                  }`}>
                                    {item.type === "movie" ? "Filme/Vídeo" : "Série"}
                                  </span>
                                  <span className="text-[10px] bg-neutral-800 border border-neutral-700 font-bold text-neutral-400 px-2 py-0.5 rounded-lg truncate max-w-[100px]">
                                    {item.genre || "Geral"}
                                  </span>
                                </div>
                                <h4 className="font-extrabold text-sm text-neutral-200 truncate pr-6 group-hover:text-purple-300 transition-colors" title={item.name}>
                                  {item.name}
                                </h4>
                                <p className="text-xs text-neutral-400 mt-1 lines-clamp-3 line-clamp-2 max-w-[200px]" title={item.description}>
                                  {item.description}
                                </p>
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-1.5">
                                  {item.url && (
                                    <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-semibold" title={item.url}>
                                      <Link className="w-3 h-3 text-indigo-400" /> Web IP
                                    </span>
                                  )}
                                  {item.ytId && (
                                    <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-semibold">
                                      <Tv className="w-3 h-3 text-red-500" /> YouTube
                                    </span>
                                  )}
                                  {item.infoHash && (
                                    <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-semibold">
                                      <TrendingUp className="w-3 h-3 text-purple-400" /> Torrent
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleDeleteStream(item.id)}
                                  className="text-neutral-500 hover:text-red-400 p-1.5 hover:bg-red-950/15 border border-transparent hover:border-red-900/40 rounded-lg transition-all absolute top-3 right-3 opacity-100 sm:opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Remover do catálogo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "config" && (
                <motion.div
                  key="tab-config"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6 bg-neutral-900/40 border border-neutral-850 p-6 sm:p-8 rounded-3xl"
                  id="tab-config-wrapper"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-bold text-neutral-100">Configurações do Manifesto</h2>
                  </div>
                  <p className="text-sm text-neutral-400">
                    O Stremio lê essas informações como a identidade visual e o nome do complemento.
                  </p>

                  <div className="space-y-5 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                        Nome do Addon no Stremio
                      </label>
                      <input
                        type="text"
                        value={manifestName}
                        onChange={(e) => setManifestName(e.target.value)}
                        placeholder="Ex: Minhas Streams de Filme"
                        className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 px-4 py-3 text-sm transition-colors duration-200 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                        Descrição do Addon
                      </label>
                      <textarea
                        value={manifestDesc}
                        onChange={(e) => setManifestDesc(e.target.value)}
                        placeholder="Ex: Minha lista do Google Drive salvos por mim."
                        rows={3}
                        className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 px-4 py-3 text-sm transition-colors duration-200 leading-relaxed"
                      />
                    </div>

                    <div className="border border-neutral-800 bg-neutral-950/30 p-4.5 rounded-2xl space-y-3.5">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-purple-400" />
                        <span className="text-xs uppercase font-extrabold tracking-widest text-neutral-300">Host de Produção (Vercel / Cloud)</span>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-1">
                          URL de Deploy Vercel (Opcional)
                        </label>
                        <input
                          type="text"
                          value={customHostUrl}
                          onChange={(e) => setCustomHostUrl(e.target.value.trim())}
                          placeholder="Ex: addon-red-nine.vercel.app"
                          className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 px-4 py-2.5 text-xs transition-colors duration-200 font-mono"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed font-semibold">
                          💡 <strong>Por que usar o Vercel?</strong> Os ambientes de testes expiram ao fechar a janela. Seta a sua URL de produção <code>addon-red-nine.vercel.app</code> e as credenciais geradas de 1-clique vão apontar direto para o seu servidor permanente no Vercel no Stremio!
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => saveUserData(streams, true)}
                      disabled={saving}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-purple-600/10 hover:shadow-purple-600/20 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                    >
                      {saving ? (
                        <div className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Salvar Metadados</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === "analytics" && (
                <motion.div
                  key="tab-analytics"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                  id="tab-analytics-wrapper"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                        Histórico de Playbacks via Firebase Logs
                      </h2>
                      <p className="text-xs text-neutral-400 mt-1">
                        Acompanhe quando você ou seus convidados dão play nos canais dentro do Stremio.
                      </p>
                    </div>
                    <button
                      onClick={fetchAnalytics}
                      className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 px-3.5 py-2 rounded-xl"
                    >
                      Atualizar Logs
                    </button>
                  </div>

                  {analyticsLogs.length === 0 ? (
                    <div className="text-center py-16 bg-neutral-900/30 border border-neutral-800 rounded-3xl" id="empty-analytics">
                      <ScrollLogsPlaceholder className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
                      <h3 className="font-bold text-neutral-300">Sem reproduções recentes registradas</h3>
                      <p className="text-neutral-400 text-sm mt-1 max-w-xs mx-auto">
                        Abra o Stremio, instale este complemento, inicie um stream e os logs aparecerão aqui instantaneamente.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-neutral-900/40 border border-neutral-850 rounded-3xl overflow-hidden shadow-lg" id="analytics-logs-list">
                      <div className="divide-y divide-neutral-850">
                        {analyticsLogs.map((log) => (
                          <div key={log.id} className="p-4 flex sm:items-center justify-between gap-4 hover:bg-neutral-900/30 transition-all">
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <div className="w-9 h-9 shrink-0 bg-indigo-505/10 bg-indigo-950/40 text-indigo-400 border border-indigo-900 rounded-xl flex items-center justify-center font-bold">
                                <Clapperboard className="w-4.5 h-4.5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-neutral-200 truncate pr-4">{log.streamName}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                                    {log.streamType === "movie" ? "Filme / IPTV" : "Série"}
                                  </span>
                                  <span className="text-[10px] text-neutral-600 font-bold">•</span>
                                  <span className="text-[10px] text-neutral-500 font-mono">ID: {log.streamId}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs text-neutral-400 font-mono block">
                                {new Date(log.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-medium font-mono mt-0.5 block">
                                {new Date(log.playedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Form and AI Controls Sidebar (Right columns) */}
          <aside className="lg:col-span-4 space-y-8">
            <div className="bg-neutral-900/85 md:bg-neutral-900/50 p-6 sm:p-7 rounded-3xl border border-neutral-850 shadow-xl space-y-6">
              
              {/* Form switcher tabs */}
              <div className="flex border border-neutral-800 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setFormMode("manual")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    formMode === "manual" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Modo Manual
                </button>
                <button
                  onClick={() => setFormMode("gemini")}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    formMode === "gemini" ? "bg-purple-900/30 text-purple-300 border border-purple-800/20" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Gerar p/ IA 🤖
                </button>
              </div>

              {formMode === "manual" ? (
                /* MANUAL INPUT FORM */
                <form onSubmit={handleAddStreamManual} className="space-y-4" id="stream-creation-form">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-5 h-5 text-purple-400 shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-200">Adicionar Stream</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Título
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Trailer Interestelar"
                      value={newStream.name}
                      onChange={(e) => setNewStream({ ...newStream, name: e.target.value })}
                      className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-4 py-2.5 text-sm transition-colors duration-200 font-semibold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                        Tipo
                      </label>
                      <select
                        value={newStream.type}
                        onChange={(e) => setNewStream({ ...newStream, type: e.target.value as "movie" | "series" })}
                        className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-3 py-2.5 text-sm transition-colors duration-200"
                      >
                        <option value="movie">Filme / Canal</option>
                        <option value="series">Série</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                        Gênero / Categoria
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: IPTV, Sci-Fi"
                        value={newStream.genre}
                        onChange={(e) => setNewStream({ ...newStream, genre: e.target.value })}
                        className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-4 py-2.5 text-sm transition-colors duration-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Link Direto de Vídeo (IPTV ou MP4)
                    </label>
                    <input
                      type="url"
                      placeholder="https://sua-url/playlist.m3u8"
                      value={newStream.url}
                      onChange={(e) => setNewStream({ ...newStream, url: e.target.value })}
                      className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-4 py-2.5 text-sm transition-colors duration-200 font-mono"
                    />
                  </div>

                  <div className="border border-neutral-800 bg-neutral-950/40 p-3.5 rounded-2xl space-y-3.5">
                    <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 animate-pulse" /> Integração de Torrents / Magnets P2P
                    </span>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1.5" title="Torrent infoHash ou Magnet Link">
                        Magnet Link ou Torrent Hash
                      </label>
                      <input
                        type="text"
                        placeholder="Cole magnet:?xt=urn:btih:hash... ou o Hash de 40 carácteres direto"
                        value={newStream.infoHash}
                        onChange={(e) => handleHashChange(e.target.value)}
                        className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-4 py-2.5 text-xs transition-colors duration-200 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 flex items-center gap-1" title="ID do IMDB do conteúdo (ex: tt0816692). Deixe em branco se quiser criar um item original que aparecerá diretamente nos trilhos de catálogo da Tela Inicial do Stremio!">
                          ID IMDB (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: tt0816692"
                          value={newStream.imdbId || ""}
                          onChange={(e) => setNewStream({ ...newStream, imdbId: e.target.value.trim() })}
                          className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-3 py-2 text-xs transition-colors duration-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1" title="ID de vídeo do Youtube (trailers ou canais vivos)">
                          YouTube ID (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: dQw4w9WgXcQ"
                          value={newStream.ytId || ""}
                          onChange={(e) => setNewStream({ ...newStream, ytId: e.target.value.trim() })}
                          className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-3 py-2 text-xs transition-colors duration-200 font-mono"
                        />
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold">
                      💡 <strong>Dica da Tela Inicial:</strong> Se você deixar o <strong>ID IMDB em branco</strong>, o título aparecerá como um item novo no trilho customizado da <strong>Tela Inicial (Home) do Stremio</strong>! Se preencher com o ID IMDB, ele ficará disponível nos streams oficiais do próprio filme!
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      URL da Imagem de Pôster
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={newStream.poster}
                      onChange={(e) => setNewStream({ ...newStream, poster: e.target.value })}
                      className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-4 py-2.5 text-sm transition-colors duration-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      Descrição / Detalhes
                    </label>
                    <textarea
                      placeholder="Escreva detalhes ou IA curadores..."
                      value={newStream.description}
                      onChange={(e) => setNewStream({ ...newStream, description: e.target.value })}
                      rows={2}
                      className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none px-4 py-2 text-sm transition-colors duration-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    id="btn-add-stream"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-purple-200" />
                        <span>Salvar no Catálogo</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* AI GENERATION WITH GEMINI FORM */
                <div className="space-y-4" id="ai-generator-panel">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-200">Auxílio do Gemini AI</h3>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Pesquise ou peça metadados completos de filmes, séries ou IPTV. A IA gerará o Título, Gênero, Descrição e Poster Unsplash para você.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                      Descreva o que quer adicionar
                    </label>
                    <textarea
                      placeholder="Ex: Crie metadados ricos para o filme Blade Runner 2049 com uma descrição artística e gênero ficção."
                      value={geminiPrompt}
                      onChange={(e) => setGeminiPrompt(e.target.value)}
                      rows={4}
                      className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none p-4 text-sm transition-colors duration-200 leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={handleGeminiGeneration}
                    disabled={aiGenerating}
                    id="btn-trigger-ai"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xl shadow-purple-500/15 hover:shadow-purple-500/25 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                  >
                    {aiGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-purple-200/35 border-t-white rounded-full animate-spin" />
                        <span>Curando com Gemini AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-200" />
                        <span>Gerar Metadados com IA</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Quick tips layout card */}
            <div className="bg-neutral-900/40 border border-neutral-850 p-5 rounded-3xl" id="sidebar-tips">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
                <HelpCircle className="w-4.5 h-4.5 text-purple-400" />
                Informações Importantes
              </span>
              <div className="space-y-3 text-xs sm:text-sm text-neutral-400">
                <p>
                  <strong className="text-neutral-300">Compatibilidade:</strong> Stremio aceita arquivos HLS/IPTV (arquivos <code className="bg-neutral-950 px-1 rounded text-indigo-400 font-mono">.m3u8</code> ou <code className="bg-neutral-950 px-1 rounded text-indigo-400 font-mono">.mp4</code> diretos) ou Torrents.
                </p>
                <p>
                  <strong className="text-neutral-300">Analytics:</strong> Cada play que monitoramos é salvo em segurança no Firestore garantindo estatísticas de seu Stremio sem expor seus dados pessoais do addon.
                </p>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}

// Simple internal React helper icons safely isolated
function ScrollLogsPlaceholder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}
