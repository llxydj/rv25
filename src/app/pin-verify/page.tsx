"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PinPad } from '@/components/pin-pad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PinVerifyPage() {
  const { user, requiresPin, pinVerified, verifyPin, checkHasPin } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If user is not authenticated, redirect to login
    if (!user) {
      router.push('/login');
      return;
    }

    // If user doesn't require PIN (barangay users), redirect to dashboard
    if (!requiresPin) {
      redirectToDashboard();
      return;
    }

    // If PIN is already verified, redirect to dashboard
    if (pinVerified) {
      redirectToDashboard();
      return;
    }

    // Check if user has a PIN
    const checkPinStatus = async () => {
      const hasPin = await checkHasPin();
      if (!hasPin) {
        // If no PIN is set, redirect to PIN setup
        router.push('/pin-setup');
      }
    };

    checkPinStatus();
  }, [user, requiresPin, pinVerified, router, checkHasPin]);

  const redirectToDashboard = () => {
    if (!user) return;
    
    switch (user.role) {
      case 'admin':
        router.push('/admin/dashboard');
        break;
      case 'volunteer':
        router.push('/volunteer/dashboard');
        break;
      case 'resident':
        router.push('/resident/dashboard');
        break;
      case 'barangay':
        router.push('/barangay/dashboard');
        break;
      default:
        router.push('/');
    }
  };

  const handlePinVerify = async (pin: string) => {
    if (!user) return;
    
    setError('');
    setLoading(true);
    
    try {
      const isValid = await verifyPin(pin);
      if (isValid) {
        // Redirect to dashboard after successful PIN verification
        redirectToDashboard();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 3) {
          // Sign out user after 3 failed attempts
          // In a real implementation, you might want to add a delay or lockout period
          alert('Too many failed attempts. You have been logged out.');
          router.push('/login');
        } else {
          setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError('');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Enter PIN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              Enter your 4-digit PIN to access your account
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This helps protect your account from unauthorized access
            </p>
          </div>

          <PinPad 
            onPinComplete={handlePinVerify} 
            title="Enter PIN"
            error={error}
            clearError={clearError}
          />

          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              onClick={() => router.push('/login')}
              disabled={loading}
            >
              Use Different Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}