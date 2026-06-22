/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./lib/firebase.js";
import AuthScreen from "./components/AuthScreen.js";
import AddonConfigurator from "./components/AddonConfigurator.js";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setUser(null);
    } catch (e) {
      console.error("Failed to sign out user:", e);
    }
  };

  if (loading) {
    return (
      <div id="app-loading-container" className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center font-sans text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          {/* Elegant customized progress ring */}
          <div className="w-12 h-12 border-4 border-neutral-800 border-t-purple-500 rounded-full animate-spin" />
          <span className="mt-4 text-xs font-semibold uppercase tracking-widest text-neutral-500 animate-pulse">
            Carregando Hub...
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 min-h-screen overflow-x-hidden text-neutral-100">
      <AnimatePresence mode="wait">
        {user ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AddonConfigurator user={user} onLogout={handleLogout} />
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AuthScreen onAuthSuccess={(usr) => setUser(usr)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
