import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, Square, Loader2, FileAudio, Copy, Play } from 'lucide-react';
import { blobToBase64 } from '../utils/audioUtils';
import { AvatarState } from '../types';

interface TranscribeViewProps {
  setAvatarState: (state: AvatarState) => void;
  onTranscriptionComplete?: (text: string) => void;
}

export const TranscribeView: React.FC<TranscribeViewProps> = ({ setAvatarState, onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAvatarState(AvatarState.LISTENING);
      setTranscription('');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
      setAvatarState(AvatarState.IDLE);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAvatarState(AvatarState.THINKING);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const base64Audio = await blobToBase64(blob);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/webm',
                data: base64Audio
              }
            },
            {
              text: "Please transcribe this audio exactly as it is spoken. If the audio is in Turkish, transcribe it in Turkish."
            }
          ]
        }
      });

      const text = response.text || "No transcription available.";
      setTranscription(text);
      if (onTranscriptionComplete) {
        onTranscriptionComplete(text);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      setTranscription("Error processing audio. Please try again.");
    } finally {
      setIsProcessing(false);
      setAvatarState(AvatarState.IDLE);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-6 min-h-[200px] shadow-inner backdrop-blur-sm mb-6 flex flex-col relative overflow-hidden group">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="animate-pulse">Analyzing audio stream...</span>
          </div>
        ) : transcription ? (
          <>
            <div className="prose prose-invert max-w-none flex-1 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
              <p className="text-lg leading-relaxed text-slate-200">{transcription}</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => onTranscriptionComplete && onTranscriptionComplete(transcription)}
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300"
                    title="Read with TTS"
                >
                    <Play className="w-4 h-4" />
                </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-slate-600 space-y-2">
            <FileAudio className="w-10 h-10 opacity-30" />
            <span className="text-sm">Tap microphone to start recording</span>
          </div>
        )}
      </div>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600 shadow-red-500/40 scale-110' 
            : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed bg-slate-700' : ''}
        `}
      >
        {isProcessing ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : isRecording ? (
          <Square className="w-8 h-8 text-white fill-current" />
        ) : (
          <Mic className="w-8 h-8 text-white" />
        )}
      </button>
      <p className="mt-4 text-slate-500 text-sm font-medium">
        {isRecording ? "Recording..." : "Ready to transcribe"}
      </p>
    </div>
  );
};