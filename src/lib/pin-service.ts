import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export class PinService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async setPin(userId: string, pin: string): Promise<boolean> {
    try {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(pin, salt);
      
      const { error } = await this.supabase
        .from('users')
        .update({ pin_hash: hash })
        .eq('id', userId);
      
      return !error;
    } catch {
      return false;
    }
  }

  async verifyPin(userId: string, pin: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('pin_hash')
        .eq('id', userId)
        .single();
      
      if (error || !data?.pin_hash) return false;
      return await bcrypt.compare(pin, data.pin_hash);
    } catch {
      return false;
    }
  }
  
  async hasPin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('pin_hash')
        .eq('id', userId)
        .single();
      
      return !error && !!data?.pin_hash;
    } catch {
      return false;
    }
  }
}