/**
 * Geolocation Load Testing Simulator
 * 
 * Simulates multiple volunteers sending location updates
 * to test system performance and scalability
 * 
 * Usage:
 *   npm install -D ts-node
 *   npx ts-node scripts/geolocation-load-test.ts
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const VOLUNTEER_TOKEN = process.env.TEST_VOLUNTEER_TOKEN || ''

interface SimulationConfig {
  numVolunteers: number
  updateIntervalMs: number
  durationMinutes: number
  movementPattern: 'stationary' | 'random_walk' | 'circular' | 'grid'
}

interface VolunteerState {
  id: number
  lat: number
  lng: number
  heading: number
  speed: number
}

// Talisay City approximate bounds
const TALISAY_BOUNDS = {
  minLat: 10.6,
  maxLat: 10.8,
  minLng: 122.8,
  maxLng: 123.0
}

// Default configuration
const DEFAULT_CONFIG: SimulationConfig = {
  numVolunteers: 100,
  updateIntervalMs: 5000, // 5 seconds
  durationMinutes: 10,
  movementPattern: 'random_walk'
}

class GeolocationLoadTester {
  private config: SimulationConfig
  private volunteers: VolunteerState[] = []
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    errors: {} as Record<string, number>,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    responseTimes: [] as number[]
  }

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeVolunteers()
  }

  private initializeVolunteers() {
    console.log(`🚀 Initializing ${this.config.numVolunteers} virtual volunteers...`)
    
    for (let i = 0; i < this.config.numVolunteers; i++) {
      this.volunteers.push({
        id: i,
        lat: this.randomInRange(TALISAY_BOUNDS.minLat, TALISAY_BOUNDS.maxLat),
        lng: this.randomInRange(TALISAY_BOUNDS.minLng, TALISAY_BOUNDS.maxLng),
        heading: Math.random() * 360,
        speed: this.randomInRange(0, 5) // 0-5 m/s
      })
    }
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }

  private moveVolunteer(volunteer: VolunteerState) {
    const pattern = this.config.movementPattern

    if (pattern === 'stationary') {
      return // No movement
    }

    if (pattern === 'random_walk') {
      // Random walk with momentum
      volunteer.heading += this.randomInRange(-30, 30)
      volunteer.speed = this.randomInRange(0, 5)
      
      const distance = (volunteer.speed * this.config.updateIntervalMs) / 1000 // meters
      const latChange = (distance * Math.cos(volunteer.heading * Math.PI / 180)) / 111320 // degrees
      const lngChange = (distance * Math.sin(volunteer.heading * Math.PI / 180)) / (111320 * Math.cos(volunteer.lat * Math.PI / 180))
      
      volunteer.lat += latChange
      volunteer.lng += lngChange
      
      // Keep within bounds
      volunteer.lat = Math.max(TALISAY_BOUNDS.minLat, Math.min(TALISAY_BOUNDS.maxLat, volunteer.lat))
      volunteer.lng = Math.max(TALISAY_BOUNDS.minLng, Math.min(TALISAY_BOUNDS.maxLng, volunteer.lng))
    }

    if (pattern === 'circular') {
      // Circular movement around center
      const centerLat = (TALISAY_BOUNDS.minLat + TALISAY_BOUNDS.maxLat) / 2
      const centerLng = (TALISAY_BOUNDS.minLng + TALISAY_BOUNDS.maxLng) / 2
      const radius = 0.01 // degrees
      
      volunteer.heading += 5 // 5 degrees per update
      const angle = volunteer.heading * Math.PI / 180
      
      volunteer.lat = centerLat + radius * Math.cos(angle)
      volunteer.lng = centerLng + radius * Math.sin(angle)
    }

    if (pattern === 'grid') {
      // Grid pattern movement
      const gridSize = Math.ceil(Math.sqrt(this.config.numVolunteers))
      const row = Math.floor(volunteer.id / gridSize)
      const col = volunteer.id % gridSize
      
      const latStep = (TALISAY_BOUNDS.maxLat - TALISAY_BOUNDS.minLat) / gridSize
      const lngStep = (TALISAY_BOUNDS.maxLng - TALISAY_BOUNDS.minLng) / gridSize
      
      volunteer.lat = TALISAY_BOUNDS.minLat + (row + 0.5) * latStep
      volunteer.lng = TALISAY_BOUNDS.minLng + (col + 0.5) * lngStep
    }
  }

  private async sendLocationUpdate(volunteer: VolunteerState): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/volunteer/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VOLUNTEER_TOKEN}`
        },
        body: JSON.stringify({
          lat: volunteer.lat,
          lng: volunteer.lng,
          accuracy: this.randomInRange(5, 50),
          speed: volunteer.speed,
          heading: volunteer.heading
        })
      })

      const responseTime = Date.now() - startTime
      this.stats.responseTimes.push(responseTime)
      this.stats.minResponseTime = Math.min(this.stats.minResponseTime, responseTime)
      this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, responseTime)
      
      this.stats.totalRequests++

      if (response.ok) {
        this.stats.successfulRequests++
      } else {
        this.stats.failedRequests++
        const errorData = await response.json().catch(() => ({ code: 'UNKNOWN' }))
        const errorCode = errorData.code || 'UNKNOWN'
        this.stats.errors[errorCode] = (this.stats.errors[errorCode] || 0) + 1
      }
    } catch (error: any) {
      this.stats.failedRequests++
      this.stats.totalRequests++
      const errorType = error.code || 'NETWORK_ERROR'
      this.stats.errors[errorType] = (this.stats.errors[errorType] || 0) + 1
    }
  }

  private printStats() {
    this.stats.avgResponseTime = this.stats.responseTimes.length > 0
      ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
      : 0

    const successRate = (this.stats.successfulRequests / this.stats.totalRequests) * 100

    console.clear()
    console.log('═══════════════════════════════════════════════════')
    console.log('  🧪 GEOLOCATION LOAD TEST - LIVE STATS')
    console.log('═══════════════════════════════════════════════════')
    console.log('')
    console.log(`📊 Configuration:`)
    console.log(`   Volunteers: ${this.config.numVolunteers}`)
    console.log(`   Update Interval: ${this.config.updateIntervalMs}ms`)
    console.log(`   Movement Pattern: ${this.config.movementPattern}`)
    console.log('')
    console.log(`📈 Performance:`)
    console.log(`   Total Requests: ${this.stats.totalRequests}`)
    console.log(`   Successful: ${this.stats.successfulRequests} (${successRate.toFixed(2)}%)`)
    console.log(`   Failed: ${this.stats.failedRequests}`)
    console.log('')
    console.log(`⏱️  Response Times:`)
    console.log(`   Average: ${this.stats.avgResponseTime.toFixed(0)}ms`)
    console.log(`   Min: ${this.stats.minResponseTime === Infinity ? 'N/A' : this.stats.minResponseTime + 'ms'}`)
    console.log(`   Max: ${this.stats.maxResponseTime === 0 ? 'N/A' : this.stats.maxResponseTime + 'ms'}`)
    console.log('')
    
    if (Object.keys(this.stats.errors).length > 0) {
      console.log(`❌ Errors:`)
      Object.entries(this.stats.errors).forEach(([code, count]) => {
        console.log(`   ${code}: ${count}`)
      })
      console.log('')
    }
    
    console.log('═══════════════════════════════════════════════════')
  }

  async run() {
    console.log(`🏁 Starting load test for ${this.config.durationMinutes} minutes...`)
    console.log('')

    if (!VOLUNTEER_TOKEN) {
      console.error('⚠️  WARNING: No VOLUNTEER_TOKEN provided. Requests will fail.')
      console.error('   Set TEST_VOLUNTEER_TOKEN environment variable.')
      console.log('')
    }

    const startTime = Date.now()
    const endTime = startTime + (this.config.durationMinutes * 60 * 1000)

    const updateLoop = setInterval(() => {
      // Update all volunteer positions
      this.volunteers.forEach(volunteer => {
        this.moveVolunteer(volunteer)
        this.sendLocationUpdate(volunteer)
      })

      // Print stats
      this.printStats()

      // Check if test should end
      if (Date.now() >= endTime) {
        clearInterval(updateLoop)
        this.finish()
      }
    }, this.config.updateIntervalMs)
  }

  private finish() {
    console.log('')
    console.log('✅ Load test completed!')
    console.log('')
    this.printStats()
    console.log('')
    console.log('📝 Recommendations:')
    
    if (this.stats.avgResponseTime > 1000) {
      console.log('   ⚠️  High response times detected. Consider:')
      console.log('      - Enabling database connection pooling')
      console.log('      - Adding caching layer')
      console.log('      - Optimizing database queries')
    }
    
    if (this.stats.failedRequests / this.stats.totalRequests > 0.05) {
      console.log('   ⚠️  High error rate (>5%). Check:')
      console.log('      - Database connection limits')
      console.log('      - API rate limiting')
      console.log('      - Server resources')
    }
    
    if (this.stats.successfulRequests / this.stats.totalRequests > 0.95) {
      console.log('   ✅ Excellent success rate! System is handling load well.')
    }
    
    console.log('')
    process.exit(0)
  }
}

// Parse CLI arguments
const args = process.argv.slice(2)
const config: Partial<SimulationConfig> = {}

for (let i = 0; i < args.length; i += 2) {
  const flag = args[i]
  const value = args[i + 1]
  
  switch (flag) {
    case '--volunteers':
      config.numVolunteers = parseInt(value)
      break
    case '--interval':
      config.updateIntervalMs = parseInt(value)
      break
    case '--duration':
      config.durationMinutes = parseInt(value)
      break
    case '--pattern':
      config.movementPattern = value as any
      break
  }
}

// Run the test
const tester = new GeolocationLoadTester(config)
tester.run()

export {}
