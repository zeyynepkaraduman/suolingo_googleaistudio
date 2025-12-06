import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Play, Loader2, Wand2, Mic, Trash2, CheckCircle2, Sparkles, AlertCircle, HelpCircle, X, ChevronRight, ChevronLeft, Volume2 } from 'lucide-react';
import { VOICE_OPTIONS, VoiceName, AvatarState } from '../types';
import { base64ToUint8Array, decodeAudioData, blobToBase64 } from '../utils/audioUtils';

interface TTSViewProps {
  setAvatarState: (state: AvatarState) => void;
  initialText?: string;
}

const TUTORIAL_STEPS = [
  {
    title: "Clone Your Voice",
    desc: "Suolingo can mimic your voice using just a short audio sample. Toggle 'Voice Clone' mode to access this feature.",
    icon: <Wand2 className="w-12 h-12 text-purple-400" />
  },
  {
    title: "Best Practices",
    desc: "For the best quality, record in a quiet room with no background noise. Speak clearly, naturally, and avoid echoing environments.",
    icon: <Volume2 className="w-12 h-12 text-blue-400" />
  },
  {
    title: "Recording the Sample",
    desc: "Click the microphone icon and read the reference text provided. A clear 3-5 second recording is all the AI needs to learn your voice.",
    icon: <Mic className="w-12 h-12 text-red-400" />
  },
  {
    title: "Generate Speech",
    desc: "Once your sample is ready, type any text you want and click the Sparkles button. Suolingo will read it back using your voice!",
    icon: <Sparkles className="w-12 h-12 text-yellow-400" />
  }
];

