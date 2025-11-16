"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PinPad } from '@/components/pin-pad';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PinManagementPage() {
  const { user, verifyPin, setPin } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCurrentPin = async (pin: string) => {
    if (!user) return;
    
    setError('');
    setLoading(true);
    
    try {
      const isValid = await verifyPin(pin);
      if (isValid) {
        setCurrentPin(pin);
        setStep('new');
      } else {
        setError('Incorrect current PIN');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPin = (pin: string) => {
    setError('');
    setNewPin(pin);
    setStep('confirm');
  };

  const handleConfirmPin = async (pin: string) => {
    setError('');
    
    if (pin !== newPin) {
      setError('New PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    if (pin === currentPin) {
      setError('New PIN must be different from current PIN');
      setConfirmPin('');
      return;
    }

    saveNewPin(pin);
  };

  const saveNewPin = async (pin: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const success = await setPin(pin);
      if (success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(getDashboardPath());
        }, 2000);
      } else {
        setError('Failed to change PIN. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'admin': return '/admin/dashboard';
      case 'volunteer': return '/volunteer/dashboard';
      case 'resident': return '/resident/dashboard';
      case 'barangay': return '/barangay/dashboard';
      default: return '/';
    }
  };

  const clearError = () => {
    setError('');
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="text-green-500 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">PIN Changed Successfully</h3>
            <p className="text-gray-600">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {step === 'current' ? 'Current PIN' : step === 'new' ? 'New PIN' : 'Confirm New PIN'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              {step === 'current' 
                ? 'Enter your current PIN to continue' 
                : step === 'new' 
                  ? 'Create a new 4-digit PIN' 
                  : 'Enter your new PIN again to confirm'}
            </p>
          </div>

          {step === 'current' && (
            <PinPad 
              onPinComplete={handleCurrentPin} 
              title="Enter Current PIN"
              error={error}
              clearError={clearError}
            />
          )}

          {step === 'new' && (
            <PinPad 
              onPinComplete={handleNewPin} 
              title="Enter New PIN"
              error={error}
              clearError={clearError}
            />
          )}

          {step === 'confirm' && (
            <PinPad 
              onPinComplete={handleConfirmPin} 
              title="Confirm New PIN"
              error={error}
              clearError={clearError}
            />
          )}

          <div className="mt-6 flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => {
                if (step === 'confirm') {
                  setStep('new');
                  setConfirmPin('');
                } else if (step === 'new') {
                  setStep('current');
                  setNewPin('');
                } else {
                  router.push(getDashboardPath());
                }
              }}
              disabled={loading}
            >
              {step === 'current' ? 'Cancel' : 'Back'}
            </Button>
            {step === 'confirm' && (
              <Button 
                variant="outline" 
                onClick={() => {
                  setStep('new');
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