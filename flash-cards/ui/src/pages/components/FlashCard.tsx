import { useState, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';

export const Flashcard = ({ front, back, voice }: { front: string; back: string, voice: string }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const radius = 28; // The radius of our progress circle
  const circumference = 2 * Math.PI * radius;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = (e: MouseEvent) => {
    e.stopPropagation(); // Keep the card from flipping

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(voice);
        
        // Update progress as it plays
        audioRef.current.ontimeupdate = () => {
          const p = (audioRef.current!.currentTime / audioRef.current!.duration) * 100;
          setProgress(p);
        };

        // Reset when finished
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setProgress(0);
        };
      }
      
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Calculate the "dash offset" for the halo effect
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div 
      className="group perspective-1000 w-full h-64 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className={`relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
        
        {/* FRONT SIDE */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-white border-2 border-blue-100 rounded-3xl flex items-center justify-center p-8 shadow-xl">
          <p className="text-2xl font-bold text-gray-800 text-center">{front}</p>
        </div>
     
        {/* BACK SIDE */}
        <div className="absolute inset-0 [backface-visibility:hidden] bg-blue-600 rounded-3xl flex flex-col items-center justify-center p-8 shadow-xl [transform:rotateY(180deg)]">
          <p className="text-2xl font-bold text-white text-center mb-4">{back}</p>
          
          {voice && (
            <div className="relative flex items-center justify-center w-20 h-20">
              {/* SVG Halo Progress Bar */}
              <svg className="absolute w-full h-full -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="white"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={circumference}
                  style={{ 
                    strokeDashoffset: offset,
                    transition: 'stroke-dashoffset 0.1s linear'
                  }}
                  strokeLinecap="round"
                />
              </svg>

              {/* Play/Pause Button */}
              <button 
                onClick={togglePlay}
                className="relative z-10 p-4 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                {isPlaying ? (
                  /* Pause Icon */
                  <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" className="w-8 h-8">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  /* Play Icon */
                  <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" className="w-8 h-8">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};