// Cities in Negros Occidental
export const CITIES = [
  {
    name: "BACOLOD CITY",
    barangays: [
      "ALANGILAN", "ALIJIS", "BANAGO", "BATA", "CABUG", "ESTEFANIA", "FELISA",
      "GRANADA", "HANDUMANAN", "MANDALAGAN", "MANSILINGAN", "MONTEVISTA",
      "PAHANOCOY", "PUNTA TAYTAY", "SINGCANG-AIRPORT", "SUM-AG", "TACULING",
      "TANGUB", "VILLAMONTE", "VISTA ALEGRE"
    ]
  },
  {
    name: "TALISAY CITY",
    barangays: [
      "Bubog", "Cabatangan", "Concepcion", "Dos Hermanas", "Efigenio Lizares",
      "Katilingban", "Matab-ang", "Poblacion", "San Fernando", "Zone 1 (Poblacion)",
      "Zone 10 (Poblacion)", "Zone 11 (Poblacion)", "Zone 12 (Poblacion)", "Zone 12-A (Poblacion)",
      "Zone 14 (Poblacion)", "Zone 14-A (Poblacion)", "Zone 14-B (Poblacion)", "Zone 15 (Poblacion)",
      "Zone 16 (Poblacion)", "Zone 2 (Poblacion)", "Zone 3 (Poblacion)", "Zone 5 (Poblacion)",
      "Zone 6 (Poblacion)", "Zone 7 (Poblacion)", "Zone 8 (Poblacion)", "Zone 9 (Poblacion)"


    ]
  },
  {
    name: "SILAY CITY",
    barangays: [
      "BARANGAY I (POBLACION)", "BARANGAY II (POBLACION)", "BARANGAY III (POBLACION)",
      "BARANGAY IV (POBLACION)", "BARANGAY V (POBLACION)", "BALARING", "EUSTAQUIO LOPEZ",
      "GUIMBALA-ON", "GUINHALARAN", "HAWAII", "KAPITAN RAMON", "LANTAD",
      "MAMBULAC", "RIZAL"
    ]
  },
  {
    name: "VICTORIAS CITY",
    barangays: [
      "Barangay I (Poblacion)", "Barangay II (Quezon; Pob.)", "Barangay III (Poblacion)",
      "Barangay IV (Poblacion)", "Barangay V (Poblacion)", "Barangay VI(Estrella Village/Salvacion; Pob.)",
      "Barangay VI-A (Boulevard/Villa Miranda/Sitio Cubay/Pasil)", "Barangay VII (Poblacion)", "Barangay VIII (Old Simboryo)",
      "Barangay IX (Daan Banwa)", "Barangay X (Estado)", "Barangay XI (Gawahon)", "Barangay XII (Dacumon)", "Barangay XIII (Gloryville)",
      "Barangay XIV (Sayding)", "Barangay XV West Caticlan", "Barangay XV-A East Caticlan", "Barangay XVI (Millsite)", "Barangay XVI-A (New Barrio)",
      "Barangay XVII (Garden)", "Barangay XVIII (Palma)", "Barangay XVIII-A (Golf)", "Barangay XIX (Bacayan)", "Barangay XIX-A (Canetown Subdivision)",
      "Barangay XX (Cuaycong)", "Barangay XXI (Relocation)"

    ]
  }
  ]

// Get barangays for a specific city
export const getBarangays = (cityName: string): string[] => {
  const city = CITIES.find(c => c.name === cityName)
  return city ? [...city.barangays] : []
}

// Get all cities
export const getCities = (): string[] => {
  return CITIES.map(city => city.name)
}

// Validate if a city exists
export const isValidCity = (cityName: string): boolean => {
  return CITIES.some(city => city.name === cityName)
}

// Validate if a barangay exists in a city
export const isValidBarangay = (cityName: string, barangayName: string): boolean => {
  const city = CITIES.find(c => c.name === cityName)
  return city ? city.barangays.includes(barangayName) : false
} 