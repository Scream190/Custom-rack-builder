import type { CableType } from '../model/types';

const std = [0.3, 0.5, 1, 1.5, 2, 3, 5, 10, 15, 20];

export const DEFAULT_CABLE_TYPES: CableType[] = [
  { id: 'ct-rg58', name: 'Koax RG58 (BNC)', signal: 'rf', color: '#eab308', width: 2.2, stockLengths: [0.25, 0.5, 1, 1.5, 2, 3, 5, 10, 15, 20], connectors: ['BNC', 'BNC-D', 'TNC', 'SMA'] },
  { id: 'ct-lowloss', name: 'Koax Low-Loss (N)', signal: 'rf', color: '#ea580c', width: 3, stockLengths: [1, 2, 3, 5, 10, 15, 20, 30], connectors: ['N', 'N-D'] },
  { id: 'ct-wordclock', name: 'Wordclock 75 Ω (BNC)', signal: 'clock', color: '#0891b2', width: 2, stockLengths: [0.3, 0.5, 1, 2, 3, 5], connectors: ['BNC75'] },
  { id: 'ct-xlr', name: 'Audio XLR', signal: 'audio', color: '#2563eb', width: 2.5, stockLengths: std, connectors: ['XLR3F', 'XLR3M', 'XLR5F', 'XLR5M', 'COMBO'] },
  { id: 'ct-jack', name: 'Audio Klinke', signal: 'audio', color: '#60a5fa', width: 2, stockLengths: std, connectors: ['JACK', 'JACK-D', 'MINIJACK'] },
  { id: 'ct-aes', name: 'AES/EBU 110 Ω', signal: 'aes', color: '#9333ea', width: 2.5, stockLengths: std, connectors: ['AES-XLR'] },
  { id: 'ct-speakon', name: 'Lautsprecher speakON', signal: 'audio', color: '#1e3a8a', width: 3, stockLengths: [1, 2, 5, 10, 15, 20], connectors: ['SPEAKON'] },
  { id: 'ct-cat', name: 'Cat6 / etherCON', signal: 'network', color: '#16a34a', width: 2.2, stockLengths: [0.25, 0.5, 1, 2, 3, 5, 10, 20], connectors: ['RJ45', 'ETHERCON'] },
  { id: 'ct-fiber', name: 'LWL', signal: 'network', color: '#84cc16', width: 2, stockLengths: [1, 2, 5, 10, 50, 100], connectors: ['SFP', 'OPTICALCON'] },
  { id: 'ct-iec', name: 'Kaltgeräte IEC', signal: 'power', color: '#dc2626', width: 3, stockLengths: [0.5, 1, 1.5, 2, 3, 5], connectors: ['IEC_C13', 'IEC_C14', 'SCHUKO'] },
  { id: 'ct-powercon', name: 'powerCON / TRUE1', signal: 'power', color: '#991b1b', width: 3, stockLengths: [0.5, 1, 1.5, 2, 3, 5, 10], connectors: ['POWERCON_IN', 'POWERCON_OUT', 'TRUE1_IN', 'TRUE1_OUT'] },
  { id: 'ct-dc', name: 'DC Versorgung', signal: 'power', color: '#f87171', width: 1.6, dash: '6 3', stockLengths: [0.3, 0.5, 1, 2], connectors: ['DC'] },
  { id: 'ct-usb', name: 'USB', signal: 'data', color: '#64748b', width: 1.8, stockLengths: [0.5, 1, 2, 3, 5], connectors: ['USB', 'USB-D'] },
  { id: 'ct-hdmi', name: 'HDMI', signal: 'video', color: '#db2777', width: 2.2, stockLengths: [0.5, 1, 2, 3, 5, 10], connectors: ['HDMI', 'HDMI-D'] },
  { id: 'ct-generic', name: 'Sonstiges Kabel', signal: 'other', color: '#6b7280', width: 2, stockLengths: std },
];
