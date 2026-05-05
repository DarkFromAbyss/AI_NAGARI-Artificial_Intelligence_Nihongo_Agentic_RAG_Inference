"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const greetings = [
  {
    lang: "en",
    text: "Hello, nice to meet you, I am AI NARAGI, a Japanese teacher, let's talk!",
  },
  {
    lang: "ja",
    text: "こんにちは、はじめまして。私は日本語教師のAI NARAGIです。一緒にお話ししましょう！",
  },
];

interface AnimatedGreetingProps {
  className?: string;
}

export function AnimatedGreeting({ className }: AnimatedGreetingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayPhase, setDisplayPhase] = useState<"visible" | "hiding" | "showing">("visible");

  useEffect(() => {
    // Display duration before starting hide animation
    const displayTimer = setTimeout(() => {
      setDisplayPhase("hiding");
      setIsAnimating(true);
    }, 3000);

    return () => clearTimeout(displayTimer);
  }, [currentIndex]);

  useEffect(() => {
    if (displayPhase === "hiding") {
      // After hide animation completes, switch text and show
      const hideTimer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % greetings.length);
        setDisplayPhase("showing");
      }, 800);

      return () => clearTimeout(hideTimer);
    }

    if (displayPhase === "showing") {
      // After show animation completes, reset to visible
      const showTimer = setTimeout(() => {
        setDisplayPhase("visible");
        setIsAnimating(false);
      }, 800);

      return () => clearTimeout(showTimer);
    }
  }, [displayPhase]);

  const currentGreeting = greetings[currentIndex];
  const characters = currentGreeting.text.split("");

  return (
    <div className={cn("text-center px-4", className)}>
      <p 
        className="text-lg text-foreground leading-relaxed font-medium"
        aria-live="polite"
        lang={currentGreeting.lang}
      >
        {characters.map((char, index) => (
          <span
            key={`${currentIndex}-${index}`}
            className={cn(
              "inline-block transition-all duration-300 ease-out",
              displayPhase === "hiding" && "animate-wave-out",
              displayPhase === "showing" && "animate-wave-in"
            )}
            style={{
              animationDelay: displayPhase === "hiding" 
                ? `${index * 15}ms` 
                : `${index * 15}ms`,
              opacity: displayPhase === "showing" ? 0 : 1,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </p>
      
      {/* Language indicator */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {greetings.map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-300",
              index === currentIndex 
                ? "bg-primary w-4" 
                : "bg-border"
            )}
          />
        ))}
      </div>

      {/* CSS Keyframes */}
      <style jsx>{`
        @keyframes waveOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px) scale(0.95);
          }
        }

        @keyframes waveIn {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-wave-out {
          animation: waveOut 0.4s ease-out forwards;
        }

        .animate-wave-in {
          animation: waveIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
