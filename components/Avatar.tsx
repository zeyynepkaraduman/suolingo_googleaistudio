import React from 'react';
import { User, Mic, BrainCircuit, Volume2 } from 'lucide-react';
import { AvatarState } from '../types';

interface AvatarProps {
  state: AvatarState;
  scale?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ state, scale = 1 }) => {
  const isListening = state === AvatarState.LISTENING;
  const isSpeaking = state === AvatarState.SPEAKING;
  const isThinking = state === AvatarState.THINKING;
  const isActive = isSpeaking || isListening || isThinking;

  return (
    <div 
      className="relative flex items-center justify-center transition-all duration-300"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Outer Glow Ring */}
      <div className={`absolute inset-0 rounded-full border-4 transition-all duration-500 blur-md
        ${isSpeaking ? 'border-green-500/30 scale-125 opacity-100 animate-pulse' : 
          isListening ? 'border-red-500/30 scale-110 opacity-100' :
          isThinking ? 'border-blue-500/30 scale-110 opacity-100 animate-pulse' :
          'scale-100 opacity-0'
        }`}
      ></div>
      
      {/* Middle Ring */}
      <div className={`absolute inset-0 rounded-full border-2 transition-all duration-500
        ${isSpeaking ? 'border-green-400/50 scale-110' : 
          isListening ? 'border-red-400/50 scale-105' :
          isThinking ? 'border-blue-400/50 scale-105' :
          'scale-100 border-transparent'
        }`}
      ></div>

      {/* Core Avatar Circle */}
      <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl border relative z-10 overflow-hidden transition-colors duration-300
        ${isSpeaking ? 'border-green-500' : 
          isListening ? 'border-red-500' : 
          isThinking ? 'border-blue-500' : 'border-slate-700'
        }`}
      >
        {isListening ? (
           <Mic className="w-12 h-12 text-red-400 animate-bounce" />
        ) : isSpeaking ? (
           <Volume2 className="w-12 h-12 text-green-400 animate-pulse" />
        ) : isThinking ? (
           <BrainCircuit className="w-12 h-12 text-blue-400 animate-pulse" />
        ) : (
           <User className="w-12 h-12 text-slate-400" />
        )}
      </div>

      {/* Status Label */}
      <div className={`absolute -bottom-10 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-300
        ${isSpeaking ? 'bg-green-900/50 border-green-500/30 text-green-300 opacity-100' : 
          isListening ? 'bg-red-900/50 border-red-500/30 text-red-300 opacity-100' :
          isThinking ? 'bg-blue-900/50 border-blue-500/30 text-blue-300 opacity-100' :
          'opacity-0 translate-y-2'
        }`}
      >
        {isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Thinking'}
      </div>
    </div>
  );
};