"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface PinPadProps {
  onPinComplete: (pin: string) => void;
  title?: string;
  error?: string;
  clearError?: () => void;
}

export function PinPad({ onPinComplete, title = "Enter PIN", error, clearError }: PinPadProps) {
  const [pin, setPin] = useState("");

  const handleNumber = (num: string) => {
    if (clearError) clearError();
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => onPinComplete(newPin), 100);
      }
    }
  };

  const handleBackspace = () => {
    if (clearError) clearError();
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    if (clearError) clearError();
    setPin("");
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow w-full max-w-sm">
      <h3 className="text-lg font-medium mb-4">{title}</h3>
      
      <div className="flex space-x-2 mb-6">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              i < pin.length 
                ? 'bg-blue-600 border-blue-600' 
                : 'border-gray-300'
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="text-red-500 text-sm mb-4 text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <Button
            key={num}
            variant="outline"
            className="h-14 text-xl"
            onClick={() => handleNumber(num.toString())}
          >
            {num}
          </Button>
        ))}
        <Button variant="outline" onClick={handleClear}>
          Clear
        </Button>
        <Button
          variant="outline"
          className="text-xl"
          onClick={() => handleNumber("0")}
        >
          0
        </Button>
        <Button variant="outline" onClick={handleBackspace}>
          ←
        </Button>
      </div>
    </div>
  );
}