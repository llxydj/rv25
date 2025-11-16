// Manual test script for PIN service
import { PinService } from "../pin-service"

async function testPinService() {
  console.log("Testing PIN Service...")
  
  const pinService = new PinService()
  const testUserId = "test-user-id"
  const testPin = "1234"
  
  try {
    // Test setting a PIN
    console.log("Setting PIN...")
    const setPinResult = await pinService.setPin(testUserId, testPin)
    console.log("Set PIN result:", setPinResult)
    
    // Test checking if user has PIN
    console.log("Checking if user has PIN...")
    const hasPinResult = await pinService.hasPin(testUserId)
    console.log("Has PIN result:", hasPinResult)
    
    // Test verifying correct PIN
    console.log("Verifying correct PIN...")
    const verifyCorrectPinResult = await pinService.verifyPin(testUserId, testPin)
    console.log("Verify correct PIN result:", verifyCorrectPinResult)
    
    // Test verifying incorrect PIN
    console.log("Verifying incorrect PIN...")
    const verifyIncorrectPinResult = await pinService.verifyPin(testUserId, "4321")
    console.log("Verify incorrect PIN result:", verifyIncorrectPinResult)
    
    console.log("All tests completed successfully!")
  } catch (error) {
    console.error("Test failed with error:", error)
  }
}

// Run the test
testPinService()