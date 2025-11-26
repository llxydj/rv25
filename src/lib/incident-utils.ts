/**
 * Utility functions for handling incident data normalization
 * Ensures backward compatibility between old and new incident formats
 */

/**
 * Normalize incident data to handle both old and new formats
 * @param incident - Raw incident data from database
 * @returns Normalized incident object
 */
export const normalizeIncident = (incident: any) => {
  // Handle photo URLs - support both old (photo_url) and new (photo_urls) formats
  let photoGallery: string[] = [];
  
  if (Array.isArray(incident.photo_urls) && incident.photo_urls.length > 0) {
    // New format - use photo_urls array
    photoGallery = incident.photo_urls;
  } else if (incident.photo_url) {
    // Old format - convert single photo_url to array
    photoGallery = [incident.photo_url];
  }
  
  // Determine if this is legacy data (old format)
  const isLegacyData = !Array.isArray(incident.photo_urls);
  
  // Use created_at_local if available (new format), otherwise fall back to created_at (old format)
  const displayDate = incident.created_at_local || incident.created_at;
  
  // Normalize barangay to uppercase (new format standard)
  const normalizedBarangay = incident.barangay?.toUpperCase() || incident.barangay || '';
  
  return {
    ...incident,
    photoGallery,
    isLegacyData,
    displayDate,
    barangay: normalizedBarangay,
    // Add a flag to indicate data format version
    dataFormatVersion: isLegacyData ? 'legacy' : 'current'
  };
};

/**
 * Get formatted date for display
 * @param dateString - Date string to format
 * @returns Formatted date string
 */
export const formatDisplayDate = (dateString: string | null | undefined) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return "Invalid date";
  }
};