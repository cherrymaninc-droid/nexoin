import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/context/LanguageContext";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { GrainOverlay } from "@/components/GrainOverlay";
import Landing from "@/pages/Landing";
import Quote from "@/pages/Quote";

function App() {
  useSmoothScroll();
  return (
    <div className="App">
      <LanguageProvider>
        <BrowserRouter>
          <GrainOverlay />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/quote" element={<Quote />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#121212",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              borderRadius: 0,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
            },
          }}
        />
      </LanguageProvider>
    </div>
  );
}

export default App;
