import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Power, Radio, AlertTriangle } from 'lucide-react';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import { AvatarState } from '../types';

interface LiveViewProps {
  setAvatarState: (state: AvatarState) => void;
}

export const LiveView: React.FC<LiveViewProps> = ({ setAvatarState }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return () => handleDisconnect();
  }, []);

  const handleConnect = async () => {
    setError(null);
    try {
      if (!aiRef.current) return;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use the stable 'gemini-2.5-flash' model which supports Live API and is widely available
      const sessionPromise = aiRef.current.live.connect({
        model: 'gemini-2.5-flash',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setAvatarState(AvatarState.LISTENING);
            setupAudioInput(inputCtx, stream, sessionPromise);
          },
          onmessage: (msg: LiveServerMessage) => handleMessage(msg, outputCtx),
          onclose: () => {
            setIsConnected(false);
            setAvatarState(AvatarState.IDLE);
          },
          onerror: (err: any) => {
            console.error('Live session error:', err);
            setError("Connection Error: Unable to connect to Live API. Please try again.");
            handleDisconnect();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are Suolingo, a helpful and friendly Turkish language tutor.",
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Connection failed:", err);
      setError("Could not access microphone or connect to API.");
      setAvatarState(AvatarState.IDLE);
    }
  };

  const setupAudioInput = (ctx: AudioContext, stream: MediaStream, sessionPromise: Promise<any>) => {
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (!isMicOn) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromise.then(session => {
        session.sendRealtimeInput({ media: pcmBlob });
      }).catch(() => {
        // Suppress errors during stream if session closed
      });
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    sourceRef.current = source;
    processorRef.current = processor;
  };

  const handleMessage = async (message: LiveServerMessage, ctx: AudioContext) => {
    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      setAvatarState(AvatarState.SPEAKING);
      try {
        const audioBytes = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
        
        const now = ctx.currentTime;
        const startTime = Math.max(now, nextStartTimeRef.current);
        nextStartTimeRef.current = startTime + audioBuffer.duration;

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        source.onended = () => {
            activeSourcesRef.current.delete(source);
            if (activeSourcesRef.current.size === 0) setAvatarState(AvatarState.LISTENING);
        };

        source.start(startTime);
        activeSourcesRef.current.add(source);
      } catch (e) {
        console.error("Error decoding/playing audio:", e);
      }
    }

    if (message.serverContent?.interrupted) {
      activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e) {} });
      activeSourcesRef.current.clear();
      nextStartTimeRef.current = ctx.currentTime;
      setAvatarState(AvatarState.LISTENING);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAvatarState(AvatarState.IDLE);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    sessionPromiseRef.current = null;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl text-center max-w-sm flex flex-col items-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-1" />
            <span className="font-bold">Connection Failed</span>
            <span className="text-sm opacity-80">{error}</span>
        </div>
      )}

      {/* Connection Controls */}
      <div className="flex items-center space-x-6">
        {!isConnected ? (
           <button
             onClick={handleConnect}
             className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold shadow-lg shadow-green-600/20 transition-all hover:scale-105"
           >
             <Power className="w-5 h-5" />
             <span>Start Conversation</span>
           </button>
        ) : (
            <>
                <div className="flex flex-col items-center space-y-2">
                    <span className="text-xs text-green-400 font-bold tracking-wider animate-pulse">LIVE CONNECTED</span>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setIsMicOn(!isMicOn)}
                            className={`p-4 rounded-full transition-all border ${
                                isMicOn 
                                ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' 
                                : 'bg-red-500/20 text-red-500 border-red-500/50'
                            }`}
                        >
                            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                        </button>
                        <button
                            onClick={handleDisconnect}
                            className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all hover:scale-105"
                        >
                            <Power className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};