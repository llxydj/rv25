/**
 * Simple user data cache utilities
 * Provides functions to clear cached user data
 */

/**
 * Clear cached data for a specific user
 * @param userId - The ID of the user whose cache should be cleared
 */
export function clearUserCache(userId: string): void {
  try {
    // Clear localStorage entries related to the user
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`user_${userId}_`) || key.includes(userId)) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage entries related to the user
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(`user_${userId}_`) || key.includes(userId)) {
        sessionStorage.removeItem(key);
      }
    });

    // If there are specific cache keys we know about, clear them explicitly
    const knownCacheKeys = [
      `user_profile_${userId}`,
      `user_preferences_${userId}`,
      `user_settings_${userId}`
    ];

    knownCacheKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch (error) {
    // Silently fail in case storage is not available
    console.debug('Could not clear user cache:', error);
  }
}

/**
 * Clear all user-related cache data
 */
export function clearAllUserCache(): void {
  try {
    // Clear all localStorage entries that look like user data
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('user_') || key.includes('profile') || key.includes('preferences')) {
        localStorage.removeItem(key);
      }
    });

    // Clear all sessionStorage entries that look like user data
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('user_') || key.includes('profile') || key.includes('preferences')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    // Silently fail in case storage is not available
    console.debug('Could not clear all user cache:', error);
  }
}