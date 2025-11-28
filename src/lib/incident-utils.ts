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
    photoGallery = incident.photo_urls; // New format
  } else if (incident.photo_url) {
    photoGallery = [incident.photo_url]; // Old format
  }
  
  // Improved legacy detection: Only mark as legacy if:
  // 1. photo_urls is null/undefined AND photo_url exists (old format with single photo)
  // 2. OR photo_urls is null/undefined AND created_at_local is missing (truly old data)
  // New incidents without photos will have photo_urls as [] (empty array), not null
  const isLegacyData = !Array.isArray(incident.photo_urls) && 
                      (incident.photo_url || !incident.created_at_local);
  
  const displayDate = incident.created_at_local || incident.created_at;
  const normalizedBarangay = incident.barangay?.toUpperCase() || incident.barangay || '';
  
  return {
    ...incident,
    photoGallery,
    isLegacyData,
    displayDate,
    barangay: normalizedBarangay,
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

/**
 * Map incident priority to severity level
 * @param priority - Incident priority (string or number)
 * @returns Severity string
 */
export const mapPriorityToSeverity = (priority: string | number) => {
  const priorityStr = String(priority).toLowerCase();
  
  switch (priorityStr) {
    case '1':
    case 'critical':
      return 'CRITICAL';
    case '2':
    case 'high':
      return 'SEVERE';
    case '3':
    case 'medium':
      return 'MODERATE';
    case '4':
    case 'low':
      return 'MINOR';
    default:
      return 'MODERATE'; // Default to MODERATE instead of unknown
  }
};
