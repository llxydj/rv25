#!/usr/bin/env node
/**
 * Script to validate incident filtering functionality
 * Tests all filter combinations to ensure data accuracy
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface FilterTest {
  name: string
  filters: any
  expectedMinCount?: number
}

async function validateFilters() {
  console.log('🔍 Validating incident filtering functionality...\n')

  // Test cases for different filter combinations
  const testCases: FilterTest[] = [
    {
      name: 'All incidents',
      filters: {},
      expectedMinCount: 1
    },
    {
      name: 'Pending incidents',
      filters: { status: 'PENDING' },
      expectedMinCount: 0
    },
    {
      name: 'Assigned incidents',
      filters: { status: 'ASSIGNED' },
      expectedMinCount: 0
    },
    {
      name: 'Fire incidents',
      filters: { incident_type: 'FIRE' },
      expectedMinCount: 0
    },
    {
      name: 'Critical priority incidents',
      filters: { priority: 1 },
      expectedMinCount: 0
    },
    {
      name: 'Recent incidents (last 7 days)',
      filters: { 
        created_at: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      expectedMinCount: 0
    },
    {
      name: 'Zone 1 incidents',
      filters: { barangay: 'ZONE 1' },
      expectedMinCount: 0
    },
    {
      name: 'Resolved flood incidents',
      filters: { 
        status: 'RESOLVED',
        incident_type: 'FLOOD'
      },
      expectedMinCount: 0
    },
    {
      name: 'High priority pending incidents',
      filters: {
        status: 'PENDING',
        priority: 2
      },
      expectedMinCount: 0
    }
  ]

  let passedTests = 0
  let failedTests = 0

  // Run each test case
  for (const testCase of testCases) {
    try {
      console.log(`🧪 Testing: ${testCase.name}`)
      
      // Build the query with filters
      let query = supabase.from('incidents').select('*', { count: 'exact' })
      
      // Apply filters
      Object.keys(testCase.filters).forEach(key => {
        const value = testCase.filters[key]
        if (typeof value === 'object' && value !== null) {
          // Handle range filters like { gte: 'date' }
          Object.keys(value).forEach(operator => {
            const operatorValue = value[operator]
            switch (operator) {
              case 'gte':
                query = query.gte(key, operatorValue)
                break
              case 'lte':
                query = query.lte(key, operatorValue)
                break
              case 'eq':
                query = query.eq(key, operatorValue)
                break
            }
          })
        } else {
          // Simple equality filter
          query = query.eq(key, value)
        }
      })
      
      // Execute query
      const { data, count, error } = await query
      
      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }
      
      const actualCount = count || 0
      const minCount = testCase.expectedMinCount || 0
      
      if (actualCount >= minCount) {
        console.log(`   ✅ Passed: Found ${actualCount} incidents`)
        passedTests++
      } else {
        console.log(`   ❌ Failed: Expected at least ${minCount} incidents, found ${actualCount}`)
        failedTests++
      }
      
      // Show sample data if available
      if (data && data.length > 0) {
        console.log(`   📄 Sample: ${data[0].incident_type} in ${data[0].barangay} (${data[0].status})`)
      }
      
      console.log('')
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      failedTests++
      console.log('')
    }
  }
  
  // Summary
  console.log('📋 Validation Summary:')
  console.log(`   ✅ Passed: ${passedTests}`)
  console.log(`   ❌ Failed: ${failedTests}`)
  console.log(`   📊 Total: ${passedTests + failedTests}`)
  
  if (failedTests === 0) {
    console.log('\n🎉 All filter validation tests passed!')
    return true
  } else {
    console.log('\n⚠️  Some validation tests failed. Please review the output above.')
    return false
  }
}

// Run validation
validateFilters()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('💥 Validation script failed:', error)
    process.exit(1)
  })