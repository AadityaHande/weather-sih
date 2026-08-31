"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  UserCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  deviceId: string;
  isGuest: boolean;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (e: string, p: string) => Promise<void>;
  loginWithGoogle: () => Promise<UserCredential>;
  logoutUser: () => Promise<void>;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string>("");
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Generate or fetch local device_id
    let storedId = localStorage.getItem("mausam_device_id");
    if (!storedId) {
      storedId = "dev_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("mausam_device_id", storedId);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setDeviceId(`usr_${currentUser.uid.substring(0, 12)}`);
        setIsGuest(false);
      } else {
        const guestFlag = localStorage.getItem("mausam_is_guest") === "true";
        setIsGuest(guestFlag);
        setDeviceId(storedId || "dev_guest_default");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      localStorage.setItem("mausam_is_guest", "false");
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      localStorage.setItem("mausam_is_guest", "false");
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      localStorage.setItem("mausam_is_guest", "false");
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    await signOut(auth);
    localStorage.removeItem("mausam_is_guest");
    setIsGuest(false);
  };

  const continueAsGuest = () => {
    localStorage.setItem("mausam_is_guest", "true");
    setIsGuest(true);
    let storedId = localStorage.getItem("mausam_device_id");
    if (!storedId) {
      storedId = "dev_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("mausam_device_id", storedId);
    }
    setDeviceId(storedId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        deviceId,
        isGuest,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        logoutUser,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
