import { PinService } from "../pin-service"
import { supabase } from "../supabase"
import bcrypt from "bcryptjs"

// Mock the supabase client
jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { pin_hash: "hashed_pin" }, error: null }),
        }),
      }),
    }),
  },
}))

// Mock bcrypt
jest.mock("bcryptjs", () => ({
  genSalt: jest.fn().mockResolvedValue("salt"),
  hash: jest.fn().mockResolvedValue("hashed_pin"),
  compare: jest.fn().mockResolvedValue(true),
}))

describe("PinService", () => {
  let pinService: PinService

  beforeEach(() => {
    jest.clearAllMocks()
    pinService = new PinService()
  })

  describe("setPin", () => {
    it("should successfully set a PIN for a user", async () => {
      const userId = "user123"
      const pin = "1234"

      const result = await pinService.setPin(userId, pin)

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10)
      expect(bcrypt.hash).toHaveBeenCalledWith(pin, "salt")
      expect(supabase.from).toHaveBeenCalledWith("users")
      expect(supabase.from("users").update).toHaveBeenCalledWith({ pin_hash: "hashed_pin" })
      expect(supabase.from("users").update({ pin_hash: "hashed_pin" }).eq).toHaveBeenCalledWith("id", userId)
      expect(result).toBe(true)
    })

    it("should return false when setting PIN fails", async () => {
      const userId = "user123"
      const pin = "1234"

      // Mock error response
      ;(supabase.from("users").update({ pin_hash: "hashed_pin" }).eq as jest.Mock).mockResolvedValue({
        error: new Error("Database error"),
      })

      const result = await pinService.setPin(userId, pin)

      expect(result).toBe(false)
    })
  })

  describe("verifyPin", () => {
    it("should successfully verify a correct PIN", async () => {
      const userId = "user123"
      const pin = "1234"

      const result = await pinService.verifyPin(userId, pin)

      expect(supabase.from).toHaveBeenCalledWith("users")
      expect(supabase.from("users").select).toHaveBeenCalledWith("pin_hash")
      expect(supabase.from("users").select("pin_hash").eq).toHaveBeenCalledWith("id", userId)
      expect(bcrypt.compare).toHaveBeenCalledWith(pin, "hashed_pin")
      expect(result).toBe(true)
    })

    it("should return false when PIN is incorrect", async () => {
      const userId = "user123"
      const pin = "4321"

      // Mock incorrect PIN
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      const result = await pinService.verifyPin(userId, pin)

      expect(result).toBe(false)
    })

    it("should return false when user has no PIN set", async () => {
      const userId = "user123"
      const pin = "1234"

      // Mock no PIN hash
      ;(supabase.from("users").select("pin_hash").eq as jest.Mock).mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      })

      const result = await pinService.verifyPin(userId, pin)

      expect(result).toBe(false)
    })
  })

  describe("hasPin", () => {
    it("should return true when user has a PIN set", async () => {
      const userId = "user123"

      const result = await pinService.hasPin(userId)

      expect(supabase.from).toHaveBeenCalledWith("users")
      expect(supabase.from("users").select).toHaveBeenCalledWith("pin_hash")
      expect(supabase.from("users").select("pin_hash").eq).toHaveBeenCalledWith("id", userId)
      expect(result).toBe(true)
    })

    it("should return false when user has no PIN set", async () => {
      const userId = "user123"

      // Mock no PIN hash
      ;(supabase.from("users").select("pin_hash").eq as jest.Mock).mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      })

      const result = await pinService.hasPin(userId)

      expect(result).toBe(false)
    })
  })
})