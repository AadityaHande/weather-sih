"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAdditionalUserInfo } from "firebase/auth";
import {
  Mail,
  Lock,
  LogIn,
  UserPlus,
  ArrowRight,
  ShieldAlert,
  Compass,
  Layers,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// Configurable cycling map backgrounds with captions from public/map-imgs
export const MAP_BACKGROUNDS = [
  {
    id: "temp",
    title: "Surface Temperature",
    subtitle: "Realtime thermal isotherm & heat distribution",
    url: "/map-imgs/temp.png",
  },
  {
    id: "precipitation",
    title: "Doppler Precipitation",
    subtitle: "High-resolution rainfall reflectivity & storm tracks",
    url: "/map-imgs/precipitation.png",
  },
  {
    id: "wind",
    title: "Wind Vector Flow",
    subtitle: "Atmospheric streamlines, gusts & jet-stream vectors",
    url: "/map-imgs/wind.png",
  },
  {
    id: "humidity",
    title: "Relative Humidity",
    subtitle: "Tropospheric water vapor & atmospheric moisture",
    url: "/map-imgs/humidity.png",
  },
  {
    id: "pressure",
    title: "Sea-Level Pressure",
    subtitle: "Atmospheric isobars, cyclonic lows & high fronts",
    url: "/map-imgs/pressure.png",
  },
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // Cycling map index state
  const [activeMapIndex, setActiveMapIndex] = useState(0);

  const { loginWithEmail, signupWithEmail, loginWithGoogle, continueAsGuest } =
    useAuth();
  const router = useRouter();

  // Auto-cycle map background images every 5 seconds with smooth fade
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveMapIndex((prev) => (prev + 1) % MAP_BACKGROUNDS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoadingSubmit(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
        localStorage.setItem("mausam_onboarding_completed", "true");
        router.push("/home");
      } else {
        await signupWithEmail(email, password);
        router.push("/onboarding");
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.message?.replace("Firebase: ", "") ||
          "Authentication failed. Please check your credentials."
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const userCred = await loginWithGoogle();
      const additionalInfo = userCred ? getAdditionalUserInfo(userCred) : null;
      if (additionalInfo?.isNewUser) {
        router.push("/onboarding");
      } else {
        localStorage.setItem("mausam_onboarding_completed", "true");
        router.push("/home");
      }
    } catch (err: any) {
      console.error(err);
      setError("Google Sign-In failed. Please try again.");
    }
  };

  const handleGuestAccess = () => {
    continueAsGuest();
    const onboardingDone = localStorage.getItem("mausam_onboarding_completed") === "true";
    if (onboardingDone) {
      router.push("/home");
    } else {
      router.push("/onboarding");
    }
  };

  const currentMap = MAP_BACKGROUNDS[activeMapIndex];

  return (
    <main className="min-h-screen bg-slate-100/90 text-slate-900 font-sans selection:bg-sky-500 selection:text-white flex items-center justify-center p-4 sm:p-6 md:p-10 lg:p-12 relative overflow-hidden">
      {/* Background Decorative Ambient Gradients */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================================= */}
      {/* MAIN FLOATING AUTH BOX CONTAINER (WITH PADDING & MARGIN ON ALL SIDES)     */}
      {/* ========================================================================= */}
      <div className="w-full max-w-5xl xl:max-w-6xl bg-white border border-slate-200/90 rounded-3xl md:rounded-[32px] shadow-2xl shadow-slate-900/10 overflow-hidden flex flex-col md:flex-row min-h-[580px] md:min-h-[620px] relative z-10">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: AUTHENTICATION FORM (EXACT SCREENSHOT LAYOUT)               */}
        {/* ======================================================================= */}
        <div className="w-full md:w-[48%] lg:w-[44%] xl:w-[40%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative bg-white z-10">
          
          {/* Top Section: Logo & Form */}
          <div>
            {/* Logo */}
            <div
              className="flex items-center gap-2.5 mb-8 cursor-pointer group"
              onClick={() => router.push("/")}
            >
              <img
                src="/logo.png"
                alt="Mausam Logo"
                className="w-9 h-9 object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
              />
              <span className="font-black text-2xl tracking-tight text-slate-900">
                Mausam
              </span>
            </div>

            {/* Headline & Subtitle */}
            <div className="space-y-1 mb-8">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {isLogin ? "Sign in" : "Create account"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {isLogin
                  ? "Please sign in or create an account."
                  : "Join Mausam to personalize your weather experience."}
              </p>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in duration-200">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="space-y-3.5">
              {/* 1. Red Email Sign In Button */}
              {!showEmailForm ? (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full py-3.5 px-5 bg-[#d93829] hover:bg-[#c22e20] active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2.5 text-sm cursor-pointer"
                >
                  <Mail className="w-4 h-4 fill-white text-[#d93829]" />
                  <span>{isLogin ? "Sign in with email" : "Sign up with email"}</span>
                </button>
              ) : (
                /* Inline Email Form */
                <form onSubmit={handleSubmit} className="space-y-3 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-all text-xs font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loadingSubmit}
                    className="w-full py-3 bg-[#d93829] hover:bg-[#c22e20] active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                  >
                    {loadingSubmit ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isLogin ? (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign In</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* 2. Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer active:scale-[0.99]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              {/* 3. Toggle & Guest Mode */}
              <div className="pt-2 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setShowEmailForm(false);
                    setError(null);
                  }}
                  className="text-sky-600 hover:text-sky-800 font-bold transition-colors cursor-pointer"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>

                <button
                  type="button"
                  onClick={handleGuestAccess}
                  className="text-slate-500 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
                >
                  Continue as Guest →
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Legal Disclaimer */}
          <div className="mt-8 pt-4 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              By continuing, you are indicating that you accept our{" "}
              <a href="#" className="text-sky-600 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-sky-600 hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: DYNAMIC CYCLING MAP IMAGES (CROSS-FADING)                 */}
        {/* ======================================================================= */}
        <div className="hidden md:block flex-1 relative bg-slate-950 overflow-hidden">
          {/* Layered Map Images with Smooth Cross-Fade Animation */}
          {MAP_BACKGROUNDS.map((bg, idx) => {
            const isActive = activeMapIndex === idx;
            return (
              <div
                key={bg.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${
                  isActive ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
                }`}
                style={{
                  backgroundImage: `url(${bg.url})`,
                  transition: "opacity 1s ease-in-out, transform 8s ease-out",
                }}
              >
                {/* Subtle Gradient Shade */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-black/10" />
              </div>
            );
          })}

          {/* Top Right Dot Navigation */}
          <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {MAP_BACKGROUNDS.map((bg, idx) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setActiveMapIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  activeMapIndex === idx ? "bg-white w-5" : "bg-white/40 hover:bg-white/70"
                }`}
                title={bg.title}
              />
            ))}
          </div>

          {/* Bottom Left Map Caption Badge */}
          <div className="absolute bottom-6 left-6 z-20 max-w-sm">
            <div className="bg-white/95 backdrop-blur-md border border-white/70 px-4 py-2.5 rounded-2xl shadow-lg shadow-black/10 flex items-center gap-3 transition-all">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {currentMap.title}
                </p>
                <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                  {currentMap.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
