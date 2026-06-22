/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase.js";
import { Tv, Play, ChevronRight, AlertCircle, Shield, KeySquare } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onAuthSuccess(result.user);
    } catch (err: any) {
      console.error(err);
      setError("Falha ao entrar com a conta do Google. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (!email || !password) {
      setError("Insira o e-mail e a senha.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        onAuthSuccess(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(result.user);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este endereço de e-mail já está em uso.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha deve conter no mínimo 6 caracteres.");
      } else {
        setError("Ocorreu um erro na autenticação. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-container" className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center px-4 py-12 text-white relative overflow-hidden font-sans">
      {/* Decorative ambient background lights */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-900/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-900/15 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-neutral-900/80 border border-neutral-800/80 p-8 rounded-3xl shadow-2xl backdrop-blur-md z-10"
      >
        <div className="flex flex-col items-center mb-8 text-center" id="auth-header">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4">
            <Tv className="w-9 h-9 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-200 via-white to-indigo-200 bg-clip-text text-transparent">
            Stremio Firebase Addon
          </h1>
          <p className="text-neutral-400 text-sm mt-2 max-w-xs">
            Curadoria inteligente com IA e sincronização do seu catálogo em tempo real.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-950/40 border border-red-900/40 text-red-300 text-sm rounded-xl flex items-start gap-3"
            id="auth-error-banner"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4" id="auth-form">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 px-4 py-3 text-sm transition-colors duration-200"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5">
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-950 text-white rounded-xl border border-neutral-800 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 px-4 py-3 text-sm transition-colors duration-200"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            id="btn-auth-submit"
            className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.99] text-white py-3 rounded-xl font-medium shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isRegister ? "Criar Conta" : "Entrar no Painel"}</span>
                <Play className="w-4 h-4 text-purple-200 fill-purple-200" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6" id="auth-divider">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-neutral-900 px-3 text-neutral-500 font-medium tracking-widest">
              Ou
            </span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          id="btn-google-login"
          className="w-full bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-200 py-3 rounded-xl font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Acessar com Google</span>
        </button>

        <div className="mt-6 text-center" id="auth-switch-mode">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
          >
            {isRegister
              ? "Já possui uma conta? Faça login"
              : "Novo por aqui? Crie seu catálogo agora"}
          </button>
        </div>
      </motion.div>

      {/* Trust and safety details footer */}
      <div className="mt-8 flex items-center justify-center gap-2 text-neutral-500 text-xs text-center relative z-10" id="auth-footer-caption">
        <Shield className="w-4 h-4 text-neutral-600" />
        <span>Autenticado de forma 100% segura usando o Google Firebase Services</span>
      </div>
    </div>
  );
}
