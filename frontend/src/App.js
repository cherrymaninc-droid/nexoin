import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { GrainOverlay } from "@/components/GrainOverlay";
import Landing from "@/pages/Landing";
import Quote from "@/pages/Quote";
import Contact from "@/pages/Contact";
import Admin from "@/pages/Admin";

function App() {
  useSmoothScroll();
  return (
    <div className="App">
      <LanguageProvider>
        <SettingsProvider>
          <BrowserRouter>
            <GrainOverlay />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/quote" element={<Quote />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            theme="light"
            toastOptions={{
              style: {
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.1)",
                color: "#0a0a0a",
                borderRadius: 0,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "12px",
              },
            }}
          />
        </SettingsProvider>
      </LanguageProvider>
    </div>
  );
}

export default App;
