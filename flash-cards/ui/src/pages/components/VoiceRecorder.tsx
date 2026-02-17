import { useReactMediaRecorder } from 'react-media-recorder-2';
import { Mic, Square, Play, Trash2, Volume2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';


interface VoiceRecorderProps {
  onAudioSerialized: (base64: string) => void;
}

export const VoiceRecorder = ({ onAudioSerialized }: VoiceRecorderProps) => {
  const [base64Audio, setBase64Audio] = useState<string | null>(null);
  const [errors, setError] = useState('');
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<any>(null);
  const MAX_SECONDS = 20;

  const { status, startRecording, stopRecording, mediaBlobUrl, clearBlobUrl } =
    useReactMediaRecorder({ audio: true });


    useEffect(()=> {
      if (status === 'recording') {
        
        timerRef.current = setInterval(()=>{
          setSeconds((prev) => prev + 1);
       },1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, [status]);


    // validation: Auto-stop at 20s
    useEffect(()=>{
      if (seconds >= MAX_SECONDS && status === 'recording'){
        setError("The voice recorder can't record more the 20 Seconds.")
        stopRecording();
      }
    }, [seconds, status, stopRecording])

  // Convert Blob to Base64 when recording stops
  useEffect(() => {
    if (mediaBlobUrl) {
      fetch(mediaBlobUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64data = reader.result as string;
            setBase64Audio(base64data);
            onAudioSerialized(base64data);
          };
        });
    }
  }, [mediaBlobUrl]);

  const handleReset = () => {
    clearBlobUrl();
    setBase64Audio(null);
    onAudioSerialized('');
    setError("");
    setSeconds(0);
  };

  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold uppercase text-gray-400 tracking-wider flex items-center gap-2">
          <Volume2 size={14} /> Voice Memo
        </label>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          status === 'recording' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-200 text-gray-500'
        }`}>
          {status.toUpperCase()}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {status !== 'recording' && !mediaBlobUrl && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Mic size={16} /> Record Pronunciation
          </button>
        )}

        {status === 'recording' && (
          <button
            onClick={()=> {
              stopRecording(); 
            }}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium animate-pulse"
          >
            <Square size={16} fill="currentColor" /> 
          </button>
        )}

       
        {mediaBlobUrl && (
          <div className="flex items-center gap-2 w-full">
            <audio src={mediaBlobUrl} controls className="h-8 flex-1" />
            <button 
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>
       {errors && (
          <div className="text-red-600 text-sm">
            {errors}
          </div>
        )}

    </div>
  );
};