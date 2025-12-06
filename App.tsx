import React, { useState } from 'react';
import { TranscribeView } from './views/TranscribeView';
import { TTSView } from './views/TTSView';
import { LiveView } from './views/LiveView';
import { ViewMode, AvatarState } from './types';
import { Mic, MessageSquareText, Radio, Languages } from 'lucide-react';
import { Avatar } from './components/Avatar';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIVE);
  const [avatarState, setAvatarState] = useState<AvatarState>(AvatarState.IDLE);
  
  // Shared state to allow STT to feed into TTS
  const [sharedText, setSharedText] = useState('');

  const handleTranscribeComplete = (text: string) => {
    setSharedText(text);
    // Optionally auto-switch to TTS if user wants to hear it back immediately?
    // For now we just store it so if they switch tab, it's there.
  };

  const renderContent = () => {
    switch (viewMode) {
      case ViewMode.TRANSCRIBE:
        return <TranscribeView setAvatarState={setAvatarState} onTranscriptionComplete={handleTranscribeComplete} />;
      case ViewMode.TTS:
        return <TTSView setAvatarState={setAvatarState} initialText={sharedText} />;
      case ViewMode.LIVE:
        return <LiveView setAvatarState={setAvatarState} />;
      default:
        return <LiveView setAvatarState={setAvatarState} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* Top Header / Avatar Section - Always Visible */}
      <div className="flex-none pt-8 pb-4 flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/50 z-10 shadow-xl">
         <div className="absolute top-4 left-4 flex items-center space-x-2 opacity-50">
            <Languages className="w-5 h-5 text-green-400" />
            <span className="font-bold tracking-widest text-xs">SUOLINGO</span>
         </div>

         {/* The Central Avatar */}
         <div className="my-2 scale-90 md:scale-100 transition-transform">
            <Avatar state={avatarState} />
         </div>

         {/* Mode Indicator */}
         <div className="mt-4 flex items-center space-x-1 bg-slate-900/50 p-1 rounded-full border border-slate-800 backdrop-blur-sm">
            {[ViewMode.LIVE, ViewMode.TRANSCRIBE, ViewMode.TTS].map((mode) => {
                const isActive = viewMode === mode;
                let Icon = Radio;
                let label = "Live";
                if (mode === ViewMode.TRANSCRIBE) { Icon = Mic; label = "Listen"; }
                if (mode === ViewMode.TTS) { Icon = MessageSquareText; label = "Speak"; }

                return (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`
                            px-4 py-1.5 rounded-full text-xs font-bold flex items-center space-x-2 transition-all duration-300
                            ${isActive 
                                ? 'bg-slate-700 text-white shadow-lg' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                            }
                        `}
                    >
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                    </button>
                );
            })}
         </div>
      </div>

      {/* Main Content Area - Swaps based on mode */}
      <main className="flex-1 relative w-full max-w-2xl mx-auto p-4 md:p-6 overflow-hidden flex flex-col">
         {/* Background Decoration */}
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
         
         {/* Dynamic View Container */}
         <div className="relative z-10 flex-1 flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-300 key={viewMode}">
            {renderContent()}
         </div>
      </main>

    </div>
  );
};

export default App;