"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PinPad } from '@/components/pin-pad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PinSetupPage() {
  const { user, requiresPin, pinVerified, setPin, checkHasPin } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
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

    // Check if user already has a PIN
    const checkPinStatus = async () => {
      const hasPin = await checkHasPin();
      if (hasPin && pinVerified) {
        redirectToDashboard();
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

  const handlePinSetup = (pin: string) => {
    setError('');
    setNewPin(pin);
    setStep('confirm');
  };

  const handlePinConfirm = (pin: string) => {
    setError('');
    setConfirmPin(pin);
    
    if (pin !== newPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    savePin(pin);
  };

  const savePin = async (pin: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const success = await setPin(pin);
      if (success) {
        // Redirect to dashboard after successful PIN setup
        redirectToDashboard();
      } else {
        setError('Failed to set PIN. Please try again.');
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
          <CardTitle className="text-center">
            {step === 'setup' ? 'Set Up PIN' : 'Confirm PIN'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              {step === 'setup' 
                ? 'Create a 4-digit PIN to secure your account' 
                : 'Enter your PIN again to confirm'}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This PIN will be required each time you log in to protect your account
            </p>
          </div>

          {step === 'setup' ? (
            <PinPad 
              onPinComplete={handlePinSetup} 
              title="Enter New PIN"
              error={error}
              clearError={clearError}
            />
          ) : (
            <PinPad 
              onPinComplete={handlePinConfirm} 
              title="Confirm PIN"
              error={error}
              clearError={clearError}
            />
          )}

          <div className="mt-6 flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => {
                if (step === 'confirm') {
                  setStep('setup');
                  setConfirmPin('');
                } else {
                  router.push('/login');
                }
              }}
              disabled={loading}
            >
              {step === 'confirm' ? 'Back' : 'Cancel'}
            </Button>
            {step === 'confirm' && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setStep('setup');
                  setNewPin('');
                  setConfirmPin('');
                  setError('');
                }}
                disabled={loading}
              >
                Restart
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}