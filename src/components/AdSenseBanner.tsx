import React, { useEffect, useState } from "react";
import { Sparkles, ShieldCheck, HelpCircle, Eye, RefreshCw, X } from "lucide-react";

interface AdSenseBannerProps {
  slot: string;
  client?: string; // Optional client prop, can fallback to environment variable or state config
  format?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
  responsive?: "true" | "false";
  style?: React.CSSProperties;
  className?: string;
  type?: "horizontal" | "vertical" | "square";
}

// Global list of beautiful, animated retro mock sponsors to display when AdSense isn't configured yet
const RETRO_SPONSORS = [
  {
    title: "DANDA ENERGY DRINK",
    tagline: "Unleash the ultimate strike force!",
    desc: "Premium carbonated nectar for master strikers. Get +50% hand-eye coordination.",
    cta: "FUEL UP",
    accent: "from-amber-500 to-orange-600",
    textAccent: "text-amber-400",
  },
  {
    title: "BRONZE GEAR CO.",
    tagline: "Forged by arcade champions",
    desc: "Custom-balanced danda sticks and heavy metallic gillis. Built to last 10,000 strikes.",
    cta: "UPGRADE NOW",
    accent: "from-amber-600 to-yellow-700",
    textAccent: "text-amber-500",
  },
  {
    title: "CHAMPION CLIPS",
    tagline: "Record your finest strikes",
    desc: "Share your high scores with the global Gilli community. Capture frame-perfect hits.",
    cta: "JOIN COMMUNITY",
    accent: "from-blue-600 to-indigo-700",
    textAccent: "text-blue-400",
  },
  {
    title: "ARCADE RETRO CLOUD",
    tagline: "Play old school games online",
    desc: "A sprawling library of pixel-perfect classics. Free forever, powered by open source.",
    cta: "EXPLORE",
    accent: "from-purple-600 to-pink-600",
    textAccent: "text-pink-400",
  }
];

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  slot,
  client = "",
  format = "auto",
  responsive = "true",
  style,
  className = "",
  type = "horizontal",
}) => {
  const [adBlockedOrEmpty, setAdBlockedOrEmpty] = useState(false);
  const [sponsorIdx, setSponsorIdx] = useState(0);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [actualClient, setActualClient] = useState(client);

  // Auto-rotate retro sponsors every 12 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSponsorIdx((prev) => (prev + 1) % RETRO_SPONSORS.length);
    }, 12000);
    return () => clearInterval(timer);
  }, []);

  // Check if we have AdSense credentials configured (via props, window config, or env)
  useEffect(() => {
    // Check local storage or environment variables for user's AdSense client ID
    let savedClient = localStorage.getItem("gilli_adsense_client") || import.meta.env.VITE_ADSENSE_CLIENT_ID || client || "ca-pub-2129877342025466";
    
    // Auto-prepend 'ca-' if the publisher ID is specified as 'pub-xxxxxxxxxxxx'
    if (savedClient && savedClient.startsWith("pub-")) {
      savedClient = "ca-" + savedClient;
    }
    
    setActualClient(savedClient || "");
    setIsLiveMode(!!savedClient && savedClient.startsWith("ca-pub-"));
  }, [client]);

  useEffect(() => {
    if (!isLiveMode || !actualClient) {
      setAdBlockedOrEmpty(true);
      return;
    }

    setAdBlockedOrEmpty(false);

    // 1. Inject the Google AdSense Script if it doesn't exist
    const scriptId = "google-adsense-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${actualClient}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    // 2. Push the ad to AdSense array on mount
    const loadAd = () => {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.warn("AdSense push failed (expected in local dev or if blocked):", err);
        setAdBlockedOrEmpty(true);
      }
    };

    // Small delay to allow element rendering and script loading
    const adTimer = setTimeout(loadAd, 300);

    return () => clearTimeout(adTimer);
  }, [isLiveMode, actualClient, slot]);

  // Dimensions based on type
  const getContainerStyles = () => {
    if (type === "vertical") {
      return "w-full min-h-[250px] md:min-h-[400px] flex flex-col justify-between";
    }
    if (type === "square") {
      return "w-full aspect-square min-h-[180px] flex flex-col justify-between";
    }
    // horizontal / banner - restrict to strict non-intrusive heights (50px to 90px max)
    return "w-full h-[64px] sm:h-[90px] max-h-[90px] flex flex-col justify-between";
  };

  const getInsStyles = (): React.CSSProperties => {
    if (type === "vertical") {
      return { display: "block", width: "100%", height: "100%", minHeight: "250px", ...style };
    }
    if (type === "square") {
      return { display: "block", width: "100%", height: "100%", minHeight: "180px", ...style };
    }
    // Strict horizontal styles: 50px high on mobile, up to 90px on tablet/desktop
    const computedHeight = typeof window !== "undefined" && window.innerWidth < 640 ? "50px" : "90px";
    return {
      display: "inline-block",
      width: "100%",
      height: computedHeight,
      maxHeight: computedHeight,
      minHeight: computedHeight,
      ...style,
    };
  };

  const sponsor = RETRO_SPONSORS[sponsorIdx];

  // For banners, we force the ad format to horizontal and full-width-responsive to false
  // to prevent AdSense from trying to fit large vertical cards or boxes on mobile viewports.
  const adFormat = type === "horizontal" ? "horizontal" : format;
  const adResponsive = type === "horizontal" ? "false" : responsive;

  return (
    <div 
      id={`ad-container-${slot}`}
      className={`relative overflow-hidden rounded-[20px] border transition-all duration-300 ${
        isLiveMode && !adBlockedOrEmpty
          ? "bg-slate-950 border-slate-900"
          : "bg-gradient-to-br from-slate-950 to-slate-900 border-slate-800 shadow-md"
      } ${getContainerStyles()} ${className}`}
      style={style}
    >
      {/* Real AdSense Slot */}
      {isLiveMode && !adBlockedOrEmpty && (
        <div className="w-full h-full flex items-center justify-center p-1 sm:p-2 overflow-hidden">
          <ins
            className="adsbygoogle"
            style={getInsStyles()}
            data-ad-client={actualClient}
            data-ad-slot={slot}
            data-ad-format={adFormat}
            data-full-width-responsive={adResponsive}
          />
        </div>
      )}

      {/* Retro Arcade Sponsor Placeholder (Shows when not configured or blocked) */}
      {(adBlockedOrEmpty || !isLiveMode) && (
        <div className="w-full h-full p-2.5 sm:p-3 flex flex-col justify-between text-left select-none relative group h-full">
          {/* Grid decorative overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.25)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

          {/* Glowing subtle ambient circle */}
          <div className={`absolute -right-12 -bottom-12 w-32 h-32 rounded-full bg-gradient-to-r ${sponsor.accent} opacity-10 blur-xl transition-all duration-700 group-hover:scale-125`} />

          {type === "vertical" ? (
            <div className="flex-1 flex flex-col justify-between h-full z-10">
              <div className="space-y-2 mt-1">
                <h4 className={`text-sm md:text-base font-mono font-black tracking-widest ${sponsor.textAccent} uppercase leading-tight`}>
                  {sponsor.title}
                </h4>
                <p className="text-[9px] font-mono font-bold text-slate-300 uppercase leading-none">
                  {sponsor.tagline}
                </p>
                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                  {sponsor.desc}
                </p>
              </div>

              <div className="pt-4 mt-auto">
                <button className={`w-full py-2 px-3 text-[10px] font-mono font-black tracking-widest uppercase rounded-lg bg-gradient-to-r ${sponsor.accent} text-slate-950 shadow-md transform hover:scale-102 active:scale-98 transition-all`}>
                  {sponsor.cta}
                </button>
                <p className="text-[7px] text-center text-slate-600 font-mono mt-1.5">
                  Ready for AdSense. Add your slot ID in Settings.
                </p>
              </div>
            </div>
          ) : type === "square" ? (
            <div className="flex-1 flex flex-col justify-between h-full z-10">
              <div className="space-y-1 mt-1">
                <h4 className={`text-xs md:text-sm font-mono font-black tracking-widest ${sponsor.textAccent} uppercase leading-tight`}>
                  {sponsor.title}
                </h4>
                <p className="text-[10px] text-slate-400 font-sans leading-relaxed line-clamp-3">
                  {sponsor.desc}
                </p>
              </div>

              <div className="mt-auto">
                <button className={`w-full py-1.5 px-2.5 text-[9px] font-mono font-black tracking-widest uppercase rounded-lg bg-gradient-to-r ${sponsor.accent} text-slate-950 shadow-sm transition-all`}>
                  {sponsor.cta}
                </button>
              </div>
            </div>
          ) : (
            // Horizontal banner layout
            <div className="flex-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 z-10 w-full h-full mt-1">
              <div className="space-y-0.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <h4 className={`text-xs md:text-sm font-mono font-black tracking-widest ${sponsor.textAccent} uppercase leading-none`}>
                    {sponsor.title}
                  </h4>
                  <span className="text-[8px] font-sans text-slate-500 hidden sm:inline">•</span>
                  <span className="text-[9px] font-mono font-bold text-slate-300 uppercase leading-none hidden sm:inline">
                    {sponsor.tagline}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-sans leading-snug line-clamp-2 md:line-clamp-1">
                  {sponsor.desc}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2 self-end md:self-auto">
                <span className="text-[7px] text-right text-slate-600 font-mono hidden lg:block leading-none">
                  AD SLOT:<br />{slot}
                </span>
                <button className={`py-1.5 px-3 text-[9px] font-mono font-black tracking-widest uppercase rounded-lg bg-gradient-to-r ${sponsor.accent} text-slate-950 shadow-md hover:opacity-90 active:scale-95 transition-all`}>
                  {sponsor.cta}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Config panel allowing instant setup of AdSense publisher ID and ads directly in the game UI!
interface MonetizationConfigPanelProps {
  onClose: () => void;
}

export const MonetizationConfigPanel: React.FC<MonetizationConfigPanelProps> = ({ onClose }) => {
  const [clientId, setClientId] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gilli_adsense_client") || "";
    setClientId(saved);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = clientId.trim();
    if (cleanId === "") {
      localStorage.removeItem("gilli_adsense_client");
    } else {
      localStorage.setItem("gilli_adsense_client", cleanId);
    }
    setIsSaved(true);
    soundPlaySuccess();
    setTimeout(() => {
      setIsSaved(false);
      onClose();
      // Reload page to apply new client script to window
      window.location.reload();
    }, 1500);
  };

  const soundPlaySuccess = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  };

  return (
    <div className="p-5 space-y-4 font-mono text-left text-slate-300">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest">
            AdSense Monetization
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded bg-slate-900 border border-slate-800 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
        Earn money by displaying Google AdSense ads inside the header, sidebars, and overlays. Enter your publisher client ID below to activate live monetization.
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase block">
            AdSense Publisher ID (ca-pub-xxx)
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. ca-pub-1234567890123456"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-700 focus:outline-none focus:border-amber-500 uppercase"
          />
        </div>

        <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1.5 font-sans">
          <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>HOW TO COMPLETE MONETIZATION</span>
          </div>
          <ol className="list-decimal list-inside text-[9.5px] text-slate-400 space-y-1 leading-relaxed">
            <li>Save your publisher client ID above.</li>
            <li>Connect your custom domain (such as <span className="text-slate-300 font-mono font-bold text-[9px]">gilli-arcade.com</span>) in your hosting dashboard.</li>
            <li>Add your domain name inside your Google AdSense console and paste the ads.txt file if requested.</li>
          </ol>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold transition-all cursor-pointer hover:bg-slate-850"
          >
            CANCEL
          </button>
          <button
            type="submit"
            className="flex-1 py-2 rounded-lg bg-amber-500 text-slate-950 font-black text-xs tracking-wider transition-all hover:bg-amber-400 cursor-pointer shadow-md shadow-amber-500/10"
          >
            {isSaved ? "SAVED!" : "SAVE & ACTIVATE"}
          </button>
        </div>
      </form>
    </div>
  );
};
