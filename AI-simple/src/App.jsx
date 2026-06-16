import { useEffect, useRef, useState } from "react";
import { requestToGroqAI } from "./utils/groq";

const sanitizeAIText = (text) => {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^[\s*_=-]{3,}$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .trim();
};

const renderInlineText = (text, darkMode, keyPrefix) => {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded-md text-sm"
          style={{
            backgroundColor: darkMode ? "rgba(15, 23, 42, 0.9)" : "#eef2ff",
            color: darkMode ? "#e0e7ff" : "#4338ca",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
};

const renderTextLines = (text, darkMode, keyPrefix) => {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .map((line, index) => {
      const key = `${keyPrefix}-line-${index}`;
      const heading = line.match(/^#{1,3}\s+(.+)/);
      const bullet = line.match(/^[-*]\s+(.+)/);
      const numbered = line.match(/^(\d+)\.\s+(.+)/);

      if (heading) {
        return (
          <h3 key={key} className="mt-4 first:mt-0 text-base font-semibold">
            {renderInlineText(heading[1], darkMode, key)}
          </h3>
        );
      }

      if (bullet) {
        return (
          <div key={key} className="flex gap-2">
            <span className={darkMode ? "text-purple-300" : "text-purple-600"}>•</span>
            <p>{renderInlineText(bullet[1], darkMode, key)}</p>
          </div>
        );
      }

      if (numbered) {
        return (
          <div key={key} className="flex gap-2">
            <span className={`min-w-6 font-semibold ${darkMode ? "text-purple-300" : "text-purple-600"}`}>
              {numbered[1]}.
            </span>
            <p>{renderInlineText(numbered[2], darkMode, key)}</p>
          </div>
        );
      }

      return (
        <p key={key}>
          {renderInlineText(line.replace(/^>\s?/, ""), darkMode, key)}
        </p>
      );
    });
};

const renderAIResponse = (text, darkMode) => {
  return sanitizeAIText(text).split(/(```[\s\S]*?```)/g).filter(Boolean).map((segment, index) => {
    const key = `ai-response-${index}`;

    if (segment.startsWith("```") && segment.endsWith("```")) {
      const code = segment.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, "").trim();

      return (
        <pre
          key={key}
          className="my-3 overflow-x-auto rounded-2xl p-4 text-sm"
          style={{
            backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
            border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`,
            color: darkMode ? "#e2e8f0" : "#1f2937",
          }}
        >
          <code>{code}</code>
        </pre>
      );
    }

    return (
      <div key={key} className="space-y-3">
        {renderTextLines(segment, darkMode, key)}
      </div>
    );
  });
};

function App() {
  const [userInput, setUserInput] = useState("");
  const [history, setHistory] = useState([]);
  const [responseMode, setResponseMode] = useState("simple");
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, loading]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setFileContent({ name: file.name, content: text });
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!userInput.trim() && !fileContent) return;

    setLoading(true);

    const submittedInput = userInput;
    const submittedFile = fileContent;
    const submittedMode = responseMode;

    let prompt = submittedInput;
    if (submittedFile) {
      prompt += `\n\nBerikut isi file (${submittedFile.name}):\n${submittedFile.content}`;
    }

    const pendingEntry = {
      user: submittedInput || `Upload file: ${submittedFile?.name}`,
      file: submittedFile,
      ai: "",
      mode: submittedMode,
      createdAt: new Date().toLocaleTimeString(),
      loading: true,
    };

    setHistory((prev) => [...prev, pendingEntry]);
    setUserInput("");
    setFileContent(null);

    const aiOutput = await requestToGroqAI(prompt, submittedMode, history);

    setHistory((prev) =>
      prev.map((item, index) =>
        index === prev.length - 1 && item.loading
          ? { ...item, ai: aiOutput, loading: false }
          : item
      )
    );
    setLoading(false);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const copyResponse = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Failed to copy response:", error);
    }
  };

  return (
    <div>
      {/* Import Tailwind CSS */}
      <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet" />
      
      <div className={`min-h-screen transition-all duration-500 ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`} style={{
        background: darkMode 
          ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' 
          : 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #f1f5f9 100%)'
      }}>
        
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute w-96 h-96 rounded-full blur-3xl opacity-30"
            style={{
              top: '-50%',
              right: '-50%',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              animation: 'pulse 4s ease-in-out infinite'
            }}
          ></div>
          <div 
            className="absolute w-96 h-96 rounded-full blur-3xl opacity-30"
            style={{
              bottom: '-50%',
              left: '-50%',
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              animation: 'pulse 4s ease-in-out infinite 2s'
            }}
          ></div>
          <div 
            className="absolute w-32 h-32 rounded-full blur-2xl opacity-20"
            style={{
              top: '25%',
              left: '33%',
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              animation: 'bounce 6s ease-in-out infinite'
            }}
          ></div>
        </div>

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div 
            className="h-full backdrop-blur-xl border-r shadow-2xl"
            style={{
              backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: darkMode ? '#475569' : '#e2e8f0'
            }}
          >
            <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${darkMode ? '#475569' : '#e2e8f0'}` }}>
              <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Pengaturan</h2>
              <button 
                onClick={() => setSidebarOpen(false)}
                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Theme Toggle */}
              <div className="space-y-3">
                <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tampilan</h3>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: darkMode ? '#475569' : '#f1f5f9'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = darkMode ? '#334155' : '#e2e8f0'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = darkMode ? '#475569' : '#f1f5f9'}
                >
                  <span className={`${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {darkMode ? 'Mode gelap' : 'Mode terang'}
                  </span>
                  <div 
                    className="w-12 h-6 rounded-full relative transition-colors"
                    style={{ backgroundColor: darkMode ? '#8b5cf6' : '#3b82f6' }}
                  >
                    <div 
                      className="w-4 h-4 bg-white rounded-full absolute top-1 transition-transform"
                      style={{ transform: darkMode ? 'translateX(28px)' : 'translateX(4px)' }}
                    ></div>
                  </div>
                </button>
              </div>

              {/* Statistics */}
              <div className="space-y-3">
                <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Statistik</h3>
                <div 
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: darkMode ? '#475569' : '#f1f5f9' }}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total chat</span>
                      <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{history.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>File diunggah</span>
                      <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{history.filter(h => h.file).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Aksi cepat</h3>
                <div className="space-y-2">
                  <button 
                    onClick={clearHistory}
                    className="w-full p-3 rounded-lg text-white transition-colors flex items-center gap-2"
                    style={{ backgroundColor: '#dc2626' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus semua riwayat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 lg:hidden"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-80' : ''}`}>
          {/* Header */}
          <header 
            className="backdrop-blur-xl border-b sticky top-0 z-30"
            style={{
              backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: darkMode ? '#475569' : '#e2e8f0'
            }}
          >
            <div className="flex items-center justify-between p-3 sm:p-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <h1 className={`text-xl sm:text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  <span 
                    style={{
                      background: 'linear-gradient(45deg, #8b5cf6, #ec4899, #06b6d4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'pulse 2s ease-in-out infinite'
                    }}
                  >
                    REXTEK AI
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: loading ? '#eab308' : '#22c55e',
                    animation: loading ? 'pulse 1s ease-in-out infinite' : 'none'
                  }}
                ></div>
                <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {loading ? 'Menjawab...' : 'Siap'}
                </span>
              </div>
            </div>
          </header>

          <main
            className={`flex flex-col items-center justify-start min-h-screen ${darkMode ? 'text-white' : 'text-gray-800'} px-3 sm:px-6 pt-5 sm:pt-10 pb-4 relative`}
            style={{ minHeight: 'calc(100dvh - 64px)' }}
          >
            {/* Hero Section */}
            {history.length === 0 && (
              <div className="order-1 text-center mb-4 sm:mb-8 px-2" style={{ animation: 'fadeIn 0.6s ease-out' }}>
                <h2 className="text-4xl sm:text-6xl font-bold mb-4 sm:mb-6">
                  <span 
                    style={{
                      background: 'linear-gradient(45deg, #a855f7, #ec4899, #06b6d4)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'pulse 3s ease-in-out infinite'
                    }}
                  >
                    Halo, aku siap bantu.
                  </span>
                </h2>
                <p className={`text-base sm:text-xl ${darkMode ? 'text-gray-300' : 'text-gray-600'} max-w-2xl mx-auto leading-relaxed`}>
                  Ceritakan kebutuhanmu dengan bebas. Aku akan menjawab dengan lebih hangat, jelas, dan tertata.
                </p>
                <div className="flex justify-center gap-2 sm:gap-4 mt-5 sm:mt-8 flex-wrap">
                  <div 
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                      borderColor: darkMode ? '#8b5cf6' : '#8b5cf6'
                    }}
                  >
                    <span className="text-sm">Chat interaktif</span>
                  </div>
                  <div 
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      borderColor: darkMode ? '#3b82f6' : '#3b82f6'
                    }}
                  >
                    <span className="text-sm">Upload file</span>
                  </div>
                  <div 
                    className="px-4 py-2 rounded-full border"
                    style={{
                      backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                      borderColor: darkMode ? '#22c55e' : '#22c55e'
                    }}
                  >
                    <span className="text-sm">Respons cepat</span>
                  </div>
                </div>
              </div>
            )}

            {/* Input Form */}
            <div 
              className="order-3 sticky bottom-2 sm:bottom-5 z-30 w-full max-w-4xl backdrop-blur-xl p-3 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl border"
              style={{
                backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.94)',
                borderColor: darkMode ? '#475569' : '#e2e8f0',
                marginBottom: 'env(safe-area-inset-bottom)',
                animation: 'slideUp 0.5s ease-out'
              }}
            >
              <div className="space-y-3 sm:space-y-4">
                {/* Main Input */}
                <div className="flex gap-2 sm:gap-3 flex-col sm:flex-row">
                  <div className="flex-1 relative">
                    <textarea
                      placeholder="Tulis pertanyaan atau ceritakan yang ingin dibantu..."
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      rows={2}
                      className="w-full min-h-20 sm:min-h-28 max-h-40 resize-none p-3 sm:p-4 pr-11 sm:pr-12 rounded-xl sm:rounded-2xl border-2 outline-none transition-all duration-300 text-sm sm:text-base"
                      style={{
                        backgroundColor: darkMode ? 'rgba(71, 85, 105, 0.5)' : '#f8fafc',
                        color: darkMode ? '#ffffff' : '#1f2937',
                        borderColor: darkMode ? '#64748b' : '#d1d5db',
                        minHeight: '5rem',
                        maxHeight: '10rem',
                        '::placeholder': { color: darkMode ? '#9ca3af' : '#6b7280' }
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                      onBlur={(e) => e.target.style.borderColor = darkMode ? '#64748b' : '#d1d5db'}
                    />
                    {userInput && (
                      <button
                        onClick={() => setUserInput("")}
                        className={`absolute right-3 top-3 sm:top-4 transition-colors ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || (!userInput.trim() && !fileContent)}
                    className="w-full sm:w-auto sm:min-w-28 px-5 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    style={{
                      background: 'linear-gradient(45deg, #8b5cf6, #ec4899)',
                      transform: 'scale(1)',
                      boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)'
                    }}
                    onMouseEnter={(e) => !e.target.disabled && (e.target.style.transform = 'scale(1.05)')}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          style={{ animation: 'spin 1s linear infinite' }}
                        ></div>
                        <span>Menjawab</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Kirim</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* File Upload & Options Row */}
                <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                  {/* File Upload */}
                  <div className="flex-1">
                    <label 
                      className="block w-full p-3 sm:p-4 border-2 border-dashed rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-300 group"
                      style={{
                        borderColor: darkMode ? '#64748b' : '#d1d5db',
                        backgroundColor: darkMode ? 'rgba(71, 85, 105, 0.3)' : '#f8fafc'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = darkMode ? '#475569' : '#9ca3af';
                        e.target.style.backgroundColor = darkMode ? 'rgba(71, 85, 105, 0.5)' : '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = darkMode ? '#64748b' : '#d1d5db';
                        e.target.style.backgroundColor = darkMode ? 'rgba(71, 85, 105, 0.3)' : '#f8fafc';
                      }}
                    >
                      <input
                        type="file"
                        accept=".txt,.md,.json,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-3 text-center">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                          style={{ backgroundColor: darkMode ? '#64748b' : '#e2e8f0' }}
                        >
                          <svg className={`w-5 h-5 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </div>
                        <div>
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                            {fileContent ? fileContent.name : 'Upload file'}
                          </p>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {fileContent ? 'Klik untuk ganti file' : 'TXT, MD, JSON, CSV'}
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Response Mode */}
                  <div 
                    className="lg:w-80 p-3 sm:p-4 rounded-xl sm:rounded-2xl border"
                    style={{
                      backgroundColor: darkMode ? 'rgba(71, 85, 105, 0.3)' : '#f8fafc',
                      borderColor: darkMode ? '#64748b' : '#d1d5db'
                    }}
                  >
                    <p className={`text-sm font-medium mb-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Mode Respon</p>
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="radio"
                          value="simple"
                          checked={responseMode === "simple"}
                          onChange={(e) => setResponseMode(e.target.value)}
                          className="sr-only"
                        />
                        <div 
                          className="p-3 rounded-xl text-center cursor-pointer transition-all duration-300"
                          style={{
                            background: responseMode === 'simple' 
                              ? 'linear-gradient(45deg, #3b82f6, #06b6d4)' 
                              : (darkMode ? '#64748b' : '#e5e7eb'),
                            color: responseMode === 'simple' ? '#ffffff' : (darkMode ? '#d1d5db' : '#374151')
                          }}
                        >
                          <div className="text-sm font-semibold">Simple</div>
                        </div>
                      </label>
                      <label className="flex-1">
                        <input
                          type="radio"
                          value="detailed"
                          checked={responseMode === "detailed"}
                          onChange={(e) => setResponseMode(e.target.value)}
                          className="sr-only"
                        />
                        <div 
                          className="p-3 rounded-xl text-center cursor-pointer transition-all duration-300"
                          style={{
                            background: responseMode === 'detailed' 
                              ? 'linear-gradient(45deg, #8b5cf6, #ec4899)' 
                              : (darkMode ? '#64748b' : '#e5e7eb'),
                            color: responseMode === 'detailed' ? '#ffffff' : (darkMode ? '#d1d5db' : '#374151')
                          }}
                        >
                          <div className="text-sm font-semibold">Detailed</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* History Chat */}
            <div className="order-2 w-full max-w-4xl flex-1 mt-4 sm:mt-6 space-y-4 sm:space-y-6 pb-4">
              {history.map((item, index) => (
                <div 
                  key={index} 
                  className="group backdrop-blur-xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border transition-all duration-300"
                  style={{
                    backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                    borderColor: darkMode ? '#475569' : '#e2e8f0',
                    animation: 'slideUp 0.5s ease-out',
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'both'
                  }}
                  onMouseEnter={(e) => e.target.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.25)'}
                  onMouseLeave={(e) => e.target.style.boxShadow = '0 20px 25px rgba(0, 0, 0, 0.1)'}
                >
                  {/* User Message */}
                  <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(45deg, #3b82f6, #06b6d4)' }}
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className={`font-semibold ${darkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>You</span>
                      <div 
                        className="px-2 py-1 rounded-lg text-xs"
                        style={{
                          backgroundColor: darkMode ? '#475569' : '#f1f5f9',
                          color: darkMode ? '#d1d5db' : '#6b7280'
                        }}
                      >
                        {item.createdAt}
                      </div>
                    </div>
                    <p className={`${darkMode ? 'text-gray-100' : 'text-gray-800'} leading-relaxed pl-0 sm:pl-11 break-words`}>{item.user}</p>

                    {/* File Preview */}
                    {item.file && (
                      <div 
                        className="mt-4 ml-0 sm:ml-11 p-3 sm:p-4 rounded-xl sm:rounded-2xl border"
                        style={{
                          backgroundColor: darkMode ? 'rgba(71, 85, 105, 0.5)' : '#f1f5f9',
                          borderColor: darkMode ? '#64748b' : '#d1d5db'
                        }}
                      >
                        <details className="group/file">
                          <summary className={`cursor-pointer flex items-center gap-2 transition-colors ${darkMode ? 'text-yellow-400 hover:text-yellow-300' : 'text-yellow-600 hover:text-yellow-700'}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="font-medium">{item.file.name}</span>
                            <svg className="w-4 h-4 transition-transform group-open/file:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <pre 
                            className="mt-3 p-3 rounded-xl text-sm whitespace-pre-wrap max-h-60 overflow-y-auto border font-mono"
                            style={{
                              backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                              borderColor: darkMode ? '#64748b' : '#e2e8f0',
                              color: darkMode ? '#d1d5db' : '#374151'
                            }}
                          >
                            {item.file.content}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>

                  {/* AI Response */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ 
                          background: 'linear-gradient(45deg, #8b5cf6, #ec4899)',
                          animation: 'pulse 2s ease-in-out infinite'
                        }}
                      >
                        <span className="text-white text-sm">AI</span>
                      </div>
                      <span className={`font-semibold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>REXTEK AI</span>
                      <div 
                        className="px-2 py-1 rounded-lg text-xs"
                        style={{
                          backgroundColor: darkMode ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.1)',
                          color: darkMode ? '#c4b5fd' : '#7c3aed'
                        }}
                      >
                        {item.mode === 'detailed' ? 'Detailed' : 'Simple'}
                      </div>
                    </div>
                    <div className={`${darkMode ? 'text-gray-100' : 'text-gray-800'} leading-relaxed pl-0 sm:pl-11 space-y-3 break-words`}>
                      {item.loading ? (
                        <div className={`flex items-center gap-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: darkMode ? '#c4b5fd' : '#7c3aed',
                              animation: 'pulse 1s ease-in-out infinite',
                            }}
                          ></span>
                          <span>Sedang menyusun jawaban yang tepat...</span>
                        </div>
                      ) : (
                        renderAIResponse(item.ai, darkMode)
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div 
                    className="flex items-center justify-end gap-2 mt-4 pt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ borderTop: `1px solid ${darkMode ? 'rgba(71, 85, 105, 0.5)' : 'rgba(229, 231, 235, 0.5)'}` }}
                  >
                    <button
                      onClick={() => copyResponse(item.ai)}
                      disabled={item.loading}
                      title="Salin jawaban"
                      className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${darkMode ? 'hover:bg-slate-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="order-2 mt-4 sm:mt-8 mb-2 text-center">
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  REXTEK AI | {history.length} percakapan
                </p>
              </div>
            )}
            <div ref={chatEndRef} className="order-2 h-2" />
          </main>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @keyframes bounce {
            0%, 100% {
              transform: translateY(-25%);
              animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
            }
            50% {
              transform: translateY(0);
              animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
            }
          }
          
          .animate-fade-in {
            animation: fadeIn 0.6s ease-out;
          }
          
          .animate-slide-up {
            animation: slideUp 0.5s ease-out forwards;
          }

          input::placeholder,
          textarea::placeholder {
            color: ${darkMode ? '#9ca3af' : '#6b7280'};
          }
        `}</style>
      </div>
    </div>
  );
}

export default App;
