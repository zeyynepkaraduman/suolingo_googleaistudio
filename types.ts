export enum ViewMode {
  TRANSCRIBE = 'TRANSCRIBE',
  TTS = 'TTS',
  LIVE = 'LIVE'
}

export enum AvatarState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text?: string;
  audio?: string; // base64
  timestamp: number;
}

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface VoiceOption {
  name: VoiceName | 'Custom'; // Added Custom
  label: string;
  gender: 'Male' | 'Female' | 'Custom';
  style: string;
  isCloned?: boolean; // New flag
}

export const VOICE_OPTIONS: VoiceOption[] = [
  { name: 'Puck', label: 'Puck', gender: 'Male', style: 'Soft, Deep' },
  { name: 'Charon', label: 'Charon', gender: 'Male', style: 'Deep, Resonant' },
  { name: 'Kore', label: 'Kore', gender: 'Female', style: 'Calm, Soothing' },
  { name: 'Fenrir', label: 'Fenrir', gender: 'Male', style: 'Energetic' },
  { name: 'Zephyr', label: 'Zephyr', gender: 'Female', style: 'Polite, Helpful' },
];