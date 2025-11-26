// Mapping helper to normalize OSM names to official barangay list
// Extend this mapping over time if discrepancies are found.

const OSM_TO_OFFICIAL: Record<string, string> = {
  // Common prefixes/synonyms
  'BRGY. CONCEPCION': 'CONCEPCION',
  'BRGY CONCEPCION': 'CONCEPCION',
  'BARRIO CONCEPCION': 'CONCEPCION',
  'CONCEPCION VILLAGE': 'CONCEPCION',
  'CONCEPCION': 'CONCEPCION',

  'BRGY. CABATANGAN': 'CABATANGAN',
  'BRGY CABATANGAN': 'CABATANGAN',
  'CABATANGAN': 'CABATANGAN',

  'BRGY. MATAB-ANG': 'MATAB-ANG',
  'BRGY MATAB-ANG': 'MATAB-ANG',
  'MATAB-ANG': 'MATAB-ANG',

  'BRGY. BUBOG': 'BUBOG',
  'BRGY BUBOG': 'BUBOG',
  'BUBOG': 'BUBOG',

  'BRGY. DOS HERMANAS': 'DOS HERMANAS',
  'BRGY DOS HERMANAS': 'DOS HERMANAS',
  'DOS HERMANAS': 'DOS HERMANAS',

  'BRGY. EFIGENIO LIZARES': 'EFIGENIO LIZARES',
  'BRGY EFIGENIO LIZARES': 'EFIGENIO LIZARES',
  'EFIGENIO LIZARES': 'EFIGENIO LIZARES',

  'BRGY. KATILINGBAN': 'KATILINGBAN',
  'BRGY KATILINGBAN': 'KATILINGBAN',
  'KATILINGBAN': 'KATILINGBAN',

  // Zones (normalize variants like "Zone 1", "Brgy Zone 1", etc.)
  'BRGY. ZONE 1': 'ZONE 1',
  'BRGY ZONE 1': 'ZONE 1',
  'ZONE 1': 'ZONE 1',
  'BRGY. ZONE 2': 'ZONE 2',
  'BRGY ZONE 2': 'ZONE 2',
  'ZONE 2': 'ZONE 2',
  'BRGY. ZONE 3': 'ZONE 3',
  'BRGY ZONE 3': 'ZONE 3',
  'ZONE 3': 'ZONE 3',
  'BRGY. ZONE 4': 'ZONE 4',
  'BRGY ZONE 4': 'ZONE 4',
  'ZONE 4': 'ZONE 4',
  'BRGY. ZONE 5': 'ZONE 5',
  'BRGY ZONE 5': 'ZONE 5',
  'ZONE 5': 'ZONE 5',
  'BRGY. ZONE 6': 'ZONE 6',
  'BRGY ZONE 6': 'ZONE 6',
  'ZONE 6': 'ZONE 6',
  'BRGY. ZONE 7': 'ZONE 7',
  'BRGY ZONE 7': 'ZONE 7',
  'ZONE 7': 'ZONE 7',
  'BRGY. ZONE 8': 'ZONE 8',
  'BRGY ZONE 8': 'ZONE 8',
  'ZONE 8': 'ZONE 8',
  'BRGY. ZONE 9': 'ZONE 9',
  'BRGY ZONE 9': 'ZONE 9',
  'ZONE 9': 'ZONE 9',
  'BRGY. ZONE 10': 'ZONE 10',
  'BRGY ZONE 10': 'ZONE 10',
  'ZONE 10': 'ZONE 10',
  'BRGY. ZONE 11': 'ZONE 11',
  'BRGY ZONE 11': 'ZONE 11',
  'ZONE 11': 'ZONE 11',
  'BRGY. ZONE 12': 'ZONE 12',
  'BRGY ZONE 12': 'ZONE 12',
  'ZONE 12': 'ZONE 12',
  'BRGY. ZONE 13': 'ZONE 13',
  'BRGY ZONE 13': 'ZONE 13',
  'ZONE 13': 'ZONE 13',
  'BRGY. ZONE 14': 'ZONE 14',
  'BRGY ZONE 14': 'ZONE 14',
  'ZONE 14': 'ZONE 14',
  'BRGY. ZONE 15': 'ZONE 15',
  'BRGY ZONE 15': 'ZONE 15',
  'ZONE 15': 'ZONE 15',
  'BRGY. ZONE 16': 'ZONE 16',
  'BRGY ZONE 16': 'ZONE 16',
  'ZONE 16': 'ZONE 16',
  'BRGY. ZONE 17': 'ZONE 17',
  'BRGY ZONE 17': 'ZONE 17',
  'ZONE 17': 'ZONE 17',
  'BRGY. ZONE 18': 'ZONE 18',
  'BRGY ZONE 18': 'ZONE 18',
  'ZONE 18': 'ZONE 18',
  'BRGY. ZONE 19': 'ZONE 19',
  'BRGY ZONE 19': 'ZONE 19',
  'ZONE 19': 'ZONE 19',
  'BRGY. ZONE 20': 'ZONE 20',
  'BRGY ZONE 20': 'ZONE 20',
  'ZONE 20': 'ZONE 20',
}

export function normalizeBarangay(osmName: string | undefined, knownList: string[] = []): string | undefined {
  if (!osmName) return undefined
  const cand = osmName.toUpperCase().replace(/^BRGY\.?\s+/, '').trim()

  // 1) Explicit remaps first
  for (const key of Object.keys(OSM_TO_OFFICIAL)) {
    if (cand.includes(key)) return OSM_TO_OFFICIAL[key]
  }

  // 2) Best match from known list (substring contains)
  if (Array.isArray(knownList) && knownList.length > 0) {
    const match = knownList.find((b) => cand.includes(String(b).toUpperCase()))
    if (match) return match
  }

  // 3) Fallback to the candidate uppercased
  return cand
}