export const TTSView: React.FC<TTSViewProps> = ({ setAvatarState, initialText = '' }) => {
  const [text, setText] = useState(initialText);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName | 'Custom'>('Kore');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Voice Cloning State
  const [isCloningMode, setIsCloningMode] = useState(false);
  const [isRecordingClone, setIsRecordingClone] = useState(false);
  const [clonedBlob, setClonedBlob] = useState<Blob | null>(null);
  const cloneRecorderRef = useRef<MediaRecorder | null>(null);
  const cloneChunksRef = useRef<Blob[]>([]);

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setError(null);
    setAvatarState(AvatarState.THINKING);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      let base64Audio: string | undefined;

      // --- VOICE CLONING MODE ---
      if (isCloningMode && clonedBlob) {
        try {
          const base64Clone = await blobToBase64(clonedBlob);
          
          // Use 'gemini-2.5-flash-native-audio-preview-09-2025' for Audio-to-Audio (Cloning)
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            contents: {
              parts: [
                { 
                  inlineData: { 
                    mimeType: 'audio/webm', 
                    data: base64Clone 
                  } 
                },
                { 
                  text: `Using the voice in the audio input, say: "${text}"` 
                }
              ]
            },
            config: {
              responseModalities: [Modality.AUDIO],
            }
          });

          base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          
          if (!base64Audio) {
             throw new Error("Model did not return audio.");
          }

        } catch (cloneError) {
          console.warn("Cloning failed (Native Audio model might be unavailable), falling back to standard TTS:", cloneError);
          setError("Voice cloning unavailable with current model access. Falling back to standard voice.");
          
          // Fallback to Standard TTS using the dedicated TTS model
          const fallbackResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
              },
            },
          });
          base64Audio = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        }
      } 
      // --- STANDARD TTS MODE ---
      else {
        const actualVoiceName = (selectedVoice === 'Custom') ? 'Zephyr' : selectedVoice;
        
        // Use the dedicated TTS model 'gemini-2.5-flash-preview-tts'
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: actualVoiceName as VoiceName },
              },
            },
          },
        });
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      }

      if (base64Audio) {
        setAvatarState(AvatarState.SPEAKING);
        await playAudio(base64Audio);
      } else {
        throw new Error("No audio data received from API.");
      }

    } catch (err: any) {
      console.error("TTS Error:", err);
      // Format the error message for display
      let msg = "Generation failed.";
      if (err.message) {
         if (err.message.includes("400")) msg += " (Model returned 400: Invalid Argument - Check Model Compatibility)";
         else if (err.message.includes("404")) msg += " (Model Not Found)";
         else msg = err.message;
      }
      setError(msg);
      setAvatarState(AvatarState.IDLE);
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = async (base64String: string) => {
    const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    if (!audioContext) setAudioContext(ctx);

    try {
      const audioBytes = base64ToUint8Array(base64String);
      const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setAvatarState(AvatarState.IDLE);
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      setAvatarState(AvatarState.IDLE);
    }
  };

  // --- Voice Cloning Handlers ---
  const startCloneRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      cloneRecorderRef.current = mediaRecorder;
      cloneChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) cloneChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(cloneChunksRef.current, { type: 'audio/webm' });
        setClonedBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingClone(true);
    } catch (err) {
      console.error("Error recording clone sample:", err);
      setError("Could not access microphone.");
    }
  };

  const stopCloneRecording = () => {
    if (cloneRecorderRef.current && isRecordingClone) {
      cloneRecorderRef.current.stop();
      setIsRecordingClone(false);
    }
  };

  const hasCustomVoice = !!clonedBlob;

  const nextTutorialStep = () => {
    setTutorialStep((prev) => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
  };

  const prevTutorialStep = () => {
    setTutorialStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="flex flex-col w-full h-full space-y-4">
      
      {/* Voice Selector Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 custom-scrollbar">
         <button
            onClick={() => setIsCloningMode(!isCloningMode)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap ${
                isCloningMode 
                ? 'bg-purple-500/20 border-purple-500 text-purple-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
         >
            <Wand2 className="w-4 h-4" />
            <span className="text-sm font-medium">Voice Clone</span>
         </button>

         <button 
           onClick={() => { setShowTutorial(true); setTutorialStep(0); }}
           className="p-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
           title="How to use Voice Clone"
         >
           <HelpCircle className="w-4 h-4" />
         </button>

         <div className="w-px h-6 bg-slate-700 mx-2" />

         {!isCloningMode && VOICE_OPTIONS.map((voice) => (
             <button
                key={voice.name}
                onClick={() => setSelectedVoice(voice.name)}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition-all whitespace-nowrap ${
                    selectedVoice === voice.name
                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
             >
                {voice.label}
             </button>
         ))}

         {hasCustomVoice && isCloningMode && (
             <button className="flex items-center space-x-2 px-4 py-2 rounded-full border text-sm font-medium bg-purple-500/20 border-purple-500 text-purple-300">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span>Clone Active</span>
             </button>
         )}
      </div>

      {/* Cloning Panel */}
      {isCloningMode && (
          <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-4 flex flex-col space-y-4 shadow-lg shadow-purple-900/10">
              <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-purple-200">Record Voice Sample</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Read: <span className="text-slate-300 italic">"Suolingo helps me learn new languages quickly."</span>
                    </p>
                  </div>
                  {clonedBlob && (
                      <span className="flex items-center text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                      </span>
                  )}
              </div>
              
              <div className="flex space-x-3">
                  <button
                    onClick={isRecordingClone ? stopCloneRecording : startCloneRecording}
                    className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                        isRecordingClone 
                        ? 'bg-red-500 text-white animate-pulse shadow-red-500/20' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                      {isRecordingClone ? <div className="w-2 h-2 bg-white rounded-full animate-bounce" /> : <Mic className="w-4 h-4" />}
                      <span>{isRecordingClone ? "Stop Recording" : "Record Sample"}</span>
                  </button>
                  
                  {clonedBlob && (
                      <button 
                        onClick={() => { setClonedBlob(null); }}
                        className="p-3 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700"
                      >
                          <Trash2 className="w-4 h-4" />
                      </button>
                  )}
              </div>
          </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-orange-500/10 border border-orange-500/50 text-orange-200 px-4 py-2 rounded-lg text-sm flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
        </div>
      )}

      {/* Input Area */}
      <div className="relative flex-1">
        <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isCloningMode ? "Type text to speak in your voice..." : "Type text here..."}
            className={`w-full h-full bg-slate-900/50 border rounded-2xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 resize-none custom-scrollbar text-lg transition-all
                ${isCloningMode 
                    ? 'border-purple-500/30 focus:ring-purple-500/50' 
                    : 'border-slate-800 focus:ring-indigo-500/50'}
            `}
        />
        <button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim() || (isCloningMode && !clonedBlob)}
            className={`
              absolute bottom-4 right-4 p-4 rounded-full shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center
              ${isGenerating || !text.trim() || (isCloningMode && !clonedBlob)
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : isCloningMode 
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/30'
              }
            `}
        >
            {isGenerating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
            ) : isCloningMode ? (
                <Sparkles className="w-6 h-6 fill-current" />
            ) : (
                <Play className="w-6 h-6 fill-current" />
            )}
        </button>
      </div>

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative flex flex-col items-center text-center">
             
             {/* Close Button */}
             <button 
               onClick={() => setShowTutorial(false)}
               className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
             >
               <X className="w-5 h-5" />
             </button>

             {/* Content */}
             <div className="bg-slate-800/50 p-4 rounded-full mb-4">
                {TUTORIAL_STEPS[tutorialStep].icon}
             </div>
             
             <h3 className="text-xl font-bold text-white mb-2">{TUTORIAL_STEPS[tutorialStep].title}</h3>
             <p className="text-slate-400 mb-8 leading-relaxed text-sm">
               {TUTORIAL_STEPS[tutorialStep].desc}
             </p>

             {/* Navigation */}
             <div className="flex items-center justify-between w-full mt-auto">
                <div className="flex space-x-1">
                  {TUTORIAL_STEPS.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${idx === tutorialStep ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-700'}`} 
                    />
                  ))}
                </div>

                <div className="flex space-x-2">
                   <button 
                     onClick={prevTutorialStep}
                     disabled={tutorialStep === 0}
                     className="p-2 rounded-full border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                   >
                     <ChevronLeft className="w-5 h-5" />
                   </button>
                   <button 
                     onClick={tutorialStep === TUTORIAL_STEPS.length - 1 ? () => setShowTutorial(false) : nextTutorialStep}
                     className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
                   >
                     {tutorialStep === TUTORIAL_STEPS.length - 1 ? <CheckCircle2 className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                   </button>
                </div>
             </div>

          </div>
        </div>
      )}

    </div>
  );
};